// Seed idempotente: ciclo activo del año siguiente y puestos de los mockups.
// Se ejecuta con `pnpm db:seed`.
import { prisma } from '../src/server/db';
import { todayInBuenosAires, addDays } from '../src/server/domain/dates';
import { TipoPuesto } from '../src/server/generated/prisma/client';

const POSITIONS: { nombre: string; tipo: TipoPuesto }[] = [
  { nombre: 'Matemática', tipo: 'ASIGNATURA' },
  { nombre: 'Física', tipo: 'ASIGNATURA' },
  { nombre: 'Química', tipo: 'ASIGNATURA' },
  { nombre: 'Biología', tipo: 'ASIGNATURA' },
  { nombre: 'Prácticas del Lenguaje', tipo: 'ASIGNATURA' },
  { nombre: 'Historia', tipo: 'ASIGNATURA' },
  { nombre: 'Geografía', tipo: 'ASIGNATURA' },
  { nombre: 'Inglés', tipo: 'ASIGNATURA' },
  { nombre: 'Construcción de Ciudadanía', tipo: 'ASIGNATURA' },
  { nombre: 'Educación Física', tipo: 'ASIGNATURA' },
  { nombre: 'Preceptor/a', tipo: 'CARGO' },
];

// Guarda la fecha exacta en columnas @db.Date (medianoche UTC).
const asDate = (fecha: string) => new Date(`${fecha}T00:00:00Z`);

async function main() {
  const today = todayInBuenosAires();
  const year = Number(today.slice(0, 4)) + 1;
  const from = today;
  const until = addDays(today, 29);

  await prisma.$transaction(async (tx) => {
    await tx.ciclo.updateMany({ where: { anio: { not: year }, activo: true }, data: { activo: false } });
    await tx.ciclo.upsert({
      where: { anio: year },
      create: { anio: year, inscripcionDesde: asDate(from), inscripcionHasta: asDate(until), activo: true },
      update: { inscripcionDesde: asDate(from), inscripcionHasta: asDate(until), activo: true },
    });
  });

  for (const position of POSITIONS) {
    await prisma.puesto.upsert({
      where: { nombre: position.nombre },
      create: position,
      update: { tipo: position.tipo },
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
