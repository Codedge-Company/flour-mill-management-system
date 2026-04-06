// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { CreditPaymentsComponent } from './features/credit-payments/credit-payments.component';
import { FlowMoneyComponent } from './features/flow-money/flow-money/flow-money.component';
import { MillingAnalysisComponent } from './features/milling-analysis/milling-analysis.component';

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
        loadChildren: () =>
          import('./features/inventory/inventory.routes').then(m => m.inventoryRoutes)
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
        canActivate: [adminGuard],
        loadChildren: () =>
          import('./features/user-management/user-management.routes').then(m => m.userManagementRoutes)
      },
      {
        path: 'budget',
        loadChildren: () =>
          import('./features/budget/budget-management.routes').then(m => m.BudgetManagementRoutes)
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'credit-payments', component: CreditPaymentsComponent },
      { path: 'flow-money', component: FlowMoneyComponent },
      { path: 'milling-analysis', component: MillingAnalysisComponent }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];