import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router, type CookieOptions, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../../db';
import { normalizeEmail } from '../../domain/normalize';
import { sendError } from '../errors';
import { parseBody } from './http';
import { hashToken, SESSION_COOKIE, type SessionAdmin } from './require-session';

// Login, logout y sesión del panel. Una sola usuaria; sesión de 7 días sin renovación.

export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
/** 5 intentos fallidos cada 15 minutos por IP. */
export const DEFAULT_LOGIN_RATE_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };

const BCRYPT_COST = 12; // el mismo costo que usa `pnpm create-admin`

// Hash ficticio: si el email no existe igual se corre bcrypt, para no revelar por tiempo
// si el email está registrado. Se calcula una vez, al cargar el módulo.
const dummyHash = bcrypt.hash(randomBytes(16).toString('hex'), BCRYPT_COST);

const loginSchema = z.object({
  email: z
    .string({ error: 'Ingresá tu email.' })
    .transform(normalizeEmail)
    .pipe(z.string().min(1, 'Ingresá tu email.').max(254, 'El email es demasiado largo.')),
  password: z
    .string({ error: 'Ingresá tu contraseña.' })
    .min(1, 'Ingresá tu contraseña.')
    .max(200, 'La contraseña es demasiado larga.'),
});

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
    path: '/',
  };
}

export interface AuthRouterOptions {
  now: () => Date;
  /** Límite de intentos fallidos por IP. `false` lo desactiva. */
  loginRateLimit: { limit: number; windowMs: number } | false;
}

/** Rutas públicas del panel: login y logout. */
export function createAuthRouter(options: AuthRouterOptions): Router {
  const router = Router();

  // Solo cuentan los intentos fallidos (status >= 400): un login correcto no gasta intentos.
  const loginLimiter: RequestHandler = options.loginRateLimit
    ? rateLimit({
        ...options.loginRateLimit,
        skipSuccessfulRequests: true,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req, res) =>
          sendError(
            res,
            429,
            'TOO_MANY_REQUESTS',
            'Hiciste demasiados intentos seguidos. Esperá un rato antes de intentar de nuevo.',
          ),
      })
    : (_req, _res, next) => next();

  router.post('/login', loginLimiter, async (req, res) => {
    const body = parseBody(loginSchema, req, res);
    if (!body) return;

    const admin = await prisma.admin.findUnique({ where: { email: body.email } });
    const matches = await bcrypt.compare(body.password, admin?.passwordHash ?? (await dummyHash));
    if (!admin || !matches) {
      sendError(res, 401, 'INVALID_CREDENTIALS', 'Email o contraseña incorrectos');
      return;
    }

    const now = options.now();
    const token = randomBytes(32).toString('base64url');
    await prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        adminId: admin.id,
        expiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
      },
    });
    // Limpieza oportunista de sesiones vencidas.
    await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });

    res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_DURATION_MS });
    res.status(204).end();
  });

  // Funciona aunque no haya sesión: siempre borra la cookie y responde 204.
  router.post('/logout', async (req, res) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string' && token !== '') {
      await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
    }
    res.clearCookie(SESSION_COOKIE, cookieOptions());
    res.status(204).end();
  });

  return router;
}

/** `GET /session`: va después de `requireSession`. */
export const getSession: RequestHandler = (_req, res) => {
  const admin = res.locals['admin'] as SessionAdmin;
  res.json({ email: admin.email });
};
