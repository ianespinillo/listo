import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { loginUrlTree } from './panel-auth.guard';

/** El login y la consulta de sesión devuelven 401 por diseño: no deben redirigir. */
const EXCLUDED = ['/api/panel/login', '/api/panel/session'];

/** Ante un 401 en cualquier `/api/panel/*` (sesión vencida o cerrada en otra pestaña), manda al ingreso. */
export const panelAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  return next(req).pipe(
    tap({
      error: (err: unknown) => {
        if (!(err instanceof HttpErrorResponse) || err.status !== 401) return;
        const path = req.url.split('?')[0];
        if (!path.startsWith('/api/panel/') || EXCLUDED.includes(path)) return;
        if (router.url.startsWith('/panel/ingresar')) return;
        void router.navigateByUrl(loginUrlTree(router, router.url));
      },
    }),
  );
};
