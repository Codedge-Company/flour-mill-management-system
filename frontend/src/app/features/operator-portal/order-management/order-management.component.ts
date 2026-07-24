import { Component, OnInit, signal, computed, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { CustomerService } from '../../../core/services/customer.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { OrderService } from '../../../core/services/order.service';
import { Customer } from '../../../core/models/customer';
import { InventoryItem } from '../../../core/models/inventory';
import { Order, CreateOrderPayload } from '../../../core/models/order';

interface OrderItemRow {
  id: number;
  packTypeId: string | null;
  packName: string;
  qty: number;
  unitPrice: number;
  availableStock: number;
  lineTotal: number;
}

@Component({
  selector: 'app-order-management-portal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-management.component.html',
  styleUrl: './order-management.component.css',
})
export class OrderManagementPortalComponent implements OnInit {
  dataLoading = signal(true);
  customers = signal<Customer[]>([]);
  packTypes = signal<InventoryItem[]>([]);

  // ── Customer search ──────────────────────────────────────────────────
  customerSearchText = signal('');
  customerDropOpen = signal(false);
  selectedCustomerId = signal<string | null>(null);
  expandedOrderId = signal<string | null>(null);


  filteredCustomers = computed(() => {
    const q = this.customerSearchText().toLowerCase().trim();
    if (!q) return this.customers();
    return this.customers().filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.customerCode.toLowerCase().includes(q)
    );
  });

  selectedCustomer = computed(() =>
    this.customers().find((c) => c.customerId === this.selectedCustomerId()) ??
      null
  );

  // ── Form state ────────────────────────────────────────────────────────
  expectedDateStr = signal<string>(this.defaultExpectedDate());
  minDateStr = this.toDateStr(new Date());
  paymentMethod = signal<'CASH' | 'CREDIT'>('CASH');
  notes = signal('');
  rows = signal<OrderItemRow[]>([]);
  private nextRowId = 0;

  totalAmount = computed(() =>
    this.rows().reduce((s, r) => s + r.lineTotal, 0)
  );

  canSubmit = computed(() =>
    !!this.selectedCustomerId() &&
    !!this.expectedDateStr() &&
    this.rows().some((r) => r.packTypeId && r.qty >= 1 && r.unitPrice >= 0.01)
  );

  submitting = signal(false);
  submitError = signal<string | null>(null);
  submitSuccess = signal<string | null>(null);

  // ── My Orders list ────────────────────────────────────────────────────
  myOrders = signal<Order[]>([]);
  ordersLoading = signal(false);

  constructor(
    public authService: AuthService,
    private router: Router,
    private customerService: CustomerService,
    private inventoryService: InventoryService,
    private orderService: OrderService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.dataLoading.set(false);
      return;
    }
    this.loadData();
    this.loadMyOrders();
  }

  private loadData(): void {
    this.dataLoading.set(true);
    let done = 0;
    const total = 2;
    const check = () => {
      if (++done >= total) this.dataLoading.set(false);
    };

    this.customerService.getAll().subscribe({
      next: (r) => {
        this.customers.set(r.data ?? []);
        check();
      },
      error: () => {
        this.customers.set([]);
        check();
      },
    });

    this.inventoryService.getAll().subscribe({
      next: (r) => {
        this.packTypes.set(r.data ?? []);
        check();
        if (this.rows().length === 0) this.addRow();
      },
      error: () => {
        check();
      },
    });
  }

  loadMyOrders(): void {
    this.ordersLoading.set(true);
    this.orderService.getMyOrders().subscribe({
      next: (orders) => {
        this.myOrders.set(orders);
        this.ordersLoading.set(false);
      },
      error: () => this.ordersLoading.set(false),
    });
  }

  // ── Customer search ──────────────────────────────────────────────────
  onCustomerSearch(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.customerSearchText.set(v);
    this.customerDropOpen.set(true);
    if (this.selectedCustomerId()) this.selectedCustomerId.set(null);
  }

  selectCustomer(c: Customer): void {
    this.selectedCustomerId.set(c.customerId);
    this.customerSearchText.set(`${c.name} (${c.customerCode})`);
    this.customerDropOpen.set(false);
    console.log('Selected customer:', c);
    // Price rules are fetched on‑the‑fly when a pack is selected (see onPackChange)
  }

  onCustomerBlur(): void {
    setTimeout(() => this.customerDropOpen.set(false), 200);
  }

  // ── Item rows ─────────────────────────────────────────────────────────
  addRow(): void {
    this.rows.update((rs) => [
      ...rs,
      {
        id: this.nextRowId++,
        packTypeId: null,
        packName: '',
        qty: 1,
        unitPrice: 0,
        availableStock: 0,
        lineTotal: 0,
      },
    ]);
  }

  removeRow(i: number): void {
    this.rows.update((rs) => rs.filter((_, idx) => idx !== i));
  }

  getAvailablePacks(currentIndex: number): InventoryItem[] {
    const used = this.rows()
      .filter((_, i) => i !== currentIndex)
      .map((r) => r.packTypeId)
      .filter(Boolean) as string[];
    return this.packTypes().filter((p) => !used.includes(p.packTypeId));
  }

  /**
   * Called when the user selects a pack type in a row.
   * Fetches the effective price for the selected customer + pack,
   * or falls back to the inventory default if no customer is selected.
   */
  onPackChange(index: number, packTypeId: string | null): void {
    if (!packTypeId) return;
    const pack = this.packTypes().find((p) => p.packTypeId === packTypeId);
    if (!pack) return;

    const customerId = this.selectedCustomerId();

    const applyPrice = (unitPrice: number) => {
      this.updateRow(index, {
        packTypeId,
        packName: pack.packName,
        unitPrice,
        availableStock: pack.stockQty,
      });
    };

    if (customerId) {
      // Fetch customer‑specific effective price for this pack
      this.customerService.getEffectivePrice(customerId, packTypeId).subscribe({
        next: (res) => {
          applyPrice(res.unitSellPrice);
          console.log('Effective price loaded:', res);
        },
        error: (err) => {
          console.error('Failed to load effective price, using default', err);
          // Fallback to default sell price from inventory (or 0 if not available)
          const defaultPrice = (pack as any).sellPrice ?? 0;
          applyPrice(defaultPrice);
        },
      });
    } else {
      // No customer selected – use default sell price from inventory
      const defaultPrice = (pack as any).sellPrice ?? 0;
      applyPrice(defaultPrice);
    }
  }

  onQtyChange(i: number, raw: string): void {
    const val = Math.max(1, parseInt(raw, 10) || 1);
    this.updateRow(i, { qty: val });
  }

  onPriceChange(i: number, raw: string): void {
    const val = Math.max(0, parseFloat(raw) || 0);
    this.updateRow(i, { unitPrice: val });
  }

  private updateRow(i: number, partial: Partial<OrderItemRow>): void {
    this.rows.update((rs) =>
      rs.map((r, idx) => (idx === i ? { ...r, ...partial } : r))
    );
    // Recalculate line total
    const r = this.rows()[i];
    const lineTotal = r.qty * r.unitPrice;
    this.rows.update((rs) =>
      rs.map((row, idx) => (idx === i ? { ...row, lineTotal } : row))
    );
  }

  // Soft warning only — a future order can still be placed even if current
  // stock is short; it may be replenished before the expected date.
  stockWarning(row: OrderItemRow): string {
    if (!row.packTypeId) return '';
    return row.qty > row.availableStock
      ? `Only ${row.availableStock} in stock today — may need restocking before ${this.formatDateShort(
          this.expectedDateStr()
        )}`
      : '';
  }

  trackRow(index: number, row: OrderItemRow): number {
    return row.id;
  }

  // ── Submit ────────────────────────────────────────────────────────────
  submitOrder(): void {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.submitError.set(null);

    const validRows = this.rows().filter(
      (r) => r.packTypeId && r.qty >= 1 && r.unitPrice >= 0.01
    );

    const payload: CreateOrderPayload = {
      customer_id: this.selectedCustomerId()!,
      payment_method: this.paymentMethod(),
      expected_date: this.expectedDateStr(),
      notes: this.notes().trim() || undefined,
      items: validRows.map((r) => ({
        pack_type_id: r.packTypeId!,
        qty: r.qty,
        unit_price: r.unitPrice,
      })),
    };

    this.orderService.create(payload).subscribe({
      next: (order) => {
        this.submitting.set(false);
        this.submitSuccess.set(
          `✅ Order ${order.order_no} created — expected ${this.formatDateShort(
            order.expected_date
          )}.`
        );
        setTimeout(() => this.submitSuccess.set(null), 6000);
        this.resetForm();
        this.loadMyOrders();
      },
      error: (err) => {
        this.submitting.set(false);
        this.submitError.set(
          err?.error?.message ?? 'Failed to create order. Please try again.'
        );
      },
    });
  }

  private resetForm(): void {
    this.selectedCustomerId.set(null);
    this.customerSearchText.set('');
    this.paymentMethod.set('CASH');
    this.notes.set('');
    this.expectedDateStr.set(this.defaultExpectedDate());
    this.rows.set([]);
    this.nextRowId = 0;
    this.addRow();
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  packName(item: Order['items'][0]): string {
    const p = item.pack_type_id;
    return typeof p === 'object'
      ? `${p.pack_name} (${p.weight_kg}kg)`
      : String(p);
  }

  dueLabel(order: Order): { text: string; urgent: boolean } {
    if (order.status === 'COMPLETED') return { text: 'Completed', urgent: false };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(order.expected_date);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return { text: `Overdue by ${Math.abs(diffDays)}d`, urgent: true };
    if (diffDays === 0) return { text: 'Due today', urgent: true };
    return { text: `Due in ${diffDays}d`, urgent: false };
  }

  formatLKR(n: number): string {
    return `LKR ${Number(n).toLocaleString('en-LK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  formatDateShort(d: string): string {
    return new Date(d).toLocaleDateString('en-LK', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  /** Once an order is Done, a real Sale exists — show its actual payment
   *  status (PAID, or PENDING for uncollected credit) instead of just the
   *  order's intended payment method. */
  paymentLabel(order: Order): string {
    const sale = order.sale_id;
    if (sale && typeof sale === 'object' && 'payment_status' in sale) {
      return sale.payment_status === 'PAID' ? 'Paid' : 'Payment Pending';
    }
    return order.payment_method === 'CREDIT'
      ? 'Credit (on order)'
      : 'Cash (on order)';
  }

  private defaultExpectedDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return this.toDateStr(d);
  }

  private toDateStr(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/portal/sales-operator');
  }
  toggleOrderDetail(orderId: string): void {
  this.expandedOrderId.set(this.expandedOrderId() === orderId ? null : orderId);
}
getPackName(item: any): string {
  const pack = item.pack_type_id;
  if (typeof pack === 'object') {
    return `${pack.pack_name} (${pack.weight_kg}kg)`;
  }
  return String(pack);
}
getCustomerName(order: Order): string {
  const c = order.customer_id;
  if (!c) return 'Unknown';
  return typeof c === 'object' ? c.name : 'Unknown';
}
}