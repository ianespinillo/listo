import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Inscripción al listado institucional · Listo',
    loadComponent: () => import('./features/registration/registration').then((m) => m.Registration),
  },
  { path: '**', redirectTo: '' },
];
