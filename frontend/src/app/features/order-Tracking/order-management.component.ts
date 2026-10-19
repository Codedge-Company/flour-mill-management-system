import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { TooltipModule } from 'primeng/tooltip';
import { OrderService } from '../../core/services/order.service';
import { Order, OrderItem, OrderStats } from '../../core/models/order';

/** One pack size that appears in the orders on screen (becomes a table column). */
export interface PackColumn {
    id: string;
    name: string;
    weightKg: number;
}

/** All orders that share the same expected date, with their totals. */
export interface DateGroup {
    key: string;                       // 'YYYY-MM-DD'
    date: Date;                        // local midnight of that day (for display)
    daysFromToday: number;             // negative = past
    orders: Order[];
    qtyByPack: Record<string, number>; // packTypeId -> bags
    totalKg: number;
    totalAmount: number;
    pendingCount: number;
    customerCount: number;
}

@Component({
    selector: 'app-order-management',
    standalone: true,
    imports: [CommonModule, FormsModule, ChartModule, TooltipModule],
    templateUrl: './order-management.component.html',
    styleUrls: ['./order-management.component.css']
})
export class OrderManagementComponent implements OnInit {
    private orderService = inject(OrderService);

    // ── State ──────────────────────────────────────────
    loading = signal(false);
    error = signal<string | null>(null);
    orders = signal<Order[]>([]);
    stats = signal<OrderStats | null>(null);
    filterStatus = signal<'all' | 'PENDING' | 'COMPLETED'>('all');
    expandedOrderId = signal<string | null>(null);

    // ── Date-wise view controls ────────────────────────
    /** 'desc' = latest expected date at the top (default), 'asc' = oldest first */
    sortDir = signal<'desc' | 'asc'>('desc');
    /** the one day the admin is looking at ('YYYY-MM-DD'), '' = all dates */
    selectedDate = signal<string>('');
    /** date groups the admin has collapsed (all groups start open) */
    collapsedDates = signal<Set<string>>(new Set());

    // Orders after the status + date filters
    filteredOrders = computed(() => {
        const status = this.filterStatus();
        const day = this.selectedDate();
        return this.orders().filter(o => {
            if (status !== 'all' && o.status !== status) return false;
            if (day && this.dateKey(o.expected_date) !== day) return false;
            return true;
        });
    });

    /** Pack sizes used by the filtered orders, smallest first -> table columns */
    packColumns = computed<PackColumn[]>(() => {
        const map = new Map<string, PackColumn>();
        for (const o of this.filteredOrders()) {
            for (const item of o.items) {
                const p = item.pack_type_id;
                if (p && typeof p === 'object' && !map.has(p._id)) {
                    map.set(p._id, { id: p._id, name: p.pack_name, weightKg: p.weight_kg });
                }
            }
        }
        return [...map.values()].sort((a, b) => a.weightKg - b.weightKg || a.name.localeCompare(b.name));
    });

    /** Orders grouped by expected date, each with qty per pack, total kg and total amount */
    dateGroups = computed<DateGroup[]>(() => {
        const groups = new Map<string, DateGroup>();
        const todayKey = this.localKey(new Date());

        for (const o of this.filteredOrders()) {
            const key = this.dateKey(o.expected_date);
            let g = groups.get(key);
            if (!g) {
                g = {
                    key,
                    date: this.keyToDate(key),
                    daysFromToday: this.daysBetween(todayKey, key),
                    orders: [],
                    qtyByPack: {},
                    totalKg: 0,
                    totalAmount: 0,
                    pendingCount: 0,
                    customerCount: 0,
                };
                groups.set(key, g);
            }
            g.orders.push(o);
            g.totalAmount += o.total_amount ?? 0;
            if (o.status === 'PENDING') g.pendingCount++;
            for (const item of o.items) {
                const id = this.packId(item);
                g.qtyByPack[id] = (g.qtyByPack[id] ?? 0) + item.qty;
                g.totalKg += item.qty * this.packWeight(item);
            }
        }

        const dir = this.sortDir() === 'desc' ? -1 : 1;
        const list = [...groups.values()].sort((a, b) => a.key.localeCompare(b.key) * dir);
        for (const g of list) {
            g.customerCount = new Set(g.orders.map(o => this.getCustomerName(o))).size;
            // inside a date: pending first, then by customer name
            g.orders.sort((a, b) =>
                (a.status === b.status ? 0 : a.status === 'PENDING' ? -1 : 1) ||
                this.getCustomerName(a).localeCompare(this.getCustomerName(b)));
        }
        return list;
    });

    /** Totals across everything currently shown */
    grandTotal = computed(() => {
        const qtyByPack: Record<string, number> = {};
        let totalKg = 0, totalAmount = 0, orders = 0;
        for (const g of this.dateGroups()) {
            totalKg += g.totalKg;
            totalAmount += g.totalAmount;
            orders += g.orders.length;
            for (const [id, q] of Object.entries(g.qtyByPack)) qtyByPack[id] = (qtyByPack[id] ?? 0) + q;
        }
        return { qtyByPack, totalKg, totalAmount, orders, dates: this.dateGroups().length };
    });

    hasDateFilter = computed(() => !!this.selectedDate());

    /** label above the table for the chosen day, e.g. "Thu, Oct 29, 2026 · In 10 days" */
    selectedDayLabel = computed(() => {
        const key = this.selectedDate();
        if (!key) return '';
        const d = this.daysBetween(this.localKey(new Date()), key);
        const rel = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d === -1 ? 'Yesterday' : d > 0 ? `In ${d} days` : `${-d} days ago`;
        const nice = this.keyToDate(key).toLocaleDateString('en-LK', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        return `${nice} · ${rel}`;
    });

    // ── Chart data ──────────────────────────────────────
    weeklyTrendData = computed(() => {
        const stats = this.stats();
        if (!stats || !stats.weeklyTrend?.length) return null;
        return {
            labels: stats.weeklyTrend.map(w => new Date(w.weekLabel).toLocaleDateString('en-LK', { day: '2-digit', month: 'short' })),
            datasets: [
                {
                    label: 'Orders',
                    data: stats.weeklyTrend.map(w => w.count),
                    backgroundColor: 'rgba(37, 99, 235, 0.2)',
                    borderColor: '#2563eb',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: '#2563eb'
                }
            ]
        };
    });

    chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: '#0f172a', titleColor: '#fff', bodyColor: '#e2e8f0' }
        },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { stepSize: 1, font: { size: 11 } } }
        }
    };

    // ── Lifecycle ──────────────────────────────────────
    ngOnInit(): void {
        this.loadData();
    }

    loadData(): void {
        this.loading.set(true);
        this.error.set(null);
        let pending = 2;
        const done = () => { if (--pending === 0) this.loading.set(false); };

        this.orderService.getStats().subscribe({
            next: stats => { this.stats.set(stats); done(); },
            error: () => { this.error.set('Failed to load statistics.'); done(); }
        });

        this.orderService.getAll().subscribe({
            next: orders => { this.orders.set(orders); done(); },
            error: () => { this.error.set('Failed to load orders.'); done(); }
        });
    }

    // ── Actions ────────────────────────────────────────
    markDone(order: Order, event?: Event): void {
        event?.stopPropagation();
        if (!confirm(`Mark order ${order.order_no} as completed?\n\nThis creates the sale and deducts stock.`)) return;
        this.loading.set(true);
        this.orderService.markDone(order._id).subscribe({
            next: updated => {
                this.orders.update(list => list.map(o => o._id === updated._id ? updated : o));
                this.orderService.getStats().subscribe(stats => this.stats.set(stats));
                this.loading.set(false);
            },
            error: err => {
                // show the real reason, e.g. "Insufficient stock for 5KG. Available: 8, needed: 20"
                this.error.set(err?.error?.message ?? 'Failed to mark order as done.');
                this.loading.set(false);
            }
        });
    }

    toggleSort(): void {
        this.sortDir.update(d => (d === 'desc' ? 'asc' : 'desc'));
    }

    /** back to the full list of all dates */
    clearDateFilter(): void {
        this.selectedDate.set('');
    }

    goToday(): void {
        this.selectedDate.set(this.localKey(new Date()));
    }

    /** previous / next calendar day (starts from today when no day is selected) */
    shiftDay(delta: number): void {
        const base = this.selectedDate() || this.localKey(new Date());
        const d = this.keyToDate(base);
        d.setDate(d.getDate() + delta);
        this.selectedDate.set(this.localKey(d));
    }

    toggleGroup(key: string): void {
        this.collapsedDates.update(set => {
            const next = new Set(set);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }

    isCollapsed(key: string): boolean {
        return this.collapsedDates().has(key);
    }

    toggleOrderDetail(orderId: string): void {
        this.expandedOrderId.set(this.expandedOrderId() === orderId ? null : orderId);
    }

    // ── Helpers used by the template ───────────────────
    /** bags of one pack size in one order (0 if the order does not have it) */
    orderQty(order: Order, packId: string): number {
        return order.items
            .filter(i => this.packId(i) === packId)
            .reduce((s, i) => s + i.qty, 0);
    }

    orderKg(order: Order): number {
        return order.items.reduce((s, i) => s + i.qty * this.packWeight(i), 0);
    }

    dateLabel(g: DateGroup): string {
        const d = g.daysFromToday;
        if (d === 0) return 'Today';
        if (d === 1) return 'Tomorrow';
        if (d === -1) return 'Yesterday';
        return d > 0 ? `In ${d} days` : `${-d} days ago`;
    }

    /** colour of the date header: overdue (pending orders in the past), today, soon, later, done */
    groupTone(g: DateGroup): string {
        if (g.pendingCount === 0) return 'done';
        if (g.daysFromToday < 0) return 'overdue';
        if (g.daysFromToday === 0) return 'today';
        if (g.daysFromToday <= 3) return 'soon';
        return 'later';
    }

    getPriority(order: Order): string {
        if (order.status === 'COMPLETED') return 'Completed';
        const diffDays = this.daysBetween(this.localKey(new Date()), this.dateKey(order.expected_date));
        if (diffDays < 0) return 'Overdue';
        if (diffDays === 0) return 'Due Today';
        if (diffDays <= 3) return 'Due Soon';
        return 'On Track';
    }

    formatCurrency(amount: number): string {
        return `LKR ${Number(amount ?? 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    formatKg(kg: number): string {
        return `${Number(kg ?? 0).toLocaleString('en-LK', { maximumFractionDigits: 2 })} kg`;
    }

    getCustomerName(order: Order): string {
        const c = order.customer_id;
        if (!c) return 'Unknown';
        return typeof c === 'object' ? c.name : 'Unknown';
    }

    getCustomerCode(order: Order): string {
        const c = order.customer_id;
        return c && typeof c === 'object' ? c.customer_code : '';
    }

    getPackName(item: OrderItem): string {
        const p = item.pack_type_id;
        if (typeof p === 'object') return `${p.pack_name} (${p.weight_kg}kg)`;
        return String(p);
    }

    // ── Private ────────────────────────────────────────
    private packId(item: OrderItem): string {
        const p = item.pack_type_id;
        return typeof p === 'object' ? p._id : String(p);
    }

    private packWeight(item: OrderItem): number {
        const p = item.pack_type_id;
        return typeof p === 'object' ? (p.weight_kg ?? 0) : 0;
    }

    /**
     * The portal saves the expected date as 'YYYY-MM-DD' (stored as UTC midnight),
     * so the first 10 characters of the ISO string ARE the chosen calendar day.
     */
    private dateKey(value: string | Date): string {
        return new Date(value).toISOString().slice(0, 10);
    }

    private localKey(d: Date): string {
        const p = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }

    private keyToDate(key: string): Date {
        const [y, m, d] = key.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    private daysBetween(fromKey: string, toKey: string): number {
        const a = Date.UTC(+fromKey.slice(0, 4), +fromKey.slice(5, 7) - 1, +fromKey.slice(8, 10));
        const b = Date.UTC(+toKey.slice(0, 4), +toKey.slice(5, 7) - 1, +toKey.slice(8, 10));
        return Math.round((b - a) / 86400000);
    }
}