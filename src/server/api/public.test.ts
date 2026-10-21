import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../db';
import { resetDatabase, seedCycle, type SeededCycle } from '../test/db-helpers';
import { createApiRouter, type ApiRouterOptions } from './index';

// Reloj fijo dentro del plazo (2027-02-10, mediodía en Buenos Aires).
const OPEN_NOW = new Date('2027-02-10T15:00:00Z');

function buildApp(options: ApiRouterOptions = {}) {
  const app = express();
  app.use('/api', createApiRouter({ now: () => OPEN_NOW, registrationRateLimit: false, ...options }));
  return app;
}

function validBody(seeded: SeededCycle, overrides: Record<string, unknown> = {}) {
  return {
    dni: '28.123.456',
    lastName: 'Pereyra',
    firstName: 'Laura Inés',
    email: 'Laura.Pereyra@Ejemplo.com ',
    phone: '11 5544 0921',
    employmentStatus: 'PROVISIONAL',
    seniority: { years: 9, months: 2 },
    shifts: ['TARDE', 'MANANA'],
    applications: [
      { positionId: seeded.positions[0].id, score: '38,45' },
      { positionId: seeded.positions[1].id, score: '31.20' },
    ],
    declaration: true,
    ...overrides,
  };
}

let seeded: SeededCycle;

beforeEach(async () => {
  await resetDatabase();
  seeded = await seedCycle();
});

async function findApplicant(dni = '28123456') {
  return prisma.applicant.findFirstOrThrow({
    where: { dni },
    include: { applications: { orderBy: { positionId: 'asc' } }, events: { orderBy: { id: 'asc' } } },
  });
}

describe('GET /api/public/status', () => {
  it('con ciclo activo devuelve ciclo, abierta, escuela y puestos activos ordenados por nombre', async () => {
    await prisma.position.create({ data: { name: 'Biología (inactiva)', type: 'ASIGNATURA', active: false } });
    process.env['SCHOOL_NAME'] = 'E.E.S. N.º 1 de prueba';
    process.env['SCHOOL_CONTACT'] = 'secretaria@escuela.test';

    const res = await request(buildApp()).get('/api/public/status');

    expect(res.status).toBe(200);
    expect(res.body.cycle).toEqual({
      year: 2027,
      registrationFrom: '2027-02-01',
      registrationUntil: '2027-02-28',
    });
    expect(res.body.open).toBe(true);
    expect(res.body.school).toEqual({
      name: 'E.E.S. N.º 1 de prueba',
      contact: 'secretaria@escuela.test',
    });
    expect(res.body.positions.map((p: { name: string }) => p.name)).toEqual([
      'Historia',
      'Lengua',
      'Matemática',
    ]);
    expect(Object.keys(res.body.positions[0]).sort()).toEqual(['id', 'name', 'type']);
  });

  it('fuera de plazo informa open=false', async () => {
    const app = buildApp({ now: () => new Date('2027-03-01T03:00:00Z') });
    const res = await request(app).get('/api/public/status');
    expect(res.body.open).toBe(false);
    expect(res.body.cycle.year).toBe(2027);
  });

  it('sin ciclo activo devuelve cycle null, open false y sin puestos', async () => {
    await resetDatabase();
    const res = await request(buildApp()).get('/api/public/status');
    expect(res.status).toBe(200);
    expect(res.body.cycle).toBeNull();
    expect(res.body.open).toBe(false);
    expect(res.body.positions).toEqual([]);
    expect(res.body.school).toBeDefined();
  });
});

describe('POST /api/public/registration: alta', () => {
  it('crea la inscripción (201) con resumen, sin verificar y con evento REGISTRATION', async () => {
    const res = await request(buildApp()).post('/api/public/registration').send(validBody(seeded));

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      result: 'created',
      summary: {
        lastName: 'Pereyra',
        firstName: 'Laura Inés',
        dni: '28123456',
        employmentStatus: 'PROVISIONAL',
        shifts: ['MANANA', 'TARDE'],
        applications: [
          { position: 'Matemática', score: '38.45' },
          { position: 'Lengua', score: '31.20' },
        ],
        registrationUntil: '2027-02-28',
      },
    });
    expect(JSON.stringify(res.body)).not.toContain('@');

    const applicant = await findApplicant();
    expect(applicant.email).toBe('laura.pereyra@ejemplo.com');
    expect(applicant.seniorityMonths).toBe(110);
    expect(applicant.applications).toHaveLength(2);
    expect(applicant.applications.every((a) => !a.verified && !a.modified)).toBe(true);
    expect(applicant.events.map((e) => e.type)).toEqual(['REGISTRATION']);
  });
});

describe('POST /api/public/registration: reemplazo', () => {
  async function createAndVerify() {
    const app = buildApp();
    await request(app).post('/api/public/registration').send(validBody(seeded)).expect(201);
    await prisma.application.updateMany({ data: { verified: true, verifiedAt: new Date() } });
    return app;
  }

  it('mismo email y mismos datos: 200, conserva la verificación y no genera eventos', async () => {
    const app = await createAndVerify();
    const res = await request(app)
      .post('/api/public/registration')
      .send(validBody(seeded, { email: 'laura.pereyra@ejemplo.com', phone: '11 0000 1111' }));

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('replaced');
    const applicant = await findApplicant();
    expect(applicant.phone).toBe('11 0000 1111');
    expect(applicant.applications.every((a) => a.verified)).toBe(true);
    expect(applicant.events.map((e) => e.type)).toEqual(['REGISTRATION']);
  });

  it('puntaje distinto: guarda el anterior, desverifica, marca modificada y registra SCORE_CHANGE', async () => {
    const app = await createAndVerify();
    const [first, second] = seeded.positions;
    const res = await request(app)
      .post('/api/public/registration')
      .send(
        validBody(seeded, {
          applications: [
            { positionId: first.id, score: '40,10' },
            { positionId: second.id, score: '31.2' }, // igual que "31.20"
          ],
        }),
      );

    expect(res.status).toBe(200);
    const applicant = await findApplicant();
    const changed = applicant.applications.find((a) => a.positionId === first.id)!;
    const same = applicant.applications.find((a) => a.positionId === second.id)!;
    expect(changed.score.toString()).toBe('40.1');
    expect(changed.previousScore?.toString()).toBe('38.45');
    expect(changed.verified).toBe(false);
    expect(changed.modified).toBe(true);
    expect(same.verified).toBe(true);
    expect(same.modified).toBe(false);

    const events = applicant.events.filter((e) => e.type !== 'REGISTRATION');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('SCORE_CHANGE');
    expect(events[0].positionId).toBe(first.id);
    expect(events[0].detail).toEqual({ previous: '38.45', new: '40.10' });
  });

  it('puesto agregado y puesto quitado: crea sin verificar, borra y registra los eventos', async () => {
    const app = await createAndVerify();
    const [first, second, third] = seeded.positions;
    const res = await request(app)
      .post('/api/public/registration')
      .send(
        validBody(seeded, {
          applications: [
            { positionId: first.id, score: '38.45' },
            { positionId: third.id, score: '22,5' },
          ],
        }),
      );

    expect(res.status).toBe(200);
    expect(res.body.summary.applications).toEqual([
      { position: 'Matemática', score: '38.45' },
      { position: 'Historia', score: '22.50' },
    ]);
    const applicant = await findApplicant();
    expect(applicant.applications.map((a) => a.positionId).sort()).toEqual([first.id, third.id].sort());
    expect(applicant.applications.find((a) => a.positionId === third.id)!.verified).toBe(false);
    expect(applicant.applications.find((a) => a.positionId === first.id)!.verified).toBe(true);

    const events = applicant.events.filter((e) => e.type !== 'REGISTRATION');
    expect(events.map((e) => [e.type, e.positionId])).toEqual([
      ['POSITION_ADDED', third.id],
      ['POSITION_REMOVED', second.id],
    ]);
    expect(events[0].detail).toEqual({ score: '22.50' });
    expect(events[1].detail).toEqual({ score: '31.20' });
  });

  it('cambio de situación de revista o antigüedad: DATA_CHANGE y desverifica todo', async () => {
    const app = await createAndVerify();
    const res = await request(app)
      .post('/api/public/registration')
      .send(validBody(seeded, { employmentStatus: 'TITULAR', seniority: { years: 10, months: 0 } }));

    expect(res.status).toBe(200);
    const applicant = await findApplicant();
    expect(applicant.employmentStatus).toBe('TITULAR');
    expect(applicant.seniorityMonths).toBe(120);
    // Mismo puntaje, pero cambió un dato que define el orden: se desverifica igual.
    expect(applicant.applications.every((a) => !a.verified)).toBe(true);
    expect(applicant.applications.every((a) => !a.modified)).toBe(true);
    const dataChange = applicant.events.find((e) => e.type === 'DATA_CHANGE')!;
    expect(dataChange.detail).toEqual({
      previous: { employmentStatus: 'PROVISIONAL', seniorityMonths: 110 },
      new: { employmentStatus: 'TITULAR', seniorityMonths: 120 },
    });
  });

  it('no crea un segundo postulante al reenviar', async () => {
    const app = await createAndVerify();
    await request(app).post('/api/public/registration').send(validBody(seeded)).expect(200);
    expect(await prisma.applicant.count()).toBe(1);
  });
});

describe('POST /api/public/registration: 409 sin filtrar datos', () => {
  it('otro email y dado de baja devuelven exactamente el mismo cuerpo, solo {error, message}', async () => {
    const app = buildApp();
    await request(app).post('/api/public/registration').send(validBody(seeded)).expect(201);

    const otherEmail = await request(app)
      .post('/api/public/registration')
      .send(validBody(seeded, { email: 'otra.persona@ejemplo.com' }));

    await prisma.applicant.updateMany({ data: { deactivated: true } });
    const deactivated = await request(app).post('/api/public/registration').send(validBody(seeded));

    expect(otherEmail.status).toBe(409);
    expect(deactivated.status).toBe(409);
    expect(otherEmail.body).toEqual(deactivated.body);
    expect(Object.keys(otherEmail.body).sort()).toEqual(['error', 'message']);
    expect(otherEmail.body.error).toBe('DATA_MISMATCH');
    expect(otherEmail.body.message).toBe(
      'Ya existe una inscripción con ese DNI y los datos no coinciden. Si cambiaste de email, comunicate con la escuela.',
    );
    for (const res of [otherEmail, deactivated]) {
      const text = JSON.stringify(res.body).toLowerCase();
      expect(text).not.toContain('pereyra');
      expect(text).not.toContain('laura');
      expect(text).not.toContain('ejemplo.com');
    }
  });

  it('el 409 no modifica la inscripción existente', async () => {
    const app = buildApp();
    await request(app).post('/api/public/registration').send(validBody(seeded)).expect(201);
    await request(app)
      .post('/api/public/registration')
      .send(validBody(seeded, { email: 'otra@ejemplo.com', lastName: 'Intruso' }))
      .expect(409);
    const applicant = await findApplicant();
    expect(applicant.lastName).toBe('Pereyra');
    expect(applicant.email).toBe('laura.pereyra@ejemplo.com');
  });
});

describe('POST /api/public/registration: cerrada (403)', () => {
  it.each([
    ['antes del primer día', '2027-02-01T02:59:59Z'],
    ['después del último día', '2027-03-01T03:00:00Z'],
  ])('%s responde 403 REGISTRATION_CLOSED', async (_name, instant) => {
    const app = buildApp({ now: () => new Date(instant) });
    const res = await request(app).post('/api/public/registration').send(validBody(seeded));
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('REGISTRATION_CLOSED');
    expect(await prisma.applicant.count()).toBe(0);
  });

  it('el último día sigue abierta hasta las 23:59:59 argentinas', async () => {
    const app = buildApp({ now: () => new Date('2027-03-01T02:59:59Z') });
    await request(app).post('/api/public/registration').send(validBody(seeded)).expect(201);
  });

  it('sin ciclo activo responde 403 aunque el cuerpo sea inválido', async () => {
    await resetDatabase();
    const res = await request(buildApp()).post('/api/public/registration').send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('REGISTRATION_CLOSED');
  });
});

describe('POST /api/public/registration: validación (400)', () => {
  it('puesto repetido: error en applications.N.positionId de la fila repetida', async () => {
    const id = seeded.positions[0].id;
    const res = await request(buildApp())
      .post('/api/public/registration')
      .send(
        validBody(seeded, {
          applications: [
            { positionId: id, score: '38,45' },
            { positionId: seeded.positions[1].id, score: '30' },
            { positionId: id, score: '20' },
          ],
        }),
      );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.fields).toEqual({ 'applications.2.positionId': 'Esta materia ya está en tu lista.' });
    expect(await prisma.applicant.count()).toBe(0);
  });

  it('puesto inexistente o inactivo: error en la fila correspondiente', async () => {
    const inactive = await prisma.position.create({
      data: { name: 'Biología', type: 'ASIGNATURA', active: false },
    });
    const res = await request(buildApp())
      .post('/api/public/registration')
      .send(
        validBody(seeded, {
          applications: [
            { positionId: seeded.positions[0].id, score: '38' },
            { positionId: inactive.id, score: '30' },
            { positionId: 99999, score: '30' },
          ],
        }),
      );
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields).sort()).toEqual([
      'applications.1.positionId',
      'applications.2.positionId',
    ]);
    expect(await prisma.applicant.count()).toBe(0);
  });

  it('puntaje inválido y datos fuera de rango: claves por campo', async () => {
    const res = await request(buildApp())
      .post('/api/public/registration')
      .send(
        validBody(seeded, {
          dni: '123',
          email: 'no-es-email',
          phone: '123',
          lastName: '   ',
          seniority: { years: 61, months: 12 },
          shifts: [],
          applications: [
            { positionId: seeded.positions[0].id, score: '38,45' },
            { positionId: seeded.positions[1].id, score: '1000' },
          ],
          declaration: false,
        }),
      );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(Object.keys(res.body.fields).sort()).toEqual(
      [
        'applications.1.score',
        'declaration',
        'dni',
        'email',
        'lastName',
        'phone',
        'seniority.months',
        'seniority.years',
        'shifts',
      ].sort(),
    );
    expect(typeof res.body.message).toBe('string');
  });

  it('puntaje con más de 2 decimales o negativo se rechaza', async () => {
    for (const score of ['38.456', '-1']) {
      const res = await request(buildApp())
        .post('/api/public/registration')
        .send(validBody(seeded, { applications: [{ positionId: seeded.positions[0].id, score }] }));
      expect(res.status).toBe(400);
      expect(res.body.fields['applications.0.score']).toBeDefined();
    }
  });

  it('turnos repetidos y lista de materias vacía se rechazan', async () => {
    const res = await request(buildApp())
      .post('/api/public/registration')
      .send(validBody(seeded, { shifts: ['TARDE', 'TARDE'], applications: [] }));
    expect(res.status).toBe(400);
    expect(res.body.fields.shifts).toBeDefined();
    expect(res.body.fields.applications).toBeDefined();
  });

  it('JSON mal formado: 400 VALIDATION_ERROR con el sobre común (nunca HTML)', async () => {
    const res = await request(buildApp())
      .post('/api/public/registration')
      .set('Content-Type', 'application/json')
      .send('{"dni": ');
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(typeof res.body.message).toBe('string');
  });
});

describe('API: otras rutas', () => {
  it('GET /api/health responde ok con la base conectada', async () => {
    const res = await request(buildApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('una ruta desconocida responde 404 NOT_FOUND en JSON', async () => {
    const res = await request(buildApp()).get('/api/nada');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});

describe('POST /api/public/registration: rate limit', () => {
  it('después del límite responde 429 TOO_MANY_REQUESTS con el sobre común', async () => {
    const app = buildApp({ registrationRateLimit: { limit: 2, windowMs: 60_000 } });
    const send = () => request(app).post('/api/public/registration').send(validBody(seeded));

    expect((await send()).status).toBe(201);
    expect((await send()).status).toBe(200);
    const limited = await send();
    expect(limited.status).toBe(429);
    expect(limited.body.error).toBe('TOO_MANY_REQUESTS');
    expect(typeof limited.body.message).toBe('string');
    expect(limited.headers['ratelimit-limit']).toBeDefined();
  });

  it('el GET /status no cuenta para el límite', async () => {
    const app = buildApp({ registrationRateLimit: { limit: 1, windowMs: 60_000 } });
    for (let i = 0; i < 3; i++) {
      await request(app).get('/api/public/status').expect(200);
    }
  });
});

describe('POST /api/public/registration: transacción', () => {
  it('si falla a mitad del reemplazo no queda nada a medias', async () => {
    const app = buildApp();
    await request(app).post('/api/public/registration').send(validBody(seeded)).expect(201);
    const before = await findApplicant();

    // Fuerza un fallo en el último paso del reemplazo (el historial) con un trigger temporal.
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION fail_event_insert() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'fallo forzado por el test'; END; $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER fail_event_insert BEFORE INSERT ON "event" FOR EACH ROW EXECUTE FUNCTION fail_event_insert()`,
    );
    try {
      const res = await request(app)
        .post('/api/public/registration')
        .send(
          validBody(seeded, {
            email: 'laura.pereyra@ejemplo.com',
            phone: '11 9999 9999',
            applications: [{ positionId: seeded.positions[0].id, score: '50' }],
          }),
        );
      expect(res.status).toBe(500);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS fail_event_insert ON "event"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS fail_event_insert()`);
    }

    const after = await findApplicant();
    expect(after.phone).toBe(before.phone);
    expect(after.applications.map((a) => [a.positionId, a.score.toString()])).toEqual(
      before.applications.map((a) => [a.positionId, a.score.toString()]),
    );
    expect(after.events).toHaveLength(before.events.length);
  });
});
