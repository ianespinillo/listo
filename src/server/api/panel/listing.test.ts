import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../db';
import { resetDatabase, seedCycle, type SeededCycle } from '../../test/db-helpers';
import {
  createApplicant,
  setupPanel,
  type Agent,
  type ApplicantSeed,
} from '../../test/panel-helpers';

let seeded: SeededCycle;
let agent: Agent;
let math: number;
let language: number;

beforeEach(async () => {
  await resetDatabase();
  seeded = await seedCycle();
  math = seeded.positions[0].id; // Matemática
  language = seeded.positions[1].id; // Lengua
  ({ agent } = await setupPanel());
});

/** Crea un postulante con una postulación a Matemática. */
function add(seed: ApplicantSeed, score: string, extra: { verified?: boolean; modified?: boolean } = {}) {
  return createApplicant(seeded.cycleId, seed, [{ positionId: math, score, ...extra }]);
}

interface Row {
  order: number;
  applicantId: number;
  lastName: string;
  firstName: string;
  score: string;
  status: string;
}

async function getListing(query = `positionId=${math}`) {
  const res = await agent.get(`/api/panel/listing?${query}`);
  expect(res.status).toBe(200);
  return res.body as {
    cycle: { id: number; year: number; open: boolean } | null;
    position: { id: number; name: string; type: string } | null;
    summary: { total: number; verified: number; modified: number };
    groups: { group: number; rows: Row[] }[];
  };
}

/** Apellidos en el orden global del listado (grupo 1, 2 y 3). */
function names(body: Awaited<ReturnType<typeof getListing>>): string[] {
  return body.groups.flatMap((group) => group.rows.map((row) => row.lastName));
}

describe('GET /api/panel/listing: forma de la respuesta', () => {
  it('devuelve ciclo, puesto, resumen y siempre los 3 grupos, con puntaje string de 2 decimales', async () => {
    await add({ lastName: 'Gomez', employmentStatus: 'TITULAR', seniorityMonths: 256, schoolSeniorityMonths: 130, phone: '11 4021 3387', shifts: ['MANANA', 'TARDE'] }, '44.1', { verified: true });
    await add({ lastName: 'Lopez', employmentStatus: 'PROVISIONAL' }, '30.00', { modified: true });
    await add({ lastName: 'Ruiz', employmentStatus: 'EXTERNO' }, '20');

    const body = await getListing();

    expect(body.cycle).toEqual({ id: seeded.cycleId, year: 2027, open: true });
    expect(body.position).toEqual({ id: math, name: 'Matemática', type: 'ASIGNATURA' });
    expect(body.summary).toEqual({ total: 3, verified: 1, modified: 1 });
    expect(body.groups.map((g) => g.group)).toEqual([1, 2, 3]);

    const [first] = body.groups[0].rows;
    expect(first).toEqual({
      order: 1,
      applicantId: expect.any(Number),
      lastName: 'Gomez',
      firstName: 'Ana',
      dni: expect.stringMatching(/^\d+$/),
      employmentStatus: 'TITULAR',
      seniorityMonths: 256,
      schoolSeniorityMonths: 130,
      score: '44.10',
      shifts: ['MANANA', 'TARDE'],
      status: 'VERIFIED',
      phone: '11 4021 3387',
    });
    expect(body.groups[1].rows[0]).toMatchObject({ order: 2, score: '30.00', status: 'MODIFIED' });
    expect(body.groups[2].rows[0]).toMatchObject({ order: 3, score: '20.00', status: 'UNVERIFIED' });
  });

  it('los 3 grupos vienen aunque estén vacíos', async () => {
    const body = await getListing();
    expect(body.groups).toEqual([
      { group: 1, rows: [] },
      { group: 2, rows: [] },
      { group: 3, rows: [] },
    ]);
    expect(body.summary).toEqual({ total: 0, verified: 0, modified: 0 });
  });

  it('un postulante que se postuló a otro puesto no aparece en este', async () => {
    await createApplicant(seeded.cycleId, { lastName: 'Otra' }, [{ positionId: language, score: '50' }]);
    await add({ lastName: 'Esta' }, '10');
    expect(names(await getListing())).toEqual(['Esta']);
    expect(names(await getListing(`positionId=${language}`))).toEqual(['Otra']);
  });
});

describe('GET /api/panel/listing: orden del decreto (reglas §2)', () => {
  it('un titular con menos puntaje queda antes que un provisional con más puntaje', async () => {
    await add({ lastName: 'Provisional', employmentStatus: 'PROVISIONAL', seniorityMonths: 300 }, '90');
    await add({ lastName: 'Titular', employmentStatus: 'TITULAR', seniorityMonths: 1 }, '5');

    const body = await getListing();
    expect(names(body)).toEqual(['Titular', 'Provisional']);
    expect(body.groups[0].rows.map((r) => r.lastName)).toEqual(['Titular']);
    expect(body.groups[1].rows.map((r) => r.lastName)).toEqual(['Provisional']);
  });

  it('provisional y suplente con el mismo puntaje: va primero el de más antigüedad, sea cual sea', async () => {
    await add({ lastName: 'ProvisionalViejo', employmentStatus: 'PROVISIONAL', seniorityMonths: 120 }, '40');
    await add({ lastName: 'SuplenteNuevo', employmentStatus: 'SUPLENTE', seniorityMonths: 24 }, '40');
    expect(names(await getListing())).toEqual(['ProvisionalViejo', 'SuplenteNuevo']);

    await resetDatabase();
    seeded = await seedCycle();
    math = seeded.positions[0].id;
    ({ agent } = await setupPanel());
    await add({ lastName: 'ProvisionalNuevo', employmentStatus: 'PROVISIONAL', seniorityMonths: 24 }, '40');
    await add({ lastName: 'SuplenteViejo', employmentStatus: 'SUPLENTE', seniorityMonths: 120 }, '40');
    expect(names(await getListing())).toEqual(['SuplenteViejo', 'ProvisionalNuevo']);
  });

  it('en el grupo 2 el puntaje manda sobre la antigüedad', async () => {
    await add({ lastName: 'MenosPuntaje', employmentStatus: 'PROVISIONAL', seniorityMonths: 300 }, '30');
    await add({ lastName: 'MasPuntaje', employmentStatus: 'SUPLENTE', seniorityMonths: 6 }, '31.5');
    expect(names(await getListing())).toEqual(['MasPuntaje', 'MenosPuntaje']);
  });

  it('un externo con puntaje alto queda después de todo el grupo 2', async () => {
    await add({ lastName: 'Externo', employmentStatus: 'EXTERNO', seniorityMonths: 400 }, '99.99');
    await add({ lastName: 'ProvisionalBajo', employmentStatus: 'PROVISIONAL' }, '1');
    await add({ lastName: 'SuplenteBajo', employmentStatus: 'SUPLENTE' }, '2');

    const body = await getListing();
    expect(names(body)).toEqual(['SuplenteBajo', 'ProvisionalBajo', 'Externo']);
    expect(body.groups[2].rows.map((r) => r.lastName)).toEqual(['Externo']);
  });

  it('el grupo 3 se ordena por puntaje', async () => {
    await add({ lastName: 'Bajo', employmentStatus: 'EXTERNO', seniorityMonths: 500 }, '10');
    await add({ lastName: 'Alto', employmentStatus: 'EXTERNO', seniorityMonths: 1 }, '60');
    expect(names(await getListing())).toEqual(['Alto', 'Bajo']);
  });

  it('dentro del grupo 1 el puntaje no influye: solo la antigüedad en la escuela', async () => {
    await add({ lastName: 'PocoPuntaje', employmentStatus: 'TITULAR', seniorityMonths: 200, schoolSeniorityMonths: 100 }, '1');
    await add({ lastName: 'MuchoPuntaje', employmentStatus: 'TITULAR', seniorityMonths: 200, schoolSeniorityMonths: 40 }, '99.99');
    await add({ lastName: 'Intermedio', employmentStatus: 'TITULAR', seniorityMonths: 200, schoolSeniorityMonths: 70 }, '50');
    expect(names(await getListing())).toEqual(['PocoPuntaje', 'Intermedio', 'MuchoPuntaje']);
  });

  it('grupo 1: un titular con menos antigüedad docente pero más antigüedad en la escuela va primero', async () => {
    await add({ lastName: 'MuchaDocente', employmentStatus: 'TITULAR', seniorityMonths: 300, schoolSeniorityMonths: 24 }, '10');
    await add({ lastName: 'MuchaEscuela', employmentStatus: 'TITULAR', seniorityMonths: 100, schoolSeniorityMonths: 96 }, '10');
    expect(names(await getListing())).toEqual(['MuchaEscuela', 'MuchaDocente']);
  });

  it('grupo 1: quien no declaró antigüedad en la escuela (null) va último dentro del grupo', async () => {
    await add({ lastName: 'SinDato', employmentStatus: 'TITULAR', seniorityMonths: 500, schoolSeniorityMonths: null }, '99');
    await add({ lastName: 'ConDato', employmentStatus: 'TITULAR', seniorityMonths: 12, schoolSeniorityMonths: 0 }, '1');
    expect(names(await getListing())).toEqual(['ConDato', 'SinDato']);
  });

  it('grupo 2: la antigüedad en la escuela no influye; el desempate sigue siendo la antigüedad docente', async () => {
    await add({ lastName: 'DocenteVieja', employmentStatus: 'PROVISIONAL', seniorityMonths: 200, schoolSeniorityMonths: 6 }, '40');
    await add({ lastName: 'EscuelaVieja', employmentStatus: 'SUPLENTE', seniorityMonths: 100, schoolSeniorityMonths: 100 }, '40');
    expect(names(await getListing())).toEqual(['DocenteVieja', 'EscuelaVieja']);
  });

  it('el número de orden es global, de 1 a N recorriendo los grupos 1, 2 y 3', async () => {
    await add({ lastName: 'E', employmentStatus: 'EXTERNO' }, '80');
    await add({ lastName: 'P', employmentStatus: 'PROVISIONAL' }, '20');
    await add({ lastName: 'T1', employmentStatus: 'TITULAR', seniorityMonths: 50 }, '1');
    await add({ lastName: 'T2', employmentStatus: 'TITULAR', seniorityMonths: 40 }, '1');

    const body = await getListing();
    const orders = body.groups.flatMap((g) => g.rows.map((r) => [r.lastName, r.order]));
    expect(orders).toEqual([['T1', 1], ['T2', 2], ['P', 3], ['E', 4]]);
  });

  it('desempate final por apellido, nombre e id (grupos 1, 2 y 3)', async () => {
    const tie = (employmentStatus: ApplicantSeed['employmentStatus']) => ({
      employmentStatus,
      seniorityMonths: 60,
    });
    for (const status of ['TITULAR', 'PROVISIONAL', 'EXTERNO'] as const) {
      await add({ ...tie(status), lastName: 'Zeta', firstName: 'Ana' }, '40');
      await add({ ...tie(status), lastName: 'Alfa', firstName: 'Beatriz' }, '40');
      await add({ ...tie(status), lastName: 'Alfa', firstName: 'Ana' }, '40');
    }
    // Mismo apellido y nombre: gana el id menor (el que se creó primero).
    const firstTwin = await add({ employmentStatus: 'TITULAR', seniorityMonths: 60, lastName: 'Zeta', firstName: 'Ana' }, '40');
    const secondTwin = await add({ employmentStatus: 'TITULAR', seniorityMonths: 60, lastName: 'Zeta', firstName: 'Ana' }, '40');

    const body = await getListing();
    const groupLabels = body.groups.map((g) => g.rows.map((r) => `${r.lastName} ${r.firstName}`));
    expect(groupLabels[0]).toEqual(['Alfa Ana', 'Alfa Beatriz', 'Zeta Ana', 'Zeta Ana', 'Zeta Ana']);
    expect(groupLabels[1]).toEqual(['Alfa Ana', 'Alfa Beatriz', 'Zeta Ana']);
    expect(groupLabels[2]).toEqual(['Alfa Ana', 'Alfa Beatriz', 'Zeta Ana']);

    const zetaAnaIds = body.groups[0].rows.filter((r) => r.lastName === 'Zeta').map((r) => r.applicantId);
    expect(zetaAnaIds.indexOf(firstTwin.id)).toBeLessThan(zetaAnaIds.indexOf(secondTwin.id));
    expect(zetaAnaIds).toEqual([...zetaAnaIds].sort((a, b) => a - b));
  });
});

describe('GET /api/panel/listing: filtros y exclusiones', () => {
  it('el filtro por turno excluye bien y renumera el orden', async () => {
    await add({ lastName: 'Manana', employmentStatus: 'TITULAR', seniorityMonths: 300, shifts: ['MANANA'] }, '1');
    await add({ lastName: 'Tarde', employmentStatus: 'TITULAR', seniorityMonths: 200, shifts: ['MANANA', 'TARDE'] }, '1');
    await add({ lastName: 'Vespertino', employmentStatus: 'PROVISIONAL', shifts: ['VESPERTINO'] }, '50');
    await add({ lastName: 'Tarde2', employmentStatus: 'EXTERNO', shifts: ['TARDE'] }, '10');

    const all = await getListing();
    expect(all.groups.flatMap((g) => g.rows.map((r) => [r.lastName, r.order]))).toEqual([
      ['Manana', 1],
      ['Tarde', 2],
      ['Vespertino', 3],
      ['Tarde2', 4],
    ]);

    const afternoon = await getListing(`positionId=${math}&shift=TARDE`);
    expect(afternoon.groups.flatMap((g) => g.rows.map((r) => [r.lastName, r.order]))).toEqual([
      ['Tarde', 1],
      ['Tarde2', 2],
    ]);
    expect(afternoon.summary.total).toBe(2);

    const evening = await getListing(`positionId=${math}&shift=VESPERTINO`);
    expect(names(evening)).toEqual(['Vespertino']);
    expect(evening.groups[1].rows[0].order).toBe(1);
  });

  it('"solo verificados" excluye a los no verificados, renumera y ajusta el resumen', async () => {
    await add({ lastName: 'T1', employmentStatus: 'TITULAR', seniorityMonths: 300 }, '1');
    await add({ lastName: 'T2', employmentStatus: 'TITULAR', seniorityMonths: 200 }, '1', { verified: true });
    await add({ lastName: 'P1', employmentStatus: 'PROVISIONAL' }, '80', { modified: true });
    await add({ lastName: 'P2', employmentStatus: 'PROVISIONAL' }, '70', { verified: true });

    const body = await getListing(`positionId=${math}&onlyVerified=true`);
    expect(body.groups.flatMap((g) => g.rows.map((r) => [r.lastName, r.order]))).toEqual([
      ['T2', 1],
      ['P2', 2],
    ]);
    expect(body.summary).toEqual({ total: 2, verified: 2, modified: 0 });

    const explicitFalse = await getListing(`positionId=${math}&onlyVerified=false`);
    expect(names(explicitFalse)).toEqual(['T1', 'T2', 'P1', 'P2']);
    expect(explicitFalse.summary).toEqual({ total: 4, verified: 2, modified: 1 });
  });

  it('turno y solo verificados se combinan', async () => {
    await add({ lastName: 'A', employmentStatus: 'TITULAR', shifts: ['TARDE'] }, '1', { verified: true });
    await add({ lastName: 'B', employmentStatus: 'TITULAR', shifts: ['TARDE'] }, '1');
    await add({ lastName: 'C', employmentStatus: 'TITULAR', shifts: ['MANANA'] }, '1', { verified: true });
    expect(names(await getListing(`positionId=${math}&shift=TARDE&onlyVerified=true`))).toEqual(['A']);
  });

  it('los dados de baja no aparecen', async () => {
    await add({ lastName: 'Activo' }, '10');
    await add({ lastName: 'DeBaja', deactivated: true }, '99');
    const body = await getListing();
    expect(names(body)).toEqual(['Activo']);
    expect(body.summary.total).toBe(1);
  });

  it('los postulantes de un ciclo que no es el activo no aparecen', async () => {
    const old = await prisma.cycle.create({
      data: {
        year: 2026,
        registrationFrom: new Date('2026-02-01T00:00:00Z'),
        registrationUntil: new Date('2026-02-28T00:00:00Z'),
        active: false,
      },
    });
    await createApplicant(old.id, { lastName: 'Archivado' }, [{ positionId: math, score: '99' }]);
    await add({ lastName: 'Vigente' }, '10');
    expect(names(await getListing())).toEqual(['Vigente']);
  });
});

describe('GET /api/panel/listing: puesto y ciclo', () => {
  it('sin positionId usa el primer puesto activo por nombre', async () => {
    // Orden por nombre: Historia, Lengua, Matemática. Se desactiva Historia.
    await prisma.position.updateMany({ where: { name: 'Historia' }, data: { active: false } });
    await createApplicant(seeded.cycleId, { lastName: 'EnLengua' }, [{ positionId: language, score: '10' }]);

    const body = await getListing('');
    expect(body.position).toMatchObject({ name: 'Lengua' });
    expect(names(body)).toEqual(['EnLengua']);
  });

  it('se puede pedir un puesto inactivo', async () => {
    await add({ lastName: 'Docente' }, '10');
    await prisma.position.update({ where: { id: math }, data: { active: false } });
    const body = await getListing();
    expect(body.position).toMatchObject({ id: math });
    expect(names(body)).toEqual(['Docente']);
  });

  it('un positionId inexistente responde 404 NOT_FOUND', async () => {
    const res = await agent.get('/api/panel/listing?positionId=9999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('parámetros inválidos responden 400 VALIDATION_ERROR', async () => {
    for (const query of ['shift=NOCHE', 'onlyVerified=yes', 'positionId=abc', 'shift=TARDE&shift=MANANA']) {
      const res = await agent.get(`/api/panel/listing?${query}`);
      expect(res.status, query).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.fields).toBeDefined();
    }
  });

  it('con el plazo vencido informa open=false', async () => {
    await prisma.cycle.update({
      where: { id: seeded.cycleId },
      data: { registrationUntil: new Date('2027-02-05T00:00:00Z') },
    });
    expect((await getListing()).cycle).toMatchObject({ open: false });
  });

  it('sin ciclo activo responde 200 con cycle null, resumen en cero y los 3 grupos vacíos', async () => {
    await prisma.cycle.update({ where: { id: seeded.cycleId }, data: { active: false } });
    const res = await agent.get(`/api/panel/listing?positionId=${math}`);
    expect(res.status).toBe(200);
    expect(res.body.cycle).toBeNull();
    expect(res.body.summary).toEqual({ total: 0, verified: 0, modified: 0 });
    expect(res.body.groups).toEqual([
      { group: 1, rows: [] },
      { group: 2, rows: [] },
      { group: 3, rows: [] },
    ]);
  });
});
