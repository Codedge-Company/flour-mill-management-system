// src/app/features/inventory/inventory.routes.ts
import { Routes } from '@angular/router';

export const inventoryRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./inventory-list/inventory-list.component').then(m => m.InventoryListComponent)
  }
];