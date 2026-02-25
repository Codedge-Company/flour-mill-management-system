// src/app/features/user-management/user-management.routes.ts
import { Routes } from '@angular/router';

export const userManagementRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./user-management.component').then(m => m.UserManagementComponent)
  }
];