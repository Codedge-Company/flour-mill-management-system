// src/app/features/customers/customers.routes.ts
import { Routes } from '@angular/router';

export const customersRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./customer-list/customer-list.component').then(m => m.CustomerListComponent)
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./customer-form/customer-form.component').then(m => m.CustomerFormComponent)
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./customer-form/customer-form.component').then(m => m.CustomerFormComponent)
  },
  {
    path: ':id/prices',
    loadComponent: () =>
      import('./customer-price-rules/customer-price-rules.component').then(m => m.CustomerPriceRulesComponent)
  }
];