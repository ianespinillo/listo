import { prisma } from '../db';
import { assertTestDatabaseUrl } from './guard';

// Segunda barrera: antes de truncar nada se vuelve a verificar la URL en uso.
function assertUsingTestDatabase() {
  assertTestDatabaseUrl(process.env['DATABASE_URL']);
}

/** Vacía todas las tablas de datos y reinicia los ids. */
export async function resetDatabase() {
  assertUsingTestDatabase();
  await prisma.$executeRaw`TRUNCATE TABLE "event", "application", "applicant", "position", "cycle", "session", "admin" RESTART IDENTITY CASCADE`;
}

export interface SeededCycle {
  cycleId: number;
  positions: { id: number; name: string }[];
}

/** Crea un ciclo activo (2027, del 1 al 28 de febrero) y los puestos indicados. */
export async function seedCycle(
  options: {
    registrationFrom?: string;
    registrationUntil?: string;
    positions?: { name: string; type?: 'ASIGNATURA' | 'CARGO'; active?: boolean }[];
  } = {},
): Promise<SeededCycle> {
  assertUsingTestDatabase();
  const cycle = await prisma.cycle.create({
    data: {
      year: 2027,
      registrationFrom: new Date(`${options.registrationFrom ?? '2027-02-01'}T00:00:00Z`),
      registrationUntil: new Date(`${options.registrationUntil ?? '2027-02-28'}T00:00:00Z`),
      active: true,
    },
  });
  const definitions = options.positions ?? [
    { name: 'Matemática' },
    { name: 'Lengua' },
    { name: 'Historia' },
  ];
  const positions = [];
  for (const definition of definitions) {
    const position = await prisma.position.create({
      data: {
        name: definition.name,
        type: definition.type ?? 'ASIGNATURA',
        active: definition.active ?? true,
      },
    });
    positions.push({ id: position.id, name: position.name });
  }
  return { cycleId: cycle.id, positions };
}
