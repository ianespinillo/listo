import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../db';
import { resetDatabase, seedCycle, type SeededCycle } from '../../test/db-helpers';
import { buildApp, createApplicant, setupPanel, type Agent } from '../../test/panel-helpers';

let seeded: SeededCycle;
let app: ReturnType<typeof buildApp>;
let agent: Agent;
let math: number;
let language: number;

beforeEach(async () => {
  await resetDatabase();
  seeded = await seedCycle();
  math = seeded.positions[0].id;
  language = seeded.positions[1].id;
  ({ app, agent } = await setupPanel());
});

/** Inscripción por la API pública (como la haría un docente). */
function registrationBody(overrides: Record<string, unknown> = {}) {
  return {
    dni: '28.123.456',
    lastName: 'Pereyra',
    firstName: 'Laura Inés',
    email: 'laura@ejemplo.com',
    phone: '11 5544 0921',
    employmentStatus: 'PROVISIONAL',
    seniority: { years: 9, months: 2 },
    shifts: ['MANANA', 'TARDE'],
    applications: [
      { positionId: math, score: '38,45' },
      { positionId: language, score: '31.20' },
    ],
    declaration: true,
    ...overrides,
  };
}

async function register(overrides: Record<string, unknown> = {}) {
  const res = await request(app).post('/api/public/registration').send(registrationBody(overrides));
  expect([200, 201]).toContain(res.status);
  return prisma.applicant.findFirstOrThrow({ where: { dni: '28123456' } });
}

function eventTypes(applicantId: number) {
  return prisma.historyEvent
    .findMany({ where: { applicantId }, orderBy: { id: 'asc' } })
    .then((events) => events.map((event) => event.type));
}

describe('GET /api/panel/applicants/:id', () => {
  it('devuelve los datos con email, deactivated, ciclo, postulaciones (con grupo y orden) e historial', async () => {
    const applicant = await register();
    // Otros dos docentes en Matemática para que el orden no sea trivial.
    await createApplicant(seeded.cycleId, { employmentStatus: 'TITULAR', lastName: 'Titular' }, [
      { positionId: math, score: '1' },
    ]);
    await createApplicant(seeded.cycleId, { employmentStatus: 'PROVISIONAL', lastName: 'Alta' }, [
      { positionId: math, score: '60' },
    ]);

    const res = await agent.get(`/api/panel/applicants/${applicant.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: applicant.id,
      dni: '28123456',
      lastName: 'Pereyra',
      firstName: 'Laura Inés',
      email: 'laura@ejemplo.com',
      phone: '11 5544 0921',
      employmentStatus: 'PROVISIONAL',
      seniorityMonths: 110,
      shifts: ['MANANA', 'TARDE'],
      deactivated: false,
      cycle: { id: seeded.cycleId, year: 2027 },
    });
    // Postulaciones por nombre de puesto: Lengua, Matemática.
    expect(res.body.applications).toEqual([
      {
        position: { id: language, name: 'Lengua', type: 'ASIGNATURA', active: true },
        score: '31.20',
        previousScore: null,
        status: 'UNVERIFIED',
        group: 2,
        order: 1,
      },
      {
        position: { id: math, name: 'Matemática', type: 'ASIGNATURA', active: true },
        score: '38.45',
        previousScore: null,
        status: 'UNVERIFIED',
        group: 2,
        order: 3, // titular, "Alta" (60) y recién ahí ella (38,45)
      },
    ]);
    expect(res.body.history).toEqual([
      { date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/), type: 'REGISTRATION', position: null, detail: null },
    ]);
  });

  it('el grupo y el orden del detalle coinciden con los del listado', async () => {
    const applicant = await register();
    await createApplicant(seeded.cycleId, { employmentStatus: 'TITULAR', seniorityMonths: 400 }, [
      { positionId: math, score: '1' },
    ]);
    await createApplicant(seeded.cycleId, { employmentStatus: 'SUPLENTE', seniorityMonths: 10 }, [
      { positionId: math, score: '70' },
    ]);

    const detail = await agent.get(`/api/panel/applicants/${applicant.id}`);
    const inMath = detail.body.applications.find((a: { position: { id: number } }) => a.position.id === math);
    const listing = await agent.get(`/api/panel/listing?positionId=${math}`);
    const row = listing.body.groups
      .flatMap((g: { rows: { applicantId: number; order: number }[] }) => g.rows)
      .find((r: { applicantId: number }) => r.applicantId === applicant.id);

    expect(row.order).toBe(3);
    expect(inMath.order).toBe(row.order);
    expect(inMath.group).toBe(2);
  });

  it('el orden no depende de los filtros del listado: se calcula sin filtros', async () => {
    const applicant = await register({ shifts: ['TARDE'] });
    await createApplicant(seeded.cycleId, { employmentStatus: 'TITULAR', shifts: ['MANANA'] }, [
      { positionId: math, score: '1' },
    ]);
    const res = await agent.get(`/api/panel/applicants/${applicant.id}`);
    const inMath = res.body.applications.find((a: { position: { id: number } }) => a.position.id === math);
    expect(inMath.order).toBe(2);
  });

  it('el historial viene del más nuevo al más viejo, con el nombre del puesto', async () => {
    const applicant = await register();
    await agent.put(`/api/panel/applicants/${applicant.id}/applications/${math}/verification`).send({ verified: true });
    await agent.put(`/api/panel/applicants/${applicant.id}/applications/${math}/verification`).send({ verified: false });

    const res = await agent.get(`/api/panel/applicants/${applicant.id}`);
    expect(res.body.history.map((h: { type: string }) => h.type)).toEqual([
      'UNVERIFICATION',
      'VERIFICATION',
      'REGISTRATION',
    ]);
    expect(res.body.history[0].position).toBe('Matemática');
    expect(res.body.history[2].position).toBeNull();
    const dates = res.body.history.map((h: { date: string }) => new Date(h.date).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it('un postulante dado de baja o de un ciclo archivado tiene group y order null', async () => {
    const applicant = await register();
    await agent.post(`/api/panel/applicants/${applicant.id}/deactivate`).send({}).expect(204);
    const deactivated = await agent.get(`/api/panel/applicants/${applicant.id}`);
    expect(deactivated.body.deactivated).toBe(true);
    for (const application of deactivated.body.applications) {
      expect(application.group).toBeNull();
      expect(application.order).toBeNull();
    }

    const old = await prisma.cycle.create({
      data: {
        year: 2026,
        registrationFrom: new Date('2026-02-01T00:00:00Z'),
        registrationUntil: new Date('2026-02-28T00:00:00Z'),
      },
    });
    const archived = await createApplicant(old.id, {}, [{ positionId: math, score: '10' }]);
    const res = await agent.get(`/api/panel/applicants/${archived.id}`);
    expect(res.body.cycle).toEqual({ id: old.id, year: 2026 });
    expect(res.body.applications[0]).toMatchObject({ group: null, order: null });
  });

  it('un id inexistente o inválido responde 404 NOT_FOUND', async () => {
    for (const id of ['9999', 'abc', '0']) {
      const res = await agent.get(`/api/panel/applicants/${id}`);
      expect(res.status, id).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    }
  });
});

describe('PATCH /api/panel/applicants/:id (email)', () => {
  it('normaliza el email, responde 200 con el postulante y registra EMAIL_CHANGE sin el email anterior', async () => {
    const applicant = await register();
    const res = await agent.patch(`/api/panel/applicants/${applicant.id}`).send({ email: '  Nuevo.Mail@Ejemplo.COM ' });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('nuevo.mail@ejemplo.com');
    expect(res.body.id).toBe(applicant.id);
    expect(res.body.history[0]).toMatchObject({ type: 'EMAIL_CHANGE', position: null, detail: null });

    const events = await prisma.historyEvent.findMany({ where: { applicantId: applicant.id, type: 'EMAIL_CHANGE' } });
    expect(events).toHaveLength(1);
    expect(events[0].detail).toBeNull();
    expect(JSON.stringify(events)).not.toContain('laura@ejemplo.com');
    expect((await prisma.applicant.findUniqueOrThrow({ where: { id: applicant.id } })).email).toBe('nuevo.mail@ejemplo.com');
  });

  it('el email no es único entre postulantes', async () => {
    const applicant = await register();
    await createApplicant(seeded.cycleId, { email: 'compartido@ejemplo.com' });
    const res = await agent.patch(`/api/panel/applicants/${applicant.id}`).send({ email: 'compartido@ejemplo.com' });
    expect(res.status).toBe(200);
  });

  it('si el email no cambia no registra un evento nuevo', async () => {
    const applicant = await register();
    await agent.patch(`/api/panel/applicants/${applicant.id}`).send({ email: 'laura@ejemplo.com' }).expect(200);
    expect(await eventTypes(applicant.id)).toEqual(['REGISTRATION']);
  });

  it('un email inválido o ausente responde 400 con fields.email', async () => {
    const applicant = await register();
    for (const body of [{ email: 'no-es-un-email' }, {}, { email: 5 }]) {
      const res = await agent.patch(`/api/panel/applicants/${applicant.id}`).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.fields).toHaveProperty('email');
    }
    expect(await eventTypes(applicant.id)).toEqual(['REGISTRATION']);
  });

  it('un postulante inexistente responde 404', async () => {
    const res = await agent.patch('/api/panel/applicants/9999').send({ email: 'a@b.com' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});

describe('POST /api/panel/applicants/:id/deactivate y reactivate', () => {
  it('dar de baja lo saca del listado, registra DEACTIVATION y reactivar lo devuelve con REACTIVATION', async () => {
    const applicant = await register();
    const inListing = async () => {
      const res = await agent.get(`/api/panel/listing?positionId=${math}`);
      return res.body.summary.total as number;
    };
    expect(await inListing()).toBe(1);

    await agent.post(`/api/panel/applicants/${applicant.id}/deactivate`).send({}).expect(204);
    expect(await inListing()).toBe(0);
    expect((await prisma.applicant.findUniqueOrThrow({ where: { id: applicant.id } })).deactivated).toBe(true);

    await agent.post(`/api/panel/applicants/${applicant.id}/reactivate`).send({}).expect(204);
    expect(await inListing()).toBe(1);
    expect(await eventTypes(applicant.id)).toEqual(['REGISTRATION', 'DEACTIVATION', 'REACTIVATION']);
  });

  it('son idempotentes: repetir no duplica eventos', async () => {
    const applicant = await register();
    await agent.post(`/api/panel/applicants/${applicant.id}/reactivate`).send({}).expect(204);
    await agent.post(`/api/panel/applicants/${applicant.id}/deactivate`).send({}).expect(204);
    await agent.post(`/api/panel/applicants/${applicant.id}/deactivate`).send({}).expect(204);
    expect(await eventTypes(applicant.id)).toEqual(['REGISTRATION', 'DEACTIVATION']);
  });

  it('un dado de baja que se vuelve a inscribir recibe DATA_MISMATCH (no se rompe el contrato público)', async () => {
    const applicant = await register();
    await agent.post(`/api/panel/applicants/${applicant.id}/deactivate`).send({}).expect(204);
    const res = await request(app).post('/api/public/registration').send(registrationBody());
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('DATA_MISMATCH');
  });

  it('un postulante inexistente responde 404', async () => {
    for (const action of ['deactivate', 'reactivate']) {
      const res = await agent.post(`/api/panel/applicants/9999/${action}`).send({});
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    }
  });
});

describe('PUT /api/panel/applicants/:id/applications/:positionId/verification', () => {
  const url = (applicantId: number, positionId: number) =>
    `/api/panel/applicants/${applicantId}/applications/${positionId}/verification`;

  it('verificar setea verifiedAt, devuelve la postulación VERIFIED y registra VERIFICATION con el puesto', async () => {
    const applicant = await register();
    const before = Date.now();
    const res = await agent.put(url(applicant.id, math)).send({ verified: true });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      position: { id: math, name: 'Matemática', type: 'ASIGNATURA', active: true },
      score: '38.45',
      previousScore: null,
      status: 'VERIFIED',
      group: 2,
      order: 1,
    });
    const stored = await prisma.application.findUniqueOrThrow({
      where: { applicantId_positionId: { applicantId: applicant.id, positionId: math } },
    });
    expect(stored.verified).toBe(true);
    expect(stored.verifiedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);

    const event = await prisma.historyEvent.findFirstOrThrow({
      where: { applicantId: applicant.id, type: 'VERIFICATION' },
    });
    expect(event.positionId).toBe(math);
  });

  it('verificar limpia modified y previousScore (puntaje cambiado por reemplazo público)', async () => {
    const applicant = await register();
    await agent.put(url(applicant.id, math)).send({ verified: true }).expect(200);

    // El docente reenvía con otro puntaje: queda sin verificar, modificada y con el puntaje previo.
    await register({
      applications: [
        { positionId: math, score: '40,00' },
        { positionId: language, score: '31.20' },
      ],
    });
    const modified = await agent.get(`/api/panel/applicants/${applicant.id}`);
    const inMath = modified.body.applications.find((a: { position: { id: number } }) => a.position.id === math);
    expect(inMath).toMatchObject({ score: '40.00', previousScore: '38.45', status: 'MODIFIED' });

    const res = await agent.put(url(applicant.id, math)).send({ verified: true });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ score: '40.00', previousScore: null, status: 'VERIFIED' });

    const stored = await prisma.application.findUniqueOrThrow({
      where: { applicantId_positionId: { applicantId: applicant.id, positionId: math } },
    });
    expect(stored).toMatchObject({ verified: true, modified: false, previousScore: null });
    expect(stored.verifiedAt).not.toBeNull();
  });

  it('quitar la verificación pone verified=false, verifiedAt null y registra UNVERIFICATION', async () => {
    const applicant = await register();
    await agent.put(url(applicant.id, math)).send({ verified: true }).expect(200);
    const res = await agent.put(url(applicant.id, math)).send({ verified: false });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UNVERIFIED');
    const stored = await prisma.application.findUniqueOrThrow({
      where: { applicantId_positionId: { applicantId: applicant.id, positionId: math } },
    });
    expect(stored).toMatchObject({ verified: false, verifiedAt: null });
    expect(await eventTypes(applicant.id)).toEqual(['REGISTRATION', 'VERIFICATION', 'UNVERIFICATION']);
  });

  it('es idempotente: si el estado no cambia no registra evento', async () => {
    const applicant = await register();
    await agent.put(url(applicant.id, math)).send({ verified: false }).expect(200);
    await agent.put(url(applicant.id, math)).send({ verified: true }).expect(200);
    await agent.put(url(applicant.id, math)).send({ verified: true }).expect(200);
    expect(await eventTypes(applicant.id)).toEqual(['REGISTRATION', 'VERIFICATION']);
  });

  it('verificar una postulación no toca las otras del mismo postulante', async () => {
    const applicant = await register();
    await agent.put(url(applicant.id, math)).send({ verified: true }).expect(200);
    const other = await prisma.application.findUniqueOrThrow({
      where: { applicantId_positionId: { applicantId: applicant.id, positionId: language } },
    });
    expect(other.verified).toBe(false);
  });

  it('verified que no es booleano responde 400 VALIDATION_ERROR', async () => {
    const applicant = await register();
    for (const body of [{}, { verified: 'true' }, { verified: 1 }]) {
      const res = await agent.put(url(applicant.id, math)).send(body);
      expect(res.status).toBe(400);
      expect(res.body.fields).toHaveProperty('verified');
    }
  });

  it('postulante o postulación inexistente responde 404', async () => {
    const applicant = await register();
    const historia = seeded.positions[2].id; // no se postuló a Historia
    for (const target of [url(9999, math), url(applicant.id, historia), url(applicant.id, 9999)]) {
      const res = await agent.put(target).send({ verified: true });
      expect(res.status, target).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    }
  });
});
