// src/app/features/sales/sales.routes.ts
import { Routes } from '@angular/router';

export const salesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./sale-list/sale-list.component').then(m => m.SaleListComponent)
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./new-sale/new-sale.component').then(m => m.NewSaleComponent)
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./sale-detail/sale-detail.component').then(m => m.SaleDetailComponent)
  }
];