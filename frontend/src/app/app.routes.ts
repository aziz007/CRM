import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/auth.guard';
import { LoginComponent } from './features/login/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: DashboardComponent },
      {
        path: 'admin',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () =>
          import('./features/dashboard/admin-placeholder.component').then((m) => m.AdminPlaceholderComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
