// src/app/features/sales/edit-sale/edit-sale.component.ts
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { SaleService } from '../../../core/services/sale.service';
import { CustomerService } from '../../../core/services/customer.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { Payment, AddPaymentRequest } from '../../../core/models/payment.model';
import { Customer } from '../../../core/models/customer';
import { InventoryItem } from '../../../core/models/inventory';
import { SaleItemRow, PaymentMethod } from '../../../core/models/sale';
import { LkrCurrencyPipe } from '../../../shared/pipes/lkr-currency.pipe';
import { PaymentApiService } from '../../../core/services/payment-api.service';
import { ApiResponse } from '../../../core/models/api-response';

@Component({
  selector: 'app-edit-sale',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    LkrCurrencyPipe
  ],
  templateUrl: './edit-sale.component.html',
  styleUrl: './edit-sale.component.css'
})
export class EditSaleComponent implements OnInit {
  customers = signal<Customer[]>([]);
  packTypes = signal<InventoryItem[]>([]);
  rows = signal<SaleItemRow[]>([]);
  loading = signal(false);
  dataLoading = signal(true);
  error = signal<string | null>(null);
  stockErrors = signal<Record<number, string>>({});

  // ── Payment tracking ───────────────────────────────────────────────────────
  payments = signal<Payment[]>([]);
  paymentsLoading = signal(false);
  paymentError = signal<string | null>(null);
  addingPayment = signal(false);
  deletingPayment = signal<string | null>(null); // id being deleted

  // Add-payment form fields (simple signals, no FormGroup needed)
  newPaymentAmount = signal<number | null>(null);
  newPaymentDate = signal<string>('');
  newPaymentNotes = signal<string>('');

  saleId = '';
  saleNo = '';
  saleTotalRevenue = signal<number>(0); // keep a copy for payment math

  headerForm: FormGroup;
  private nextRowId = 0;
  protected readonly Math = Math;

  readonly paymentMethods: { value: PaymentMethod; label: string; hint?: string }[] = [
    { value: 'CASH', label: 'Cash' },
    { value: 'CARD', label: 'Card' },
    { value: 'BANK', label: 'Bank Transfer' },
    { value: 'CREDIT', label: 'Credit', hint: 'Payment pending' },
  ];

  protected readonly Object = Object;

  // ── Computed totals ─────────────────────────────────────────────────────────
  totalRevenue = computed(() => this.rows().reduce((s, r) => s + r.lineRevenue, 0));
  totalCost = computed(() => this.rows().reduce((s, r) => s + r.lineCost, 0));
  totalProfit = computed(() => this.rows().reduce((s, r) => s + r.lineProfit, 0));

  hasValidRows = computed(() =>
    this.rows().some(r => r.packTypeId !== null && r.qty >= 1 && r.unitPriceSold >= 0.01)
  );

  canSave = computed(() =>
    this.headerForm?.valid &&
    this.hasValidRows() &&
    !this.loading() &&
    Object.keys(this.stockErrors()).length === 0
  );

  selectedCustomer = computed(() =>
    this.getCustomer(this.headerForm.get('customerId')?.value)
  );

  // ── Payment computed ────────────────────────────────────────────────────────
  totalPaid = computed(() =>
    this.payments().reduce((s, p) => s + p.amount, 0)
  );

  balanceDue = computed(() =>
    Math.max(0, this.saleTotalRevenue() - this.totalPaid())
  );

  isFullyPaid = computed(() => this.balanceDue() <= 0.001);

  canAddPayment = computed(() => {
    const amt = this.newPaymentAmount();
    return (
      amt !== null &&
      amt > 0 &&
      amt <= this.balanceDue() + 0.001 &&
      !!this.newPaymentDate() &&
      !this.addingPayment()
    );
  });

  constructor(
    private fb: FormBuilder,
    private saleService: SaleService,
    private customerService: CustomerService,
    private inventoryService: InventoryService,
    private paymentService: PaymentApiService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.headerForm = this.fb.group({
      customerId: [null, Validators.required],
      paymentMethod: ['CASH', Validators.required],
      saleDate: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.saleId = this.route.snapshot.paramMap.get('id') ?? '';
    this.newPaymentDate.set(this.todayDateString());

    forkJoin({
      customers: this.customerService.getAll(),
      inventory: this.inventoryService.getAll(),
      sale: this.saleService.getById(this.saleId)
    }).subscribe({
      next: ({ customers, inventory, sale }) => {
        this.customers.set(customers.data);
        this.packTypes.set(
          inventory.data.map(p => ({ ...p, isLowStock: p.stockQty <= 10 }))
        );

        const s = sale.data;
        this.saleNo = s.saleNo;
        this.saleTotalRevenue.set(s.totalRevenue);

        this.headerForm.patchValue({
          customerId: s.customerId,
          paymentMethod: s.paymentMethod,
          saleDate: s.saleDatetime
            ? new Date(s.saleDatetime).toISOString().split('T')[0]
            : this.todayDateString()
        });

        this.rows.set(s.items.map(item => {
          const pack = inventory.data.find(p => p.packTypeId === item.packTypeId);
          return {
            id: this.nextRowId++,
            packTypeId: item.packTypeId,
            packName: item.packName,
            qty: item.qty,
            unitPriceSold: item.unitPriceSold,
            unitCostAtSale: item.unitCostAtSale,
            availableStock: pack?.stockQty ?? 0,
            lineRevenue: item.lineRevenue,
            lineCost: item.lineCost,
            lineProfit: item.lineProfit
          };
        }));

        this.dataLoading.set(false);

        // Load payments if this is a CREDIT sale
        if (s.paymentMethod === 'CREDIT') {
          this.loadPayments();
        }
      },
      error: () => {
        this.error.set('Failed to load sale data.');
        this.dataLoading.set(false);
      }
    });

    // Watch payment method changes — load/clear payments accordingly
    this.headerForm.get('paymentMethod')?.valueChanges.subscribe(method => {
      if (method === 'CREDIT') {
        this.loadPayments();
      } else {
        this.payments.set([]);
      }
    });
  }

  // ── Payment methods ─────────────────────────────────────────────────────────

  loadPayments(): void {
    this.paymentsLoading.set(true);
    this.paymentService.getBySale(this.saleId).subscribe({
      next: (res: ApiResponse<Payment[]>) => {
        this.payments.set(res.data);
        this.paymentsLoading.set(false);
      },
      error: () => {
        this.paymentError.set('Failed to load payments.');
        this.paymentsLoading.set(false);
      }
    });
  }
  onAddPayment(): void {
    const amount = this.newPaymentAmount();
    const date = this.newPaymentDate();
    if (!amount || !date || !this.canAddPayment()) return;

    this.addingPayment.set(true);
    this.paymentError.set(null);

    this.paymentService.addPayment({
      saleId: this.saleId,           // ← was sale_id
      amount,
      paymentDate: new Date(date).toISOString(),   // ← was payment_date
      notes: this.newPaymentNotes()
    }).subscribe({
      next: (res: ApiResponse<Payment>) => {
        this.payments.update(list => [res.data, ...list]);
        // Update total revenue tracker in case rows changed
        this.saleTotalRevenue.set(this.totalRevenue() || this.saleTotalRevenue());
        this.newPaymentAmount.set(null);
        this.newPaymentNotes.set('');
        this.newPaymentDate.set(this.todayDateString());
        this.addingPayment.set(false);
      },
      error: (err: any) => {
        this.paymentError.set(err?.error?.message ?? 'Failed to add payment.');
        this.addingPayment.set(false);
      }
    });
  }

  onDeletePayment(paymentId: string): void {
    if (!confirm('Remove this payment record?')) return;
    this.deletingPayment.set(paymentId);
    this.paymentService.deletePayment(paymentId).subscribe({
      next: () => {
        this.payments.update(list => list.filter(p => p.paymentId !== paymentId));
        this.deletingPayment.set(null);
      },
      error: (err: any) => {
        this.paymentError.set(err?.error?.message ?? 'Failed to delete payment.');
        this.deletingPayment.set(null);
      }
    });
  }

  /** Fill the amount field with the full remaining balance */
  fillBalance(): void {
    this.newPaymentAmount.set(parseFloat(this.balanceDue().toFixed(2)));
  }

  // ── Row management ──────────────────────────────────────────────────────────

  addRow(): void {
    this.rows.update(rows => [
      ...rows,
      {
        id: this.nextRowId++,
        packTypeId: null, packName: '',
        qty: 1, unitPriceSold: 0,
        unitCostAtSale: 0, availableStock: 0,
        lineRevenue: 0, lineCost: 0, lineProfit: 0
      }
    ]);
  }

  removeRow(index: number): void {
    this.rows.update(rows => rows.filter((_, i) => i !== index));
    this.clearStockError(index);
    this.recomputeAll();
  }

  onPackChange(index: number, packTypeId: string | null): void {
    if (!packTypeId) return;
    const pack = this.packTypes().find(p => p.packTypeId === packTypeId);
    if (!pack) return;

    const customerId = this.headerForm.value.customerId;
    if (customerId) {
      this.customerService.getEffectivePrice(customerId, packTypeId).subscribe({
        next: res => {
          this.updateRow(index, {
            packTypeId,
            packName: pack.packName,
            unitPriceSold: res.unitSellPrice,
            unitCostAtSale: pack.currentCost,
            availableStock: pack.stockQty
          });
          this.recomputeRow(index);
          this.validateStock(index);
        }
      });
    } else {
      this.updateRow(index, {
        packTypeId,
        packName: pack.packName,
        unitPriceSold: 0,
        unitCostAtSale: pack.currentCost,
        availableStock: pack.stockQty
      });
      this.recomputeRow(index);
    }
  }

  onCustomerChange(customerId: string | null): void {
    if (!customerId) return;
    this.rows().forEach((row, index) => {
      if (row.packTypeId) this.onPackChange(index, row.packTypeId);
    });
  }

  onQtyChange(index: number, qty: number): void {
    this.updateRow(index, { qty: Math.max(1, +qty || 1) });
    this.recomputeRow(index);
    this.validateStock(index);
  }

  onPriceChange(index: number, price: number): void {
    this.updateRow(index, { unitPriceSold: +price || 0 });
    this.recomputeRow(index);
  }

  // ── Template helpers ────────────────────────────────────────────────────────

  getAvailablePacks(currentIndex: number): InventoryItem[] {
    const usedIds = this.rows()
      .filter((_, i) => i !== currentIndex)
      .map(r => r.packTypeId)
      .filter(Boolean) as string[];
    return this.packTypes().filter(p => !usedIds.includes(p.packTypeId));
  }

  isPackMissingFromAvailable(index: number, packTypeId: string | null): boolean {
    if (!packTypeId) return false;
    return !this.getAvailablePacks(index).some(p => p.packTypeId === packTypeId);
  }

  getCustomer(customerId: string | null): Customer | null {
    if (!customerId) return null;
    return this.customers().find(c => c.customerId === customerId) ?? null;
  }

  getPaymentValue(): string {
    return this.headerForm.get('paymentMethod')?.value ?? '';
  }

  isCustomerIdInvalid(): boolean {
    const ctrl = this.headerForm.get('customerId');
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  hasStockError(index: number): boolean { return !!this.stockErrors()[index]; }
  getStockError(index: number): string { return this.stockErrors()[index] ?? ''; }
  isLowStock(row: SaleItemRow): boolean { return row.availableStock <= 10; }
  isProfitPositive(): boolean { return this.totalProfit() >= 0; }
  isProfitNegative(): boolean { return this.totalProfit() < 0; }

  protected todayDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  onSave(): void {
    if (!this.canSave()) return;
    this.error.set(null);
    this.loading.set(true);

    const validRows = this.rows().filter(
      r => r.packTypeId !== null && r.qty > 0 && r.unitPriceSold > 0
    );
    console.log('Submitting sale update', this.headerForm.value);
    this.saleService.updateSale(this.saleId, {
      customerId: this.headerForm.value.customerId,
      paymentMethod: this.headerForm.value.paymentMethod,
      saleDate: this.headerForm.value.saleDate,
      items: validRows.map(r => ({
        packTypeId: r.packTypeId!,
        qty: r.qty,
        unitPriceSold: r.unitPriceSold
      }))
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/sales']);
      },
      error: err => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'Failed to update sale. Please try again.');
      }
    });
  }

  onCancel(): void {
    this.router.navigate(['/sales']);
  }

  private updateRow(index: number, partial: Partial<SaleItemRow>): void {
    this.rows.update(rows =>
      rows.map((r, i) => i === index ? { ...r, ...partial } : r)
    );
  }

  private recomputeRow(index: number): void {
    const row = this.rows()[index];
    const lineRevenue = row.qty * row.unitPriceSold;
    const lineCost = row.qty * row.unitCostAtSale;
    this.updateRow(index, { lineRevenue, lineCost, lineProfit: lineRevenue - lineCost });
  }

  private recomputeAll(): void {
    this.rows().forEach((_, i) => this.recomputeRow(i));
  }

  private validateStock(index: number): void {
    const row = this.rows()[index];
    if (!row.packTypeId) return;
    const errors = { ...this.stockErrors() };
    if (row.qty > row.availableStock) {
      errors[index] = `Only ${row.availableStock} packs available`;
    } else {
      delete errors[index];
    }
    this.stockErrors.set(errors);
  }

  private clearStockError(index: number): void {
    const errors = { ...this.stockErrors() };
    delete errors[index];
    this.stockErrors.set(errors);
  }
}