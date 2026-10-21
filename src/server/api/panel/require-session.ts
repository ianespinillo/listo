import { createHash } from 'node:crypto';
import type { RequestHandler, Response } from 'express';
import { prisma } from '../../db';
import { sendError } from '../errors';

export const SESSION_COOKIE = 'listo_session';

/** En la base solo se guarda el SHA-256 del token; el token en claro vive en la cookie. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SessionAdmin {
  id: number;
  email: string;
}

function sendUnauthenticated(res: Response) {
  sendError(res, 401, 'UNAUTHENTICATED', 'Tenés que iniciar sesión para continuar.');
}

/**
 * Valida la sesión en el servidor (el `authGuard` de Angular no protege nada por sí solo).
 * Una sesión vencida se rechaza y se borra al detectarla.
 */
export function requireSession(now: () => Date): RequestHandler {
  return async (req, res, next) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || token === '') {
      sendUnauthenticated(res);
      return;
    }
    const tokenHash = hashToken(token);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { admin: { select: { id: true, email: true } } },
    });
    if (!session) {
      sendUnauthenticated(res);
      return;
    }
    if (session.expiresAt <= now()) {
      await prisma.session.deleteMany({ where: { tokenHash } });
      sendUnauthenticated(res);
      return;
    }
    res.locals['admin'] = { id: session.admin.id, email: session.admin.email } satisfies SessionAdmin;
    next();
  };
}
