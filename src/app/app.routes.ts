import { Routes } from '@angular/router';
import { authGuard } from './core/panel-auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Inscripción al listado institucional · Listo',
    loadComponent: () => import('./features/registration/registration').then((m) => m.Registration),
  },
  {
    path: 'panel',
    canActivate: [authGuard],
    loadComponent: () => import('./features/panel/shell/panel-shell').then((m) => m.PanelShell),
    children: [],
  },
  { path: '**', redirectTo: '' },
];
