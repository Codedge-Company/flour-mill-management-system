// src/app/features/budget/budget-management.routes.ts
import { Routes } from '@angular/router';

export const BudgetManagementRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./inventory-budget-overview/inventory-budget-overview.component').then(m => m.InventoryBudgetOverviewComponent)
  }
];