// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { pagePermissionGuard } from './core/guards/page-permission.guard';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { CreditPaymentsComponent } from './features/credit-payments/credit-payments.component';
import { FlowMoneyComponent } from './features/flow-money/flow-money/flow-money.component';
import { MillingAnalysisComponent } from './features/milling-analysis/milling-analysis.component';
import { MachineOperatorsDashboardComponent } from './features/machine-operators-dashboard/machine-operators-dashboard.component';
import { SiftingDashboardComponent } from './features/sifting-dashboard/sifting-dashboard.component';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then(m => m.authRoutes)
  },
  {
    path: 'portal',
    loadChildren: () =>
      import('./features/operator-portal/operator-portal.routes')
        .then(m => m.OPERATOR_PORTAL_ROUTES)
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then(m => m.dashboardRoutes)
      },
      {
        path: 'inventory',
        canActivate: [pagePermissionGuard],
        data: { pageKey: 'inventory' },
        loadChildren: () =>
          import('./features/inventory/inventory.routes').then(m => m.inventoryRoutes)
      },
      // Material Store (Raw Rice / Bag Stock / Spare Parts)
      {
        path: 'material-store',
        canActivate: [pagePermissionGuard],
        data: { pageKey: 'material-store' },
        loadChildren: () =>
          import('./features/material-store/material-store.routes').then(m => m.materialStoreRoutes)
      },
      {
        path: 'customers',
        loadChildren: () =>
          import('./features/customers/customers.routes').then(m => m.customersRoutes)
      },
      {
        path: 'sales',
        loadChildren: () =>
          import('./features/sales/sales.routes').then(m => m.salesRoutes)
      },
      {
        path: 'notifications',
        loadChildren: () =>
          import('./features/notifications/notifications.routes').then(m => m.notificationsRoutes)
      },
      {
        path: 'user-management',
        canActivate: [pagePermissionGuard],
        data: { pageKey: 'user-management' },
        loadChildren: () =>
          import('./features/user-management/user-management.routes').then(m => m.userManagementRoutes)
      },
      {
        path: 'budget',
        canActivate: [pagePermissionGuard],
        data: { pageKey: 'budget' },
        loadChildren: () =>
          import('./features/budget/budget-management.routes').then(m => m.BudgetManagementRoutes)
      },
      {
        path: 'order-management',
        canActivate: [pagePermissionGuard],
        data: { pageKey: 'order-management' },
        loadChildren: () =>
          import('./features/order-Tracking/order-management.routes').then(m => m.orderManagementRoutes)
      },
      {
        path: 'settings/permissions',
        canActivate: [pagePermissionGuard],
        data: { pageKey: 'settings' }, // ADMIN-only in practice — see note below
        loadComponent: () =>
          import('./features/settings/page-permissions/page-permissions.component')
            .then(m => m.PagePermissionsComponent)
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'credit-payments', component: CreditPaymentsComponent },
      {
        path: 'flow-money',
        canActivate: [pagePermissionGuard],
        data: { pageKey: 'flow-money' },
        component: FlowMoneyComponent
      },
      {
        path: 'milling-analysis',
        canActivate: [pagePermissionGuard],
        data: { pageKey: 'milling-analysis' },
        component: MillingAnalysisComponent
      },
      {
        path: 'operators-dashboard',
        canActivate: [pagePermissionGuard],
        data: { pageKey: 'operators-dashboard' },
        component: MachineOperatorsDashboardComponent
      },
      {
        path: 'sifting-dashboard',
        canActivate: [pagePermissionGuard],
        data: { pageKey: 'sifting-dashboard' },
        component: SiftingDashboardComponent
      },
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];