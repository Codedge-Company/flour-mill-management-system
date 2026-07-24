import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { TooltipModule } from 'primeng/tooltip';
import { OrderService } from '../../core/services/order.service';
import { Order, OrderStats } from '../../core/models/order';

@Component({
    selector: 'app-order-management',
    standalone: true,
    imports: [CommonModule, FormsModule, ChartModule, TooltipModule],
    templateUrl: './order-management.component.html',
    styleUrls: ['./order-management.component.css']
})
export class OrderManagementComponent implements OnInit {
    private orderService = inject(OrderService);
    private router = inject(Router);

    // ── State ──────────────────────────────────────────
    loading = signal(false);
    error = signal<string | null>(null);
    orders = signal<Order[]>([]);
    stats = signal<OrderStats | null>(null);
    filterStatus = signal<'all' | 'PENDING' | 'COMPLETED'>('all');
    expandedOrderId = signal<string | null>(null);

    // Computed filtered orders
    filteredOrders = computed(() => {
        const status = this.filterStatus();
        let list = status === 'all' ? this.orders() : this.orders().filter(o => o.status === status);
        // Sort by priority: Overdue > Due Today > Due Soon > On Track
        const priorityOrder: Record<string, number> = {
            'Overdue': 0,
            'Due Today': 1,
            'Due Soon': 2,
            'On Track': 3,
            'Completed': 4
        };
        return list.sort((a, b) => {
            const pa = priorityOrder[this.getPriority(a)] ?? 9;
            const pb = priorityOrder[this.getPriority(b)] ?? 9;
            return pa - pb;
        });
    });
    // ── Chart data ──────────────────────────────────────
    weeklyTrendData = computed(() => {
        const stats = this.stats();
        if (!stats || !stats.weeklyTrend?.length) return null;
        return {
            labels: stats.weeklyTrend.map(w => w.weekLabel),
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

        // Fetch stats and orders in parallel
        this.orderService.getStats().subscribe({
            next: stats => {
                this.stats.set(stats);
                this.loading.set(false);
            },
            error: err => {
                this.error.set('Failed to load statistics.');
                this.loading.set(false);
            }
        });

        this.orderService.getAll().subscribe({
            next: orders => {
                this.orders.set(orders);
            },
            error: err => {
                this.error.set('Failed to load orders.');
                this.loading.set(false);
            }
        });
    }

    // ── Actions ────────────────────────────────────────
    markDone(order: Order): void {
        if (!confirm(`Mark order ${order.order_no} as completed?`)) return;
        this.loading.set(true);
        this.orderService.markDone(order._id).subscribe({
            next: updated => {
                // Update the order in the list
                this.orders.update(orders =>
                    orders.map(o => o._id === updated._id ? updated : o)
                );
                // Refresh stats
                this.orderService.getStats().subscribe(stats => this.stats.set(stats));
                this.loading.set(false);
            },
            error: err => {
                this.error.set('Failed to mark order as done.');
                this.loading.set(false);
            }
        });
    }

    // ── Helpers ────────────────────────────────────────
    statusClass(status: string): string {
        return status === 'COMPLETED' ? 'status-completed' : 'status-pending';
    }

    dueClass(order: Order): string {
        if (order.status === 'COMPLETED') return '';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(order.expected_date);
        due.setHours(0, 0, 0, 0);
        return due < today ? 'overdue' : '';
    }

    formatCurrency(amount: number): string {
        return `LKR ${amount.toFixed(2)}`;
    }

    // order-management.component.ts – replace the helper
    getCustomerName(order: Order): string {
        const c = order.customer_id;
        if (!c) return 'Unknown';
        return typeof c === 'object' ? c.name : 'Unknown';
    }

    getOrderTotal(order: Order): number {
        return order.total_amount;
    }
    toggleOrderDetail(orderId: string): void {
        this.expandedOrderId.set(this.expandedOrderId() === orderId ? null : orderId);
    }

    // ── get pack name ──
    getPackName(item: any): string {
        const p = item.pack_type_id;
        if (typeof p === 'object') return `${p.pack_name} (${p.weight_kg}kg)`;
        return String(p);
    }
    // ── Priority calculation ──────────────────────────────
    getPriority(order: Order): string {
        if (order.status === 'COMPLETED') return 'Completed';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(order.expected_date);
        due.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return 'Overdue';
        if (diffDays === 0) return 'Due Today';
        if (diffDays <= 3) return 'Due Soon';
        return 'On Track';
    }

}