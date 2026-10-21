import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { Prisma } from '../../generated/prisma/client';
import { isRegistrationOpen, toDateString } from '../../domain/registration-window';
import { sendError } from '../errors';
import { parseBody, parseId, sendNotFound } from './http';

// Ciclos (reglas §5): hay un solo ciclo activo; los archivados se consultan pero no se editan.

const CYCLE_NOT_FOUND = 'No existe el ciclo.';
const REQUIRED_DATE = 'Ingresá la fecha.';
const INVALID_DATE = 'La fecha no es válida. Usá el formato AAAA-MM-DD.';
const RANGE_MESSAGE = 'La fecha de cierre no puede ser anterior a la de apertura.';

/** Fecha 'AAAA-MM-DD' que existe en el calendario. */
const dateOnly = z
  .string({ error: REQUIRED_DATE })
  .regex(/^\d{4}-\d{2}-\d{2}$/, INVALID_DATE)
  .refine((value) => {
    // zod sigue con los demás chequeos aunque el formato falle: hay que tolerar fechas ilegibles.
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, INVALID_DATE);

const windowSchema = z.object({ registrationFrom: dateOnly, registrationUntil: dateOnly });

function withValidRange<S extends z.ZodType<{ registrationFrom: string; registrationUntil: string }>>(
  schema: S,
) {
  return schema.superRefine((value, ctx) => {
    if (value.registrationFrom > value.registrationUntil) {
      ctx.addIssue({ code: 'custom', message: RANGE_MESSAGE, path: ['registrationUntil'] });
    }
  });
}

const updateSchema = withValidRange(windowSchema);
const createSchema = withValidRange(
  windowSchema.extend({
    year: z
      .number({ error: 'Ingresá el año.' })
      .int('El año tiene que ser un número entero.')
      .min(2000, 'El año no es válido.')
      .max(2100, 'El año no es válido.'),
  }),
);

type CycleRecord = Prisma.CycleGetPayload<{
  include: { _count: { select: { applicants: { where: { deactivated: false } } } } };
}>;

const withApplicantCount = {
  _count: { select: { applicants: { where: { deactivated: false } } } },
} satisfies Prisma.CycleInclude;

function toItem(cycle: CycleRecord, now: Date) {
  return {
    id: cycle.id,
    year: cycle.year,
    registrationFrom: toDateString(cycle.registrationFrom),
    registrationUntil: toDateString(cycle.registrationUntil),
    active: cycle.active,
    // Solo el ciclo activo recibe inscripciones.
    open: cycle.active && isRegistrationOpen(cycle, now),
    // Postulantes no dados de baja.
    applicants: cycle._count.applicants,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export function createCyclesRouter(options: { now: () => Date }): Router {
  const router = Router();

  const cycleExists = (res: Parameters<typeof sendError>[0]) =>
    sendError(res, 409, 'CYCLE_EXISTS', 'Ya existe un ciclo de ese año.');

  router.get('/cycles', async (_req, res) => {
    const cycles = await prisma.cycle.findMany({
      orderBy: [{ active: 'desc' }, { year: 'desc' }],
      include: withApplicantCount,
    });
    const now = options.now();
    res.json(cycles.map((cycle) => toItem(cycle, now)));
  });

  router.patch('/cycles/:id', async (req, res) => {
    const id = parseId(req.params['id']);
    if (id === null) {
      sendNotFound(res, CYCLE_NOT_FOUND);
      return;
    }
    const body = parseBody(updateSchema, req, res);
    if (!body) return;

    const outcome = await prisma.$transaction(async (tx) => {
      const cycle = await tx.cycle.findUnique({ where: { id } });
      if (!cycle) return 'not-found' as const;
      if (!cycle.active) return 'archived' as const;
      return tx.cycle.update({
        where: { id },
        data: {
          registrationFrom: new Date(`${body.registrationFrom}T00:00:00Z`),
          registrationUntil: new Date(`${body.registrationUntil}T00:00:00Z`),
        },
        include: withApplicantCount,
      });
    });
    if (outcome === 'not-found') {
      sendNotFound(res, CYCLE_NOT_FOUND);
      return;
    }
    if (outcome === 'archived') {
      sendError(res, 409, 'CYCLE_ARCHIVED', 'Los ciclos archivados no se pueden editar.');
      return;
    }
    res.json(toItem(outcome, options.now()));
  });

  router.post('/cycles', async (req, res) => {
    const body = parseBody(createSchema, req, res);
    if (!body) return;

    try {
      const created = await prisma.$transaction(async (tx) => {
        if (await tx.cycle.findUnique({ where: { year: body.year }, select: { id: true } })) {
          return null;
        }
        // Primero se desactiva el anterior: el índice único parcial `cycle_single_active`
        // no admite dos ciclos activos ni siquiera dentro de la transacción.
        await tx.cycle.updateMany({ where: { active: true }, data: { active: false } });
        return tx.cycle.create({
          data: {
            year: body.year,
            registrationFrom: new Date(`${body.registrationFrom}T00:00:00Z`),
            registrationUntil: new Date(`${body.registrationUntil}T00:00:00Z`),
            active: true,
          },
          include: withApplicantCount,
        });
      });
      if (!created) {
        cycleExists(res);
        return;
      }
      res.status(201).json(toItem(created, options.now()));
    } catch (error) {
      // Dos altas simultáneas del mismo año: la perdedora choca con el único.
      if (isUniqueViolation(error) && (await prisma.cycle.findUnique({ where: { year: body.year } }))) {
        cycleExists(res);
        return;
      }
      throw error;
    }
  });

  return router;
}
