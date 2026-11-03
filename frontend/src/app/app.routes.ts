import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/auth.guard';
import { LoginComponent } from './features/login/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ShellComponent } from './layout/shell.component';
import { LeadListComponent } from './features/leads/lead-list.component';
import { LeadFormComponent } from './features/leads/lead-form.component';
import { LeadDetailComponent } from './features/leads/lead-detail.component';
import { CallListComponent } from './features/calls/call-list.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: DashboardComponent },
      { path: 'leads', component: LeadListComponent },
      { path: 'calls', component: CallListComponent },
      { path: 'leads/new', component: LeadFormComponent },
      { path: 'leads/:id', component: LeadDetailComponent },
      { path: 'leads/:id/edit', component: LeadFormComponent },
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
