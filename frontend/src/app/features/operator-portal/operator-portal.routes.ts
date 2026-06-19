import { Routes } from '@angular/router';
import { SalesOperatorComponent } from './sales-operator/sales-operator.component';

export const OPERATOR_PORTAL_ROUTES: Routes = [

    // ── Machine Operator ─────────────────────────────────────────────
    {
        path: 'machine-operator',
        loadComponent: () =>
            import('./machine-operator/machine-operator.component')
                .then(m => m.MachineOperatorComponent)
    },
    // ── Raw Rice Stock Entry ──────────────────────────────────────────
    {
        path: 'stock-entry',
        loadComponent: () =>
            import('./raw-rice-stock-entry/raw-rice-stock-entry.component')
                .then(m => m.RawRiceStockEntryComponent)
    },
    // ── Sales Operator ───────────────────────────────────────────────
    {
        path: 'sales-operator',
        component: SalesOperatorComponent
    },
    // ── Packing Operator ─────────────────────────────────────────────
    {
        path: 'packing-operator',
        loadComponent: () =>
            import('./packing-operator/packing-operator.component')
                .then(m => m.PackingOperatorComponent)
    },
    {
        path: 'sifting-operator',
        loadComponent: () =>
            import('./sifting-operator/sifting-operator.component')
                .then(m => m.SiftingOperatorComponent)
    },

    { path: '', redirectTo: 'machine-operator', pathMatch: 'full' }
];