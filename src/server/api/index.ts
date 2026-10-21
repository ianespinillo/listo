import express, { Router, type ErrorRequestHandler } from 'express';
import { prisma } from '../db';
import { sendError } from './errors';
import {
  createPublicRouter,
  DEFAULT_REGISTRATION_RATE_LIMIT,
  type PublicRouterOptions,
} from './public';

export interface ApiRouterOptions {
  /** Reloj inyectable (los tests lo usan para simular fechas). */
  now?: () => Date;
  /** Límite de envíos del formulario. `false` lo desactiva. Por defecto, 10 por hora por IP. */
  registrationRateLimit?: PublicRouterOptions['registrationRateLimit'];
}

const handleErrors: ErrorRequestHandler = (error, _req, res, _next) => {
  const type = (error as { type?: string } | null)?.type;
  if (type === 'entity.parse.failed' || type === 'entity.too.large') {
    sendError(
      res,
      400,
      'VALIDATION_ERROR',
      type === 'entity.too.large'
        ? 'Los datos enviados son demasiado grandes.'
        : 'No se pudo leer lo que enviaste. Revisá los datos e intentá de nuevo.',
    );
    return;
  }
  console.error('Error no controlado en la API:', error);
  sendError(res, 500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado. Intentá de nuevo en unos minutos.');
};

/** Router de toda la API (`/api/*`). `server.ts` lo monta antes de Angular. */
export function createApiRouter(options: ApiRouterOptions = {}): Router {
  const router = Router();

  router.use(express.json());

  router.get('/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true });
    } catch {
      sendError(
        res,
        503,
        'DATABASE_UNAVAILABLE',
        'No se pudo conectar con la base de datos. Intentá de nuevo en unos minutos.',
      );
    }
  });

  router.use(
    '/public',
    createPublicRouter({
      now: options.now ?? (() => new Date()),
      registrationRateLimit: options.registrationRateLimit ?? DEFAULT_REGISTRATION_RATE_LIMIT,
    }),
  );

  // Cualquier otra ruta /api/* responde JSON y nunca llega a Angular.
  router.use((_req, res) => {
    sendError(res, 404, 'NOT_FOUND', 'No existe el recurso solicitado.');
  });

  router.use(handleErrors);

  return router;
}
