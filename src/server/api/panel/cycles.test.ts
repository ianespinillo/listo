import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../db';
import { resetDatabase, seedCycle, type SeededCycle } from '../../test/db-helpers';
import { createApplicant, setupPanel, type Agent } from '../../test/panel-helpers';

let seeded: SeededCycle;
let agent: Agent;

beforeEach(async () => {
  await resetDatabase();
  seeded = await seedCycle(); // ciclo 2027 activo, del 2027-02-01 al 2027-02-28
  ({ agent } = await setupPanel()); // el reloj de los tests marca 2027-02-10
});

async function createArchived(year: number) {
  return prisma.cycle.create({
    data: {
      year,
      registrationFrom: new Date(`${year}-02-01T00:00:00Z`),
      registrationUntil: new Date(`${year}-02-28T00:00:00Z`),
      active: false,
    },
  });
}

describe('GET /api/panel/cycles', () => {
  it('lista el activo primero y después por año descendente, con open y cantidad de postulantes', async () => {
    await createArchived(2025);
    const archived2026 = await createArchived(2026);
    await createApplicant(seeded.cycleId, {}, []);
    await createApplicant(seeded.cycleId, {}, []);
    await createApplicant(seeded.cycleId, { deactivated: true }, []);
    await createApplicant(archived2026.id, {}, []);

    const res = await agent.get('/api/panel/cycles');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: seeded.cycleId,
        year: 2027,
        registrationFrom: '2027-02-01',
        registrationUntil: '2027-02-28',
        active: true,
        open: true,
        applicants: 2,
      },
      {
        id: archived2026.id,
        year: 2026,
        registrationFrom: '2026-02-01',
        registrationUntil: '2026-02-28',
        active: false,
        open: false,
        applicants: 1,
      },
      expect.objectContaining({ year: 2025, active: false, open: false, applicants: 0 }),
    ]);
  });

  it('open es false si el ciclo activo está fuera de plazo', async () => {
    await prisma.cycle.update({
      where: { id: seeded.cycleId },
      data: { registrationFrom: new Date('2027-03-01T00:00:00Z'), registrationUntil: new Date('2027-03-31T00:00:00Z') },
    });
    const res = await agent.get('/api/panel/cycles');
    expect(res.body[0]).toMatchObject({ active: true, open: false });
  });
});

describe('POST /api/panel/cycles', () => {
  it('crea el ciclo activo y desactiva el anterior en la misma operación', async () => {
    const res = await agent
      .post('/api/panel/cycles')
      .send({ year: 2028, registrationFrom: '2028-02-01', registrationUntil: '2028-02-29' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      year: 2028,
      registrationFrom: '2028-02-01',
      registrationUntil: '2028-02-29',
      active: true,
      open: false, // el reloj marca 2027-02-10
      applicants: 0,
    });

    const cycles = await prisma.cycle.findMany({ orderBy: { year: 'asc' } });
    expect(cycles.map((c) => [c.year, c.active])).toEqual([
      [2027, false],
      [2028, true],
    ]);
    expect(cycles.filter((c) => c.active)).toHaveLength(1);

    // El activo queda primero en el listado de ciclos.
    const list = await agent.get('/api/panel/cycles');
    expect(list.body.map((c: { year: number; active: boolean }) => [c.year, c.active])).toEqual([
      [2028, true],
      [2027, false],
    ]);
  });

  it('funciona también cuando no hay ningún ciclo activo', async () => {
    await prisma.cycle.update({ where: { id: seeded.cycleId }, data: { active: false } });
    const res = await agent
      .post('/api/panel/cycles')
      .send({ year: 2028, registrationFrom: '2028-02-01', registrationUntil: '2028-02-10' });
    expect(res.status).toBe(201);
  });

  it('un año que ya existe responde 409 CYCLE_EXISTS y no cambia el ciclo activo', async () => {
    await createArchived(2026);
    for (const year of [2026, 2027]) {
      const res = await agent
        .post('/api/panel/cycles')
        .send({ year, registrationFrom: '2030-02-01', registrationUntil: '2030-02-28' });
      expect(res.status, String(year)).toBe(409);
      expect(res.body.error).toBe('CYCLE_EXISTS');
    }
    const active = await prisma.cycle.findMany({ where: { active: true } });
    expect(active.map((c) => c.year)).toEqual([2027]);
  });

  it('desde > hasta responde 400 VALIDATION_ERROR con fields y no desactiva nada', async () => {
    const res = await agent
      .post('/api/panel/cycles')
      .send({ year: 2028, registrationFrom: '2028-03-01', registrationUntil: '2028-02-01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.fields).toHaveProperty('registrationUntil');
    expect((await prisma.cycle.findMany({ where: { active: true } })).map((c) => c.year)).toEqual([2027]);
  });

  it('valida el año y las fechas (obligatorias, formato AAAA-MM-DD y existentes)', async () => {
    const valid = { year: 2028, registrationFrom: '2028-02-01', registrationUntil: '2028-02-28' };
    const cases: [Record<string, unknown>, string][] = [
      [{ ...valid, year: undefined }, 'year'],
      [{ ...valid, year: '2028' }, 'year'],
      [{ ...valid, year: 1999 }, 'year'],
      [{ ...valid, year: 2028.5 }, 'year'],
      [{ ...valid, registrationFrom: undefined }, 'registrationFrom'],
      [{ ...valid, registrationFrom: '01/02/2028' }, 'registrationFrom'],
      [{ ...valid, registrationUntil: '2028-02-31' }, 'registrationUntil'],
      [{ ...valid, registrationUntil: '' }, 'registrationUntil'],
    ];
    for (const [body, field] of cases) {
      const res = await agent.post('/api/panel/cycles').send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.fields).toHaveProperty(field);
    }
    expect(await prisma.cycle.count()).toBe(1);
  });

  it('desde igual a hasta es válido (los dos días están incluidos)', async () => {
    const res = await agent
      .post('/api/panel/cycles')
      .send({ year: 2028, registrationFrom: '2028-02-10', registrationUntil: '2028-02-10' });
    expect(res.status).toBe(201);
  });
});

describe('PATCH /api/panel/cycles/:id', () => {
  it('cambia las fechas del ciclo activo y recalcula open con el reloj', async () => {
    const res = await agent
      .patch(`/api/panel/cycles/${seeded.cycleId}`)
      .send({ registrationFrom: '2027-03-01', registrationUntil: '2027-03-31' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: seeded.cycleId,
      year: 2027,
      registrationFrom: '2027-03-01',
      registrationUntil: '2027-03-31',
      active: true,
      open: false,
    });
    const stored = await prisma.cycle.findUniqueOrThrow({ where: { id: seeded.cycleId } });
    expect(stored.registrationFrom.toISOString().slice(0, 10)).toBe('2027-03-01');
    expect(stored.registrationUntil.toISOString().slice(0, 10)).toBe('2027-03-31');
  });

  it('un ciclo que no está activo es archivado: 409 CYCLE_ARCHIVED y no cambia', async () => {
    const archived = await createArchived(2026);
    const res = await agent
      .patch(`/api/panel/cycles/${archived.id}`)
      .send({ registrationFrom: '2026-03-01', registrationUntil: '2026-03-31' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('CYCLE_ARCHIVED');
    const stored = await prisma.cycle.findUniqueOrThrow({ where: { id: archived.id } });
    expect(stored.registrationFrom.toISOString().slice(0, 10)).toBe('2026-02-01');
  });

  it('desde > hasta responde 400 VALIDATION_ERROR con fields', async () => {
    const res = await agent
      .patch(`/api/panel/cycles/${seeded.cycleId}`)
      .send({ registrationFrom: '2027-03-10', registrationUntil: '2027-03-01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.fields).toHaveProperty('registrationUntil');
  });

  it('las dos fechas son obligatorias', async () => {
    const res = await agent.patch(`/api/panel/cycles/${seeded.cycleId}`).send({ registrationFrom: '2027-03-01' });
    expect(res.status).toBe(400);
    expect(res.body.fields).toHaveProperty('registrationUntil');
  });

  it('un ciclo inexistente responde 404 NOT_FOUND', async () => {
    const res = await agent
      .patch('/api/panel/cycles/9999')
      .send({ registrationFrom: '2027-03-01', registrationUntil: '2027-03-31' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});
