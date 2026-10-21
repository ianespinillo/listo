import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/panel-auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Inscripción al listado institucional · Listo',
    loadComponent: () => import('./features/registration/registration').then((m) => m.Registration),
  },
  {
    path: 'panel/ingresar',
    title: 'Ingresar al panel · Listo',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/panel/login/login').then((m) => m.Login),
  },
  {
    path: 'panel',
    canActivate: [authGuard],
    loadComponent: () => import('./features/panel/shell/panel-shell').then((m) => m.PanelShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Listado · Listo',
        loadComponent: () => import('./features/panel/listing/listing').then((m) => m.Listing),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
