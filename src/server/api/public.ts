import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { prisma } from '../db';
import { isRegistrationOpen, toDateString } from '../domain/registration-window';
import { DATA_MISMATCH_MESSAGE, sendError } from './errors';
import { registrationSchema, toFieldErrors } from './registration-schema';
import { findOpenCycle, register } from './registration-service';

export interface PublicRouterOptions {
  now: () => Date;
  /** Límite de envíos por IP. `false` lo desactiva. */
  registrationRateLimit: { limit: number; windowMs: number } | false;
}

export const DEFAULT_REGISTRATION_RATE_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 };

export function createPublicRouter(options: PublicRouterOptions): Router {
  const router = Router();

  router.get('/status', async (_req, res, next) => {
    try {
      const cycle = await prisma.cycle.findFirst({ where: { active: true } });
      const school = {
        name: process.env['SCHOOL_NAME'] ?? '',
        contact: process.env['SCHOOL_CONTACT'] ?? '',
      };
      if (!cycle) {
        res.json({ cycle: null, open: false, school, positions: [] });
        return;
      }
      const open = isRegistrationOpen(cycle, options.now());
      const positions = await prisma.position.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, type: true },
      });
      res.json({
        cycle: {
          year: cycle.year,
          registrationFrom: toDateString(cycle.registrationFrom),
          registrationUntil: toDateString(cycle.registrationUntil),
        },
        open,
        school,
        positions,
      });
    } catch (error) {
      next(error);
    }
  });

  const registrationLimiter = options.registrationRateLimit
    ? rateLimit({
        ...options.registrationRateLimit,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req, res) =>
          sendError(
            res,
            429,
            'TOO_MANY_REQUESTS',
            'Hiciste demasiados envíos seguidos. Esperá un rato antes de intentar de nuevo.',
          ),
      })
    : (_req: unknown, _res: unknown, next: () => void) => next();

  router.post('/registration', registrationLimiter, async (req, res, next) => {
    try {
      const now = options.now();

      // 403 primero: sin ciclo activo o fuera de plazo no se mira nada más.
      if (!(await findOpenCycle(prisma, now))) {
        sendError(res, 403, 'REGISTRATION_CLOSED', 'La inscripción está cerrada.');
        return;
      }

      const parsed = registrationSchema.safeParse(req.body);
      if (!parsed.success) {
        sendError(
          res,
          400,
          'VALIDATION_ERROR',
          'Revisá los datos marcados e intentá de nuevo.',
          toFieldErrors(parsed.error),
        );
        return;
      }

      const outcome = await register(parsed.data, now);
      switch (outcome.kind) {
        case 'closed':
          sendError(res, 403, 'REGISTRATION_CLOSED', 'La inscripción está cerrada.');
          return;
        case 'invalid':
          sendError(
            res,
            400,
            'VALIDATION_ERROR',
            'Revisá los datos marcados e intentá de nuevo.',
            outcome.fields,
          );
          return;
        case 'mismatch':
          // Mismo cuerpo para "otro email" y "dado de baja": no se revela el motivo.
          sendError(res, 409, 'DATA_MISMATCH', DATA_MISMATCH_MESSAGE);
          return;
        case 'created':
          res.status(201).json({ result: 'created', summary: outcome.summary });
          return;
        case 'replaced':
          res.status(200).json({ result: 'replaced', summary: outcome.summary });
          return;
      }
    } catch (error) {
      next(error);
    }
  });

  return router;
}
