import { Routes } from '@angular/router';
import { adminGuard } from '../../core/guards/admin.guard';

export const inventoryRoutes: Routes = [
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./inventory-list/inventory-list.component')
        .then(m => m.InventoryListComponent)
  }
];