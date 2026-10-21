import cookieParser from 'cookie-parser';
import { Router } from 'express';
import { requireJsonContentType } from './http';
import { createListingRouter } from './listing';
import { requireSession } from './require-session';
import { createAuthRouter, getSession, type AuthRouterOptions } from './session';

export type PanelRouterOptions = AuthRouterOptions;

/**
 * Router de `/api/panel/*`. Orden de las capas: parseo de cookies, guarda de Content-Type,
 * rutas públicas (login y logout) y, desde ahí, TODO exige sesión validada en el servidor.
 */
export function createPanelRouter(options: PanelRouterOptions): Router {
  const router = Router();

  router.use(cookieParser());
  router.use(requireJsonContentType);
  router.use(createAuthRouter(options));

  router.use(requireSession(options.now));
  router.get('/session', getSession);
  router.use(createListingRouter(options));

  return router;
}
