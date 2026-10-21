import { RenderMode, ServerRoute } from '@angular/ssr';

// Todas las rutas se renderizan en el navegador; el servidor solo sirve la API y los estáticos.
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
