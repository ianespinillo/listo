import type { Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { sendError } from '../errors';
import { toFieldErrors } from '../registration-schema';

// Utilidades comunes de las rutas del panel.

export const VALIDATION_MESSAGE = 'Revisá los datos marcados e intentá de nuevo.';

export function sendNotFound(res: Response, message = 'No existe el recurso solicitado.') {
  sendError(res, 404, 'NOT_FOUND', message);
}

export function sendValidationError(res: Response, error: z.ZodError) {
  sendError(res, 400, 'VALIDATION_ERROR', VALIDATION_MESSAGE, toFieldErrors(error));
}

/** Valida el cuerpo con zod. Si es inválido responde 400 y devuelve null. */
export function parseBody<S extends z.ZodType>(schema: S, req: Request, res: Response): z.output<S> | null {
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    sendValidationError(res, parsed.error);
    return null;
  }
  return parsed.data;
}

/** Id numérico de un parámetro de ruta. Devuelve null si no es un entero positivo de 32 bits. */
export function parseId(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^\d{1,10}$/.test(raw)) return null;
  const value = Number(raw);
  return value >= 1 && value <= 2_147_483_647 ? value : null;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const JSON_CONTENT_TYPE = /^application\/json\s*(;|$)/i;

/**
 * Defensa básica contra CSRF: las rutas que modifican datos solo aceptan `application/json`,
 * también las que no llevan cuerpo (el front manda `{}`).
 */
export const requireJsonContentType: RequestHandler = (req, res, next) => {
  if (MUTATING_METHODS.has(req.method) && !JSON_CONTENT_TYPE.test(req.headers['content-type'] ?? '')) {
    sendError(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Este pedido tiene que enviarse como JSON.');
    return;
  }
  next();
};
