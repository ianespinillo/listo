// Seed idempotente: ciclo activo del año siguiente y puestos de los mockups.
// Se ejecuta con `pnpm db:seed`.
import { prisma } from '../src/server/db';
import { todayInBuenosAires, addDays } from '../src/server/domain/dates';
import { PositionType } from '../src/server/generated/prisma/client';

const POSITIONS: { name: string; type: PositionType }[] = [
  { name: 'Matemática', type: 'ASIGNATURA' },
  { name: 'Física', type: 'ASIGNATURA' },
  { name: 'Química', type: 'ASIGNATURA' },
  { name: 'Biología', type: 'ASIGNATURA' },
  { name: 'Prácticas del Lenguaje', type: 'ASIGNATURA' },
  { name: 'Historia', type: 'ASIGNATURA' },
  { name: 'Geografía', type: 'ASIGNATURA' },
  { name: 'Inglés', type: 'ASIGNATURA' },
  { name: 'Construcción de Ciudadanía', type: 'ASIGNATURA' },
  { name: 'Educación Física', type: 'ASIGNATURA' },
  { name: 'Preceptor/a', type: 'CARGO' },
];

// Guarda la fecha exacta en columnas @db.Date (medianoche UTC).
const asDate = (date: string) => new Date(`${date}T00:00:00Z`);

async function main() {
  const today = todayInBuenosAires();
  const year = Number(today.slice(0, 4)) + 1;
  const from = today;
  const until = addDays(today, 29);

  await prisma.$transaction(async (tx) => {
    await tx.cycle.updateMany({ where: { year: { not: year }, active: true }, data: { active: false } });
    await tx.cycle.upsert({
      where: { year },
      create: { year, registrationFrom: asDate(from), registrationUntil: asDate(until), active: true },
      update: { registrationFrom: asDate(from), registrationUntil: asDate(until), active: true },
    });
  });

  for (const position of POSITIONS) {
    await prisma.position.upsert({
      where: { name: position.name },
      create: position,
      update: { type: position.type },
    });
  }

  console.log(`Ciclo ${year} activo, inscripción del ${from} al ${until}.`);
  console.log(`Puestos cargados: ${POSITIONS.length}.`);
}

main()
  .catch((error) => {
    console.error('Error al ejecutar el seed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
