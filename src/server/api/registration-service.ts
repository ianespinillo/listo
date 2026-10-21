import { prisma } from '../db';
import { diffApplications } from '../domain/diff-applications';
import { seniorityToMonths } from '../domain/normalize';
import { isRegistrationOpen, toDateString } from '../domain/registration-window';
import { Prisma } from '../generated/prisma/client';
import { worksAtSchool, type RegistrationInput } from './registration-schema';

// Inscripción y reemplazo (reglas-de-negocio §3). Todo el alta/reemplazo corre en UNA transacción.

const SHIFT_ORDER = ['MANANA', 'TARDE', 'VESPERTINO'];
const UNAVAILABLE_POSITION_MESSAGE = 'Esta materia no está disponible.';

export interface RegistrationSummary {
  lastName: string;
  firstName: string;
  dni: string;
  employmentStatus: string;
  /** Antigüedad en la escuela en meses; null para externos. */
  schoolSeniorityMonths: number | null;
  shifts: string[];
  applications: { position: string; score: string }[];
  registrationUntil: string;
}

export type RegistrationOutcome =
  | { kind: 'closed' }
  | { kind: 'invalid'; fields: Record<string, string> }
  | { kind: 'mismatch' }
  | { kind: 'created'; summary: RegistrationSummary }
  | { kind: 'replaced'; summary: RegistrationSummary };

type Tx = Prisma.TransactionClient;

/** Ciclo activo si la inscripción está abierta en el instante `now`; si no, null. */
export async function findOpenCycle(db: Tx | typeof prisma, now: Date) {
  const cycle = await db.cycle.findFirst({ where: { active: true } });
  return cycle && isRegistrationOpen(cycle, now) ? cycle : null;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Registra o reemplaza la inscripción. Ante una violación del único (cycle_id, dni) por dos
 * altas simultáneas del mismo DNI se reintenta la transacción una vez: la segunda vez el
 * postulante ya existe y sigue la regla normal.
 */
export async function register(input: RegistrationInput, now: Date): Promise<RegistrationOutcome> {
  try {
    return await prisma.$transaction((tx) => registerInTransaction(tx, input, now));
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return prisma.$transaction((tx) => registerInTransaction(tx, input, now));
  }
}

async function registerInTransaction(
  tx: Tx,
  input: RegistrationInput,
  now: Date,
): Promise<RegistrationOutcome> {
  // 1. Ciclo activo y plazo.
  const cycle = await findOpenCycle(tx, now);
  if (!cycle) return { kind: 'closed' };

  // 2. Los puestos tienen que existir y estar activos. (Los repetidos ya los frena el esquema.)
  const positions = await tx.position.findMany({
    where: { id: { in: input.applications.map((a) => a.positionId) }, active: true },
  });
  const positionNames = new Map(positions.map((p) => [p.id, p.name]));
  const fields: Record<string, string> = {};
  input.applications.forEach((application, index) => {
    if (!positionNames.has(application.positionId)) {
      fields[`applications.${index}.positionId`] = UNAVAILABLE_POSITION_MESSAGE;
    }
  });
  if (Object.keys(fields).length > 0) return { kind: 'invalid', fields };

  const seniorityMonths = seniorityToMonths(input.seniority);
  // El externo no declara antigüedad en la escuela: si llega, se ignora.
  const schoolSeniorityMonths =
    worksAtSchool(input.employmentStatus) && input.schoolSeniority
      ? seniorityToMonths(input.schoolSeniority)
      : null;
  const shifts = [...input.shifts].sort((a, b) => SHIFT_ORDER.indexOf(a) - SHIFT_ORDER.indexOf(b));
  const summary: RegistrationSummary = {
    lastName: input.lastName,
    firstName: input.firstName,
    dni: input.dni,
    employmentStatus: input.employmentStatus,
    schoolSeniorityMonths,
    shifts,
    applications: input.applications.map((a) => ({
      position: positionNames.get(a.positionId) as string,
      score: a.score,
    })),
    registrationUntil: toDateString(cycle.registrationUntil),
  };

  // 3. Buscar el postulante.
  const existing = await tx.applicant.findUnique({
    where: { cycleId_dni: { cycleId: cycle.id, dni: input.dni } },
    include: { applications: true },
  });

  // 4. No existe: alta.
  if (!existing) {
    await tx.applicant.create({
      data: {
        cycleId: cycle.id,
        dni: input.dni,
        lastName: input.lastName,
        firstName: input.firstName,
        email: input.email,
        phone: input.phone,
        employmentStatus: input.employmentStatus,
        seniorityMonths,
        schoolSeniorityMonths,
        shifts,
        applications: {
          create: input.applications.map((a) => ({ positionId: a.positionId, score: a.score })),
        },
        events: { create: [{ type: 'REGISTRATION' }] },
      },
    });
    return { kind: 'created', summary };
  }

  // 5 y 6. Dado de baja o email distinto: la misma respuesta, sin distinguir el motivo.
  if (existing.deactivated || existing.email !== input.email) return { kind: 'mismatch' };

  // 7. Reemplazo.
  const diff = diffApplications(
    {
      employmentStatus: existing.employmentStatus,
      seniorityMonths: existing.seniorityMonths,
      schoolSeniorityMonths: existing.schoolSeniorityMonths,
      applications: existing.applications,
    },
    {
      employmentStatus: input.employmentStatus,
      seniorityMonths,
      schoolSeniorityMonths,
      applications: input.applications,
    },
  );

  await tx.applicant.update({
    where: { id: existing.id },
    data: {
      lastName: input.lastName,
      firstName: input.firstName,
      phone: input.phone,
      shifts,
      employmentStatus: input.employmentStatus,
      seniorityMonths,
      schoolSeniorityMonths,
    },
  });

  if (diff.unverifyAll && diff.unchanged.length > 0) {
    await tx.application.updateMany({
      where: { applicantId: existing.id, positionId: { in: diff.unchanged } },
      data: { verified: false, verifiedAt: null },
    });
  }
  for (const change of diff.update) {
    await tx.application.update({
      where: { applicantId_positionId: { applicantId: existing.id, positionId: change.positionId } },
      data: {
        score: change.score,
        previousScore: change.previousScore,
        verified: false,
        verifiedAt: null,
        modified: true,
      },
    });
  }
  if (diff.create.length > 0) {
    await tx.application.createMany({
      data: diff.create.map((a) => ({
        applicantId: existing.id,
        positionId: a.positionId,
        score: a.score,
        verified: false,
        modified: false,
      })),
    });
  }
  if (diff.delete.length > 0) {
    await tx.application.deleteMany({
      where: { applicantId: existing.id, positionId: { in: diff.delete } },
    });
  }
  if (diff.events.length > 0) {
    await tx.historyEvent.createMany({
      data: diff.events.map((event) => ({
        applicantId: existing.id,
        type: event.type,
        positionId: event.positionId ?? null,
        detail: event.detail as Prisma.InputJsonValue,
      })),
    });
  }

  return { kind: 'replaced', summary };
}
