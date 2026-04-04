import { Component, OnInit, OnDestroy, signal, computed, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { CustomerService } from '../../../core/services/customer.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { UserService, UserResponse } from '../../../core/services/user.service';
import { SaleRequestService, SaleRequest, CreateSaleRequestPayload } from '../../../core/services/sale-request.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Customer } from '../../../core/models/customer';
import { InventoryItem } from '../../../core/models/inventory';

interface ItemRow {
  id: number;
  packTypeId: string | null;
  packName: string;
  qty: number;
  unitPriceSold: number;
  availableStock: number;
  lineRevenue: number;
}

@Component({
  selector: 'app-sales-operator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sales-operator.component.html',
  styleUrl: './sales-operator.component.css',
})
export class SalesOperatorComponent implements OnInit, OnDestroy {

  // ── Live clock ────────────────────────────────────────────────────────────
  nowDate = signal(new Date());
  nowDateStr = computed(() => this.toDateStr(this.nowDate()));
  nowTimeStr = computed(() => this.toTimeStr(this.nowDate()));
  private clockSub?: Subscription;

  // ── Data ──────────────────────────────────────────────────────────────────
  customers = signal<Customer[]>([]);
  packTypes = signal<InventoryItem[]>([]);
  users = signal<UserResponse[]>([]);
  dataLoading = signal(true);

  // ── Customer search ───────────────────────────────────────────────────────
  customerSearchText = signal('');
  customerDropOpen = signal(false);
  selectedCustomerId = signal<string | null>(null);

  filteredCustomers = computed(() => {
    const q = this.customerSearchText().toLowerCase().trim();
    if (!q) return this.customers();
    return this.customers().filter(c =>
      c.name.toLowerCase().includes(q) || c.customerCode.toLowerCase().includes(q)
    );
  });

  selectedCustomer = computed(() =>
    this.customers().find(c => c.customerId === this.selectedCustomerId()) ?? null
  );

  // ── Form state ────────────────────────────────────────────────────────────
  salesPersonId = signal<string>('');
  paymentMethod = signal<'CASH' | 'CREDIT'>('CASH');
  rows = signal<ItemRow[]>([]);
  private nextRowId = 0;

  // ── Totals ────────────────────────────────────────────────────────────────
  totalRevenue = computed(() => this.rows().reduce((s, r) => s + r.lineRevenue, 0));

  canSubmit = computed(() =>
    !!this.selectedCustomerId() &&
    !!this.salesPersonId() &&
    this.rows().some(r => r.packTypeId && r.qty >= 1 && r.unitPriceSold >= 0.01)
  );

  // ── Submission ────────────────────────────────────────────────────────────
  submitting = signal(false);
  submitError = signal<string | null>(null);
  submitSuccess = signal<string | null>(null);

  // ── My Requests table ─────────────────────────────────────────────────────
  myRequests = signal<SaleRequest[]>([]);
  requestsLoading = signal(false);
  savingId = signal<string | null>(null);
  saveError = signal<string | null>(null);
  expandedReqId = signal<string | null>(null);

  private statusSub?: Subscription;
qtyBuffer = signal<Record<number, string>>({});
priceBuffer = signal<Record<number, string>>({});
focusedQty = signal<Record<number, boolean>>({});
focusedPrice = signal<Record<number, boolean>>({});

  constructor(
    public authService: AuthService,
    private router: Router,
    private customerService: CustomerService,
    private inventoryService: InventoryService,
    private userService: UserService,
    private saleRequestService: SaleRequestService,
    private notificationSvc: NotificationService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit(): void {
    console.log('=== SalesOperatorComponent - ngOnInit called ===');

    if (!isPlatformBrowser(this.platformId)) {
      this.dataLoading.set(false);
      return;
    }

    this.clockSub = interval(1000).subscribe(() => this.nowDate.set(new Date()));

    this.loadData();
    this.loadMyRequests();
    this.listenForStatusUpdates();
  }

  ngOnDestroy(): void {
    this.clockSub?.unsubscribe();
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  private loadData(): void {
    this.dataLoading.set(true);
    let done = 0;
    const total = 3;
    const check = () => { if (++done >= total) this.dataLoading.set(false); };

    this.customerService.getAll().subscribe({
      next: r => { this.customers.set(r.data ?? []); check(); },
      error: () => { this.customers.set([]); check(); },
    });

    this.inventoryService.getAll().subscribe({
      next: r => {
        this.packTypes.set((r.data ?? []).filter((p: any) => p.stockQty > 0));
        check();
        if (this.rows().length === 0) this.addRow();
      },
      error: () => { check(); },
    });

    this.userService.getAllUsers().subscribe({
      next: u => { this.users.set(u ?? []); check(); },
      error: () => { this.users.set([]); check(); },
    });
  }

  loadMyRequests(): void {
    this.requestsLoading.set(true);
    this.saleRequestService.getMyRequests().subscribe({
      next: reqs => { this.myRequests.set(reqs); this.requestsLoading.set(false); },
      error: () => this.requestsLoading.set(false),
    });
  }

  // ── Socket ────────────────────────────────────────────────────────────────
  private listenForStatusUpdates(): void {
    try {
      const socket = (this.notificationSvc as any).socket;
      if (!socket) return;

      socket.on('saleRequestStatusUpdate', (data: { requestId: string; status: string; note: string | null }) => {
        this.myRequests.update(list =>
          list.map(r => r._id === data.requestId ? { ...r, status: data.status as any, review_note: data.note } : r)
        );
        if (data.status === 'APPROVED') {
          this.submitSuccess.set('✅ Your request was approved! The sale has been recorded.');
          setTimeout(() => this.submitSuccess.set(null), 6000);
        }
      });
    } catch (e) {
      console.warn('[SalesOperator] Socket not available:', e);
    }
  }

  // ── Customer Search Methods (These were missing!) ────────────────────────
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
  }

  onCustomerBlur(): void {
    setTimeout(() => this.customerDropOpen.set(false), 200);
  }

  // ── Item Rows ─────────────────────────────────────────────────────────────
  addRow(): void {
    this.rows.update(rs => [...rs, {
      id: this.nextRowId++,
      packTypeId: null,
      packName: '',
      qty: 1,
      unitPriceSold: 0,
      availableStock: 0,
      lineRevenue: 0,
    }]);
  }

  removeRow(i: number): void {
    this.rows.update(rs => rs.filter((_, idx) => idx !== i));
  }

  onPackChange(i: number, packTypeId: string): void {
    if (!packTypeId) return;
    const pack = this.packTypes().find(p => p.packTypeId === packTypeId);
    if (!pack) return;

    const custId = this.selectedCustomerId();
    if (custId) {
      this.customerService.getEffectivePrice(custId, packTypeId).subscribe({
        next: res => this.updateRow(i, {
          packTypeId,
          packName: pack.packName,
          unitPriceSold: res.unitSellPrice,
          availableStock: pack.stockQty
        }),
        error: () => this.updateRow(i, {
          packTypeId,
          packName: pack.packName,
          unitPriceSold: 0,
          availableStock: pack.stockQty
        }),
      });
    } else {
      this.updateRow(i, {
        packTypeId,
        packName: pack.packName,
        unitPriceSold: 0,
        availableStock: pack.stockQty
      });
    }
  }

onQtyFocus(i: number): void {
  this.focusedQty.update((f: Record<number, boolean>) => ({ ...f, [i]: true }));
  this.qtyBuffer.update((b: Record<number, string>) => ({ ...b, [i]: String(this.rows()[i]?.qty ?? 1) }));
}

onQtyInput(i: number, raw: string): void {
  this.qtyBuffer.update((b: Record<number, string>) => ({ ...b, [i]: raw }));
  const val = parseInt(raw, 10);
  if (!isNaN(val) && val >= 1) {
    this.updateRow(i, { qty: val });
    this.recompute(i); // ✅ live line total updates
  }
}

onQtyKeydown(i: number, event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    (event.target as HTMLInputElement).blur();
  }
}

onQtyBlur(i: number, raw: string): void {
  const val = Math.max(1, parseInt(raw, 10) || 1);
  this.updateRow(i, { qty: val });
  this.recompute(i);
  // Clear focus lock — now [value] can read from signal again
  this.focusedQty.update((f: Record<number, boolean>) => { const n = { ...f }; delete n[i]; return n; });
  this.qtyBuffer.update((b: Record<number, string>) => { const n = { ...b }; delete n[i]; return n; });
}

onPriceFocus(i: number): void {
  this.focusedPrice.update((f: Record<number, boolean>) => ({ ...f, [i]: true }));
  this.priceBuffer.update((b: Record<number, string>) => ({ ...b, [i]: String(this.rows()[i]?.unitPriceSold ?? 0) }));
}

onPriceInput(i: number, raw: string): void {
  this.priceBuffer.update((b: Record<number, string>) => ({ ...b, [i]: raw }));
  const val = parseFloat(raw);
  if (!isNaN(val) && val >= 0) {
    this.updateRow(i, { unitPriceSold: val });
    this.recompute(i); // ✅ live line total updates
  }
}

onPriceKeydown(i: number, event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    (event.target as HTMLInputElement).blur();
  }
}

onPriceBlur(i: number, raw: string): void {
  const val = Math.max(0, parseFloat(raw) || 0);
  this.updateRow(i, { unitPriceSold: val });
  this.recompute(i);
  // Clear focus lock — now [value] can read from signal again
  this.focusedPrice.update((f: Record<number, boolean>) => { const n = { ...f }; delete n[i]; return n; });
  this.priceBuffer.update((b: Record<number, string>) => { const n = { ...b }; delete n[i]; return n; });
}

  private updateRow(i: number, partial: Partial<ItemRow>): void {
    this.rows.update(rs => rs.map((r, idx) => idx === i ? { ...r, ...partial } : r));
    this.recompute(i);
  }

  private recompute(i: number): void {
    const r = this.rows()[i];
    if (!r) return;
    const lineRevenue = r.qty * r.unitPriceSold;
    this.rows.update(rs => rs.map((row, idx) => idx === i ? { ...row, lineRevenue } : row));
  }

  getAvailablePacks(currentIndex: number): InventoryItem[] {
    const used = this.rows()
      .filter((_, i) => i !== currentIndex)
      .map(r => r.packTypeId)
      .filter(Boolean) as string[];
    return this.packTypes().filter(p => !used.includes(p.packTypeId));
  }

  stockError(row: ItemRow): string {
    if (!row.packTypeId) return '';
    return row.qty > row.availableStock ? `Only ${row.availableStock} available` : '';
  }
  trackRow(index: number, row: ItemRow): number { return row.id; }
  // ── Submit & Other Methods ────────────────────────────────────────────────
  submitRequest(): void {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.submitError.set(null);

    const validRows = this.rows().filter(r => r.packTypeId && r.qty >= 1 && r.unitPriceSold >= 0.01);

    const payload: CreateSaleRequestPayload = {
      customer_id: this.selectedCustomerId()!,
      payment_method: this.paymentMethod(),
      sales_person_id: this.salesPersonId(),
      items: validRows.map(r => ({
        pack_type_id: r.packTypeId!,
        qty: r.qty,
        unit_price_sold: r.unitPriceSold,
      })),
    };

    this.saleRequestService.create(payload).subscribe({
      next: req => {
        this.submitting.set(false);
        this.submitSuccess.set(`✅ Request ${req.request_no} submitted — awaiting admin approval.`);
        setTimeout(() => this.submitSuccess.set(null), 6000);
        this.resetForm();
        this.loadMyRequests();
      },
      error: err => {
        this.submitting.set(false);
        this.submitError.set(err?.error?.message ?? 'Failed to submit request. Please try again.');
      },
    });
  }

  private resetForm(): void {
    this.selectedCustomerId.set(null);
    this.customerSearchText.set('');
    this.salesPersonId.set('');
    this.paymentMethod.set('CASH');
    this.rows.set([]);
    this.nextRowId = 0;
    this.addRow();
  }

  saveApprovedRequest(req: SaleRequest): void {
    this.savingId.set(req._id);
    this.saveError.set(null);

    this.saleRequestService.saveSale(req._id).subscribe({
      next: sale => {
        this.savingId.set(null);
        this.submitSuccess.set(`✅ Sale ${sale.sale_no} created successfully!`);
        setTimeout(() => this.submitSuccess.set(null), 5000);
        this.loadMyRequests();
      },
      error: err => {
        this.savingId.set(null);
        this.saveError.set(err?.error?.message ?? 'Failed to save sale.');
      },
    });
  }

  toggleExpand(reqId: string): void {
    this.expandedReqId.set(this.expandedReqId() === reqId ? null : reqId);
  }

  packName(item: SaleRequest['items'][0]): string {
    const p = item.pack_type_id;
    return typeof p === 'object' ? `${p.pack_name} (${p.weight_kg}kg)` : String(p);
  }

  statusClass(status: string): string {
    return ({
      PENDING: 'badge-pending',
      APPROVED: 'badge-approved',
      REJECTED: 'badge-rejected',
      SAVED: 'badge-saved'
    } as any)[status] ?? '';
  }

  logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/portal/sales-operator');
  }

  private toDateStr(d: Date): string {
    return d.toLocaleDateString('en-LK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  private toTimeStr(d: Date): string {
    return d.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  }

  formatReqDate(iso: string): string {
    return new Date(iso).toLocaleString('en-LK', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatLKR(n: number): string {
    return `LKR ${Number(n).toLocaleString('en-LK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }
}