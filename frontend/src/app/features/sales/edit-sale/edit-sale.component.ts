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
import { Customer } from '../../../core/models/customer';
import { InventoryItem } from '../../../core/models/inventory';
import { SaleItemRow, PaymentMethod } from '../../../core/models/sale';
import { LkrCurrencyPipe } from '../../../shared/pipes/lkr-currency.pipe';

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

  saleId = '';
  saleNo = '';

  headerForm: FormGroup;
  private nextRowId = 0;

  readonly paymentMethods: { value: PaymentMethod; label: string }[] = [
    { value: 'CASH', label: 'Cash' },
    { value: 'CARD', label: 'Card' },
    { value: 'BANK', label: 'Bank Transfer' }
  ];

  protected readonly Object = Object;

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

  constructor(
    private fb: FormBuilder,
    private saleService: SaleService,
    private customerService: CustomerService,
    private inventoryService: InventoryService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.headerForm = this.fb.group({
      customerId: [null, Validators.required],
      paymentMethod: ['CASH', Validators.required]
    });
  }

  ngOnInit(): void {
    this.saleId = this.route.snapshot.paramMap.get('id') ?? '';

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

        this.headerForm.patchValue({
          customerId: s.customerId,
          paymentMethod: s.paymentMethod
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
      },
      error: () => {
        this.error.set('Failed to load sale data.');
        this.dataLoading.set(false);
      }
    });
  }

  // ── Row management ────────────────────────────────────────────────────────

  addRow(): void {
    this.rows.update(rows => [
      ...rows,
      {
        id: this.nextRowId++,
        packTypeId: null,
        packName: '',
        qty: 1,
        unitPriceSold: 0,
        unitCostAtSale: 0,
        availableStock: 0,
        lineRevenue: 0,
        lineCost: 0,
        lineProfit: 0
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

  // ── Template helpers — NO arrow functions, safe for Angular templates ─────

  /** Returns packs not yet selected in other rows */
  getAvailablePacks(currentIndex: number): InventoryItem[] {
    const usedIds = this.rows()
      .filter((_, i) => i !== currentIndex)
      .map(r => r.packTypeId)
      .filter(Boolean) as string[];
    return this.packTypes().filter(p => !usedIds.includes(p.packTypeId));
  }

  /**
   * True when the row's current packTypeId is NOT in getAvailablePacks(i).
   * Called from template instead of arrow-function @if.
   */
  isPackMissingFromAvailable(index: number, packTypeId: string | null): boolean {
    if (!packTypeId) return false;
    const available = this.getAvailablePacks(index);
    for (let i = 0; i < available.length; i++) {
      if (available[i].packTypeId === packTypeId) return false;
    }
    return true;
  }

  getCustomer(customerId: string | null): Customer | null {
    if (!customerId) return null;
    const list = this.customers();
    for (let i = 0; i < list.length; i++) {
      if (list[i].customerId === customerId) return list[i];
    }
    return null;
  }

  getPaymentValue(): string {
    return this.headerForm.get('paymentMethod')?.value ?? '';
  }

  getCustomerIdValue(): string {
    return this.headerForm.get('customerId')?.value ?? '';
  }

  isCustomerIdInvalid(): boolean {
    const ctrl = this.headerForm.get('customerId');
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  hasStockError(index: number): boolean {
    return !!this.stockErrors()[index];
  }

  getStockError(index: number): string {
    return this.stockErrors()[index] ?? '';
  }

  isLowStock(row: SaleItemRow): boolean {
    return row.availableStock <= 10;
  }

  isProfitPositive(): boolean {
    return this.totalProfit() >= 0;
  }

  isProfitNegative(): boolean {
    return this.totalProfit() < 0;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  onSave(): void {
    if (!this.canSave()) return;
    this.error.set(null);
    this.loading.set(true);

    const validRows = this.rows().filter(
      r => r.packTypeId !== null && r.qty > 0 && r.unitPriceSold > 0
    );

    this.saleService.updateSale(this.saleId, {
      customerId: this.headerForm.value.customerId,
      paymentMethod: this.headerForm.value.paymentMethod,
      items: validRows.map(r => ({
        packTypeId: r.packTypeId!,
        qty: r.qty,
        unitPriceSold: r.unitPriceSold
      }))
    }).subscribe({
      next: res => {
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