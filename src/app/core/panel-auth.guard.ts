import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { PanelApiService } from './panel-api.service';

/**
 * Solo se vuelve a rutas internas del panel (evita redirecciones abiertas): `/panel`, `/panel/...`
 * o `/panel?...`. Se rechaza todo lo que tenga `//`, `\` o un esquema (`algo:`).
 */
export function safeReturnUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const inPanel = url === '/panel' || url.startsWith('/panel/') || url.startsWith('/panel?');
  if (!inPanel || url.includes('//') || url.includes('\\') || /^[a-z][a-z0-9+.-]*:/i.test(url)) return null;
  if (url === '/panel' || url.startsWith('/panel/ingresar')) return null;
  return url;
}

export function loginUrlTree(router: Router, fromUrl: string | null): UrlTree {
  const returnUrl = safeReturnUrl(fromUrl);
  return router.createUrlTree(['/panel/ingresar'], returnUrl ? { queryParams: { returnUrl } } : {});
}

/**
 * Solo maneja la navegación: la protección real está en el servidor (`/api/panel/*` valida la sesión).
 * Ante un error que no sea 401 (por ejemplo, sin conexión) deja pasar: la pantalla muestra su propio error.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const api = inject(PanelApiService);
  const router = inject(Router);
  return api.session().pipe(
    map(() => true),
    catchError((err: unknown) =>
      of(err instanceof HttpErrorResponse && err.status === 401 ? loginUrlTree(router, state.url) : true),
    ),
  );
};

/** Para la pantalla de ingreso: si ya hay sesión, va directo al panel. */
export const guestGuard: CanActivateFn = () => {
  const api = inject(PanelApiService);
  const router = inject(Router);
  return api.session().pipe(
    map(() => router.createUrlTree(['/panel'])),
    catchError(() => of(true)),
  );
};
