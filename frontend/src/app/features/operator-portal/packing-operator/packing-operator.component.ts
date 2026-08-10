import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../../core/services/inventory.service';
import {
    StockRequestService,
    StockRequest,
} from '../../../core/services/stock-request.service';
import {
    UserService,
    UserResponse
} from '../../../core/services/user.service';

interface OrderUI extends StockRequest {
    completing: boolean;
    partQtyInput: number | null;
    confirmingFull: boolean;
    rowError: string;
}
type SortDir = 'oldest' | 'newest';

@Component({
    selector: 'app-packing-operator',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './packing-operator.component.html',
    styleUrl: './packing-operator.component.css',
})
export class PackingOperatorComponent implements OnInit {

    today = new Date();

    private _allOrders: OrderUI[] = [];
    orders: OrderUI[] = [];
    ordersLoading = false;
    ordersError = '';

    sortDir: SortDir = 'oldest';

    packingOperators: UserResponse[] = [];
    operatorsLoading = false;
    selectedOperatorName = '';
    operatorError = '';

    constructor(
        private inventoryService: InventoryService,
        private stockRequestService: StockRequestService,
        private userService: UserService,
    ) { }

    ngOnInit(): void {
        this.loadOrders();
        this.loadPackingOperators();
    }

    loadPackingOperators(): void {
        this.operatorsLoading = true;
        this.operatorError = '';

        this.userService.getUsersByRoles(['PACKING_OPERATOR']).subscribe({
            next: users => {
                this.packingOperators = users ?? [];
                this.operatorsLoading = false;
            },
            error: () => {
                this.operatorError = 'Could not load packing operators.';
                this.operatorsLoading = false;
            }
        });
    }

loadOrders(): void {
    this.ordersLoading = true;
    this.ordersError = '';

    this.stockRequestService.getAll().subscribe({
        next: res => {
            this._allOrders = (res.data ?? [])
                .filter(r => r.status === 'PENDING' || r.status === 'APPROVED' || r.status === 'PARTIALLY_FULFILLED')
                .map(r => ({
                    ...r,
                    completing: false,
                    partQtyInput: null,
                    confirmingFull: false,
                    rowError: '',
                }));
            this.applySort();
            this.ordersLoading = false;
        },
        error: () => {
            this.ordersError = 'Could not load orders. Please try again.';
            this.ordersLoading = false;
        },
    });
}

// ── Part-complete: pack a portion of the remaining qty ──────────────
submitPart(order: OrderUI): void {
    order.rowError = '';

    if (!this.selectedOperatorName) {
        this.operatorError = 'Please select packing operator name first.';
        return;
    }
    this.operatorError = '';

    const partQty = Number(order.partQtyInput);
    if (!partQty || partQty <= 0) {
        order.rowError = 'Enter a valid quantity.';
        return;
    }
    if (partQty > order.remainingQty) {
        order.rowError = `Only ${order.remainingQty} remaining — cannot pack ${partQty}.`;
        return;
    }

    this.packQty(order, partQty);
}

// ── Fully complete: pack whatever remains, after confirmation ───────
askConfirmFull(order: OrderUI): void {
    if (!this.selectedOperatorName) {
        this.operatorError = 'Please select packing operator name first.';
        return;
    }
    this.operatorError = '';
    order.confirmingFull = true;
}

cancelConfirmFull(order: OrderUI): void {
    order.confirmingFull = false;
}

confirmFull(order: OrderUI): void {
    order.confirmingFull = false;
    this.packQty(order, order.remainingQty);
}

// ── Shared: add stock, then log the fulfillment (date + qty) on the request ──
private packQty(order: OrderUI, qty: number): void {
    order.completing = true;
    order.rowError = '';

    this.inventoryService.addStock({
        packTypeId: order.packTypeId,
        addQty: qty,
    }).subscribe({
        next: () => {
            this.stockRequestService
                .fulfillPart(order.stockRequestId, qty, this.selectedOperatorName)
                .subscribe({
                    next: (res) => {
                        order.completing = false;
                        if (res.isNowComplete) {
                            this._allOrders = this._allOrders.filter(
                                o => o.stockRequestId !== order.stockRequestId
                            );
                            this.applySort();
                        } else {
                            // update this order in place with fresh server data
                            Object.assign(order, res.data, { partQtyInput: null });
                        }
                    },
                    error: () => {
                        order.completing = false;
                        order.rowError = 'Stock added, but failed to record the packed entry.';
                    },
                });
        },
        error: () => {
            order.completing = false;
            order.rowError = 'Failed to add stock. Please try again.';
        },
    });
}
    setSortDir(dir: SortDir): void {
        this.sortDir = dir;
        this.applySort();
    }

    private applySort(): void {
        this.orders = [...this._allOrders].sort((a, b) => {
            const aTime = new Date(a.requestedAt).getTime();
            const bTime = new Date(b.requestedAt).getTime();
            return this.sortDir === 'oldest' ? aTime - bTime : bTime - aTime;
        });
    }

    completeOrder(order: OrderUI): void {
        if (!this.selectedOperatorName) {
            this.operatorError = 'Please select packing operator name first.';
            return;
        }

        this.operatorError = '';
        order.completing = true;

        this.stockRequestService
            .updateStatus(order.stockRequestId, 'FULFILLED', this.selectedOperatorName)
            .subscribe({
                next: () => {
                    this.inventoryService.addStock({
                        packTypeId: order.packTypeId,
                        addQty: order.qty,
                    }).subscribe({
                        next: () => {
                            order.completing = false;
                            this._allOrders = this._allOrders.filter(
                                o => o.stockRequestId !== order.stockRequestId
                            );
                            this.applySort();
                        },
                        error: () => {
                            order.completing = false;
                        },
                    });
                },
                error: () => {
                    order.completing = false;
                },
            });
    }

    formatDate(d: Date | string): string {
        const date = typeof d === 'string' ? new Date(d) : d;
        return date.toLocaleDateString('en-LK', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }

    formatRequestedAt(isoString: string): string {
        const d = new Date(isoString);
        return d.toLocaleDateString('en-LK', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        }) + ' ' + d.toLocaleTimeString('en-LK', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    }

statusColor(status: string): string {
    switch (status) {
        case 'PENDING': return 'po-pill--pending';
        case 'APPROVED': return 'po-pill--approved';
        case 'PARTIALLY_FULFILLED': return 'po-pill--partial';
        default: return '';
    }
}
}