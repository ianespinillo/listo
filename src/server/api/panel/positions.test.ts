import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../db';
import { resetDatabase, seedCycle, type SeededCycle } from '../../test/db-helpers';
import { createApplicant, setupPanel, type Agent } from '../../test/panel-helpers';

let seeded: SeededCycle;
let agent: Agent;

beforeEach(async () => {
  await resetDatabase();
  seeded = await seedCycle();
  ({ agent } = await setupPanel());
});

describe('GET /api/panel/positions', () => {
  it('lista todos los puestos (también los inactivos) por nombre, con la cantidad de postulantes del ciclo activo', async () => {
    const [math, language] = seeded.positions;
    await prisma.position.create({ data: { name: 'Biología', type: 'ASIGNATURA', active: false } });
    await createApplicant(seeded.cycleId, {}, [
      { positionId: math.id, score: '10' },
      { positionId: language.id, score: '10' },
    ]);
    await createApplicant(seeded.cycleId, {}, [{ positionId: math.id, score: '20' }]);
    // No cuentan: dado de baja y postulante de un ciclo archivado.
    await createApplicant(seeded.cycleId, { deactivated: true }, [{ positionId: math.id, score: '30' }]);
    const old = await prisma.cycle.create({
      data: {
        year: 2026,
        registrationFrom: new Date('2026-02-01T00:00:00Z'),
        registrationUntil: new Date('2026-02-28T00:00:00Z'),
      },
    });
    await createApplicant(old.id, {}, [{ positionId: math.id, score: '40' }]);

    const res = await agent.get('/api/panel/positions');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: expect.any(Number), name: 'Biología', type: 'ASIGNATURA', active: false, activeCycleApplicants: 0 },
      { id: expect.any(Number), name: 'Historia', type: 'ASIGNATURA', active: true, activeCycleApplicants: 0 },
      { id: language.id, name: 'Lengua', type: 'ASIGNATURA', active: true, activeCycleApplicants: 1 },
      { id: math.id, name: 'Matemática', type: 'ASIGNATURA', active: true, activeCycleApplicants: 2 },
    ]);
  });
});

describe('POST /api/panel/positions', () => {
  it('crea el puesto (201), con el nombre recortado y los espacios colapsados', async () => {
    const res = await agent.post('/api/panel/positions').send({ name: '  Educación   Física ', type: 'ASIGNATURA' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      name: 'Educación Física',
      type: 'ASIGNATURA',
      active: true,
      activeCycleApplicants: 0,
    });
    expect(await prisma.position.findUnique({ where: { name: 'Educación Física' } })).not.toBeNull();
  });

  it('un nombre repetido, aunque cambie la capitalización, responde 409 DUPLICATE_POSITION', async () => {
    for (const name of ['matemática', 'MATEMÁTICA', ' Matemática  ']) {
      const res = await agent.post('/api/panel/positions').send({ name, type: 'ASIGNATURA' });
      expect(res.status, name).toBe(409);
      expect(res.body.error).toBe('DUPLICATE_POSITION');
    }
    expect(await prisma.position.count()).toBe(3);
  });

  it('un nombre repetido de un puesto inactivo también es duplicado', async () => {
    await prisma.position.create({ data: { name: 'Biología', type: 'ASIGNATURA', active: false } });
    const res = await agent.post('/api/panel/positions').send({ name: 'biología', type: 'ASIGNATURA' });
    expect(res.status).toBe(409);
  });

  it('valida el nombre y el tipo (400 con fields)', async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ type: 'CARGO' }, 'name'],
      [{ name: '   ', type: 'CARGO' }, 'name'],
      [{ name: 'x'.repeat(81), type: 'CARGO' }, 'name'],
      [{ name: 'Preceptor', type: 'OTRO' }, 'type'],
      [{ name: 'Preceptor' }, 'type'],
    ];
    for (const [body, field] of cases) {
      const res = await agent.post('/api/panel/positions').send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.fields).toHaveProperty(field);
    }
    const ok = await agent.post('/api/panel/positions').send({ name: 'x'.repeat(80), type: 'CARGO' });
    expect(ok.status).toBe(201);
  });
});

describe('PATCH /api/panel/positions/:id', () => {
  it('renombra, cambia el tipo y desactiva', async () => {
    const [, language] = seeded.positions;
    const renamed = await agent.patch(`/api/panel/positions/${language.id}`).send({ name: ' Lengua y Literatura ' });
    expect(renamed.status).toBe(200);
    expect(renamed.body).toMatchObject({ id: language.id, name: 'Lengua y Literatura', active: true });

    const typed = await agent.patch(`/api/panel/positions/${language.id}`).send({ type: 'CARGO' });
    expect(typed.body).toMatchObject({ type: 'CARGO', name: 'Lengua y Literatura' });

    const off = await agent.patch(`/api/panel/positions/${language.id}`).send({ active: false });
    expect(off.body).toMatchObject({ active: false });
    expect((await prisma.position.findUniqueOrThrow({ where: { id: language.id } })).active).toBe(false);

    const on = await agent.patch(`/api/panel/positions/${language.id}`).send({ active: true });
    expect(on.body.active).toBe(true);
  });

  it('la respuesta trae la cantidad de postulantes del ciclo activo', async () => {
    const [math] = seeded.positions;
    await createApplicant(seeded.cycleId, {}, [{ positionId: math.id, score: '10' }]);
    const res = await agent.patch(`/api/panel/positions/${math.id}`).send({ active: false });
    expect(res.body.activeCycleApplicants).toBe(1);
  });

  it('renombrar a un nombre existente con otra capitalización responde 409 DUPLICATE_POSITION', async () => {
    const [math, language] = seeded.positions;
    const res = await agent.patch(`/api/panel/positions/${language.id}`).send({ name: 'MATEMÁTICA' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('DUPLICATE_POSITION');
    expect((await prisma.position.findUniqueOrThrow({ where: { id: language.id } })).name).toBe('Lengua');
    expect((await prisma.position.findUniqueOrThrow({ where: { id: math.id } })).name).toBe('Matemática');
  });

  it('cambiar solo la capitalización de su propio nombre está permitido', async () => {
    const [math] = seeded.positions;
    const res = await agent.patch(`/api/panel/positions/${math.id}`).send({ name: 'MATEMÁTICA' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('MATEMÁTICA');
  });

  it('un puesto inexistente responde 404 y un cuerpo vacío o inválido responde 400', async () => {
    const [math] = seeded.positions;
    const missing = await agent.patch('/api/panel/positions/9999').send({ active: false });
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe('NOT_FOUND');

    expect((await agent.patch(`/api/panel/positions/${math.id}`).send({})).status).toBe(400);
    const bad = await agent.patch(`/api/panel/positions/${math.id}`).send({ active: 'no', type: 'X' });
    expect(bad.status).toBe(400);
    expect(bad.body.fields).toHaveProperty('active');
    expect(bad.body.fields).toHaveProperty('type');
  });
});
