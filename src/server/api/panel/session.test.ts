import { createHash } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../db';
import { resetDatabase } from '../../test/db-helpers';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  buildApp,
  createAdmin,
  OPEN_NOW,
  setupPanel,
} from '../../test/panel-helpers';

beforeEach(async () => {
  await resetDatabase();
});

const loginBody = { email: ADMIN_EMAIL, password: ADMIN_PASSWORD };

function setCookies(res: request.Response): string[] {
  const header = res.headers['set-cookie'] as unknown;
  return Array.isArray(header) ? (header as string[]) : header ? [String(header)] : [];
}

describe('POST /api/panel/login', () => {
  it('con credenciales correctas responde 204, crea la sesión y manda la cookie con sus flags', async () => {
    await createAdmin();
    const res = await request(buildApp()).post('/api/panel/login').send(loginBody);

    expect(res.status).toBe(204);
    const cookie = setCookies(res).find((c) => c.startsWith('listo_session='));
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//i);
    expect(cookie).toMatch(/Max-Age=604800/i);
    expect(cookie).not.toMatch(/Secure/i);

    // En la base va el SHA-256 del token, nunca el token.
    const token = decodeURIComponent(/^listo_session=([^;]+)/.exec(cookie as string)![1]);
    const sessions = await prisma.session.findMany();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(sessions[0].tokenHash).not.toBe(token);
    expect(sessions[0].expiresAt.getTime()).toBe(OPEN_NOW.getTime() + 7 * 24 * 60 * 60 * 1000);
  });

  it('en producción la cookie es secure', async () => {
    await createAdmin();
    const previous = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      const res = await request(buildApp()).post('/api/panel/login').send(loginBody);
      expect(res.status).toBe(204);
      expect(setCookies(res)[0]).toMatch(/Secure/i);
    } finally {
      process.env['NODE_ENV'] = previous;
    }
  });

  it('normaliza el email antes de buscarlo', async () => {
    await createAdmin();
    const res = await request(buildApp())
      .post('/api/panel/login')
      .send({ email: '  Directora@ESCUELA.test ', password: ADMIN_PASSWORD });
    expect(res.status).toBe(204);
  });

  it('contraseña incorrecta y email desconocido dan exactamente la misma respuesta 401', async () => {
    await createAdmin();
    const app = buildApp();
    const wrongPassword = await request(app)
      .post('/api/panel/login')
      .send({ email: ADMIN_EMAIL, password: 'otra-clave-1' });
    const unknownEmail = await request(app)
      .post('/api/panel/login')
      .send({ email: 'nadie@escuela.test', password: ADMIN_PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual({
      error: 'INVALID_CREDENTIALS',
      message: 'Email o contraseña incorrectos',
    });
    expect(unknownEmail.body).toEqual(wrongPassword.body);
    expect(setCookies(wrongPassword)).toEqual([]);
    expect(await prisma.session.count()).toBe(0);
  });

  it('sin email o sin contraseña responde 400 VALIDATION_ERROR con fields', async () => {
    const res = await request(buildApp()).post('/api/panel/login').send({ email: ADMIN_EMAIL });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.fields).toHaveProperty('password');
  });

  it('el rate limit corta después del límite de intentos fallidos', async () => {
    await createAdmin();
    const app = buildApp({ loginRateLimit: { limit: 2, windowMs: 60_000 } });
    const wrong = { email: ADMIN_EMAIL, password: 'otra-clave-1' };

    expect((await request(app).post('/api/panel/login').send(wrong)).status).toBe(401);
    expect((await request(app).post('/api/panel/login').send(wrong)).status).toBe(401);
    const blocked = await request(app).post('/api/panel/login').send(wrong);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe('TOO_MANY_REQUESTS');
    // Bloqueada la IP, tampoco entra con la contraseña correcta.
    expect((await request(app).post('/api/panel/login').send(loginBody)).status).toBe(429);
  });

  it('los logins correctos no gastan intentos del rate limit', async () => {
    await createAdmin();
    const app = buildApp({ loginRateLimit: { limit: 2, windowMs: 60_000 } });
    for (let i = 0; i < 4; i += 1) {
      expect((await request(app).post('/api/panel/login').send(loginBody)).status).toBe(204);
    }
    const wrong = { email: ADMIN_EMAIL, password: 'otra-clave-1' };
    expect((await request(app).post('/api/panel/login').send(wrong)).status).toBe(401);
    expect((await request(app).post('/api/panel/login').send(wrong)).status).toBe(401);
    expect((await request(app).post('/api/panel/login').send(wrong)).status).toBe(429);
  });
});

describe('GET /api/panel/session y POST /api/panel/logout', () => {
  it('con sesión devuelve el email', async () => {
    const { agent } = await setupPanel();
    const res = await agent.get('/api/panel/session');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ email: ADMIN_EMAIL });
  });

  it('logout responde 204, borra la fila de la sesión y limpia la cookie', async () => {
    const { agent } = await setupPanel();
    expect(await prisma.session.count()).toBe(1);

    const res = await agent.post('/api/panel/logout').send({});
    expect(res.status).toBe(204);
    expect(await prisma.session.count()).toBe(0);
    expect(setCookies(res).find((c) => c.startsWith('listo_session='))).toMatch(/^listo_session=;/);

    const after = await agent.get('/api/panel/session');
    expect(after.status).toBe(401);
    expect(after.body.error).toBe('UNAUTHENTICATED');
  });

  it('logout funciona aunque no haya sesión', async () => {
    const res = await request(buildApp()).post('/api/panel/logout').send({});
    expect(res.status).toBe(204);
  });

  it('con un token que no existe en la base responde 401', async () => {
    const res = await request(buildApp())
      .get('/api/panel/session')
      .set('Cookie', 'listo_session=token-inventado');
    expect(res.status).toBe(401);
  });

  it('una sesión vencida se rechaza con 401 y se borra', async () => {
    await createAdmin();
    const login = await request(buildApp()).post('/api/panel/login').send(loginBody).expect(204);
    const cookie = setCookies(login)[0].split(';')[0];
    expect(await prisma.session.count()).toBe(1);

    // Ocho días después (la sesión dura siete).
    const later = buildApp({ now: () => new Date(OPEN_NOW.getTime() + 8 * 24 * 60 * 60 * 1000) });
    const res = await request(later).get('/api/panel/session').set('Cookie', cookie);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHENTICATED');
    expect(await prisma.session.count()).toBe(0);
  });
});

describe('protección de /api/panel/*', () => {
  const routes: [method: 'get' | 'post' | 'put' | 'patch', path: string][] = [
    ['get', '/api/panel/session'],
    ['get', '/api/panel/listing'],
    ['get', '/api/panel/applicants/1'],
    ['patch', '/api/panel/applicants/1'],
    ['post', '/api/panel/applicants/1/deactivate'],
    ['post', '/api/panel/applicants/1/reactivate'],
    ['put', '/api/panel/applicants/1/applications/1/verification'],
    ['get', '/api/panel/positions'],
    ['post', '/api/panel/positions'],
    ['patch', '/api/panel/positions/1'],
    ['get', '/api/panel/cycles'],
    ['post', '/api/panel/cycles'],
    ['patch', '/api/panel/cycles/1'],
  ];

  it.each(routes)('%s %s sin cookie responde 401 UNAUTHENTICATED', async (method, path) => {
    const res = await request(buildApp())[method](path).send({});
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHENTICATED');
  });

  it('una ruta del panel que no existe también exige sesión', async () => {
    const res = await request(buildApp()).get('/api/panel/no-existe');
    expect(res.status).toBe(401);
  });
});

describe('guarda de Content-Type', () => {
  it('un pedido que modifica datos con text/plain responde 415 UNSUPPORTED_MEDIA_TYPE', async () => {
    const { agent } = await setupPanel();
    const res = await agent.post('/api/panel/positions').type('text/plain').send('{"name":"X","type":"CARGO"}');
    expect(res.status).toBe(415);
    expect(res.body.error).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(await prisma.session.count()).toBe(1);
  });

  it('también lo exigen las rutas sin cuerpo y el login', async () => {
    const { agent } = await setupPanel();
    const deactivate = await agent.post('/api/panel/applicants/1/deactivate').type('text/plain').send('');
    expect(deactivate.status).toBe(415);
    const login = await request(buildApp()).post('/api/panel/login').type('form').send(loginBody);
    expect(login.status).toBe(415);
  });

  it('un pedido sin Content-Type tampoco pasa, pero los GET no lo necesitan', async () => {
    const { agent } = await setupPanel();
    expect((await agent.post('/api/panel/applicants/1/deactivate')).status).toBe(415);
    expect((await agent.get('/api/panel/session')).status).toBe(200);
  });

  it('acepta application/json con charset', async () => {
    const { agent } = await setupPanel();
    const res = await agent
      .post('/api/panel/logout')
      .set('Content-Type', 'application/json; charset=utf-8')
      .send('{}');
    expect(res.status).toBe(204);
  });
});
