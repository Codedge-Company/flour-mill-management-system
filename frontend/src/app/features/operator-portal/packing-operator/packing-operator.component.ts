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
}

@Component({
    selector: 'app-packing-operator',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './packing-operator.component.html',
    styleUrl: './packing-operator.component.css',
})
export class PackingOperatorComponent implements OnInit {

    today = new Date();

    orders: OrderUI[] = [];
    ordersLoading = false;
    ordersError = '';

    stockItems: any[] = [];
    stockLoading = false;

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
        this.loadStock();
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
                this.orders = (res.data ?? [])
                    .filter(r => r.status === 'PENDING' || r.status === 'APPROVED')
                    .map(r => ({ ...r, completing: false }));
                this.ordersLoading = false;
            },
            error: () => {
                this.ordersError = 'Could not load orders. Please try again.';
                this.ordersLoading = false;
            },
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
                            this.orders = this.orders.filter(
                                o => o.stockRequestId !== order.stockRequestId
                            );
                            this.loadStock();
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

    loadStock(): void {
        this.stockLoading = true;
        this.inventoryService.getAll().subscribe({
            next: res => {
                this.stockItems = res.data ?? [];
                this.stockLoading = false;
            },
            error: () => {
                this.stockLoading = false;
            },
        });
    }

    formatDate(d: Date): string {
        return d.toLocaleDateString('en-LK', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }

    statusColor(status: string): string {
        switch (status) {
            case 'PENDING': return 'po-pill--pending';
            case 'APPROVED': return 'po-pill--approved';
            default: return '';
        }
    }
}