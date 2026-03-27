import { Routes } from '@angular/router';
import { operatorGuard } from './operator.guard';

export const OPERATOR_PORTAL_ROUTES: Routes = [

    // ── Machine Operator ─────────────────────────────────────────────
    {
        path: 'machine-operator/login',
        loadComponent: () =>
            import('./login/operator-login.component')
                .then(m => m.OperatorLoginComponent),
        data: { role: 'MACHINE_OPERATOR', redirectTo: '/portal/machine-operator' }
    },
    {
        path: 'machine-operator',
        canActivate: [operatorGuard('MACHINE_OPERATOR')],
        loadComponent: () =>
            import('./machine-operator/machine-operator.component')
                .then(m => m.MachineOperatorComponent)
    },

    // ── Packing Operator ─────────────────────────────────────────────
    {
        path: 'packing-operator/login',
        loadComponent: () =>
            import('./login/operator-login.component')
                .then(m => m.OperatorLoginComponent),
        data: { role: 'PACKING_OPERATOR', redirectTo: '/portal/packing-operator' }
    },
    {
        path: 'packing-operator',
        canActivate: [operatorGuard('PACKING_OPERATOR')],
        loadComponent: () =>
            import('./packing-operator/packing-operator.component')
                .then(m => m.PackingOperatorComponent)
    },

    // ── Sales Operator ───────────────────────────────────────────────
    {
        path: 'sales-operator/login',
        loadComponent: () =>
            import('./login/operator-login.component')
                .then(m => m.OperatorLoginComponent),
        data: { role: 'SALES', redirectTo: '/portal/sales-operator' }
    },
    {
        path: 'sales-operator',
        canActivate: [operatorGuard('SALES')],
        loadComponent: () =>
            import('./sales-operator/sales-operator.component')
                .then(m => m.SalesOperatorComponent)
    },

    { path: '**', redirectTo: 'machine-operator/login' }
];