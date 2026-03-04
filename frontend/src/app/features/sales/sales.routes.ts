// src/app/features/sales/sales.routes.ts
import { Routes } from '@angular/router';
import { CreditPaymentsComponent } from '../credit-payments/credit-payments.component';

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
      import('./sale-detail/sale-detail-dialog.component').then(m => m.SaleDetailDialogComponent)
  },
   {
    path: ':id/edit',
    loadComponent: () =>
      import('./edit-sale/edit-sale.component').then(m => m.EditSaleComponent)
  },
];