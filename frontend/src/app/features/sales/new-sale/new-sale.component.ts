// src/app/features/sales/new-sale/new-sale.component.ts (updated with nextRowId, id in addRow, trackByFn removed, getCustomer, selectedCustomer)
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SaleService } from '../../../core/services/sale.service';
import { CustomerService } from '../../../core/services/customer.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { Customer } from '../../../core/models/customer';
import { InventoryItem } from '../../../core/models/inventory';
import { SaleItemRow, PaymentMethod } from '../../../core/models/sale';
import { PageHeaderComponent, Breadcrumb } from '../../../shared/components/page-header/page-header.component';
import { LkrCurrencyPipe } from '../../../shared/pipes/lkr-currency.pipe';

@Component({
  selector: 'app-new-sale',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    PageHeaderComponent,
    LkrCurrencyPipe
  ],
  templateUrl: './new-sale.component.html',
  styleUrl: './new-sale.component.css'
})
export class NewSaleComponent implements OnInit {
  customers = signal<Customer[]>([]);
  packTypes = signal<InventoryItem[]>([]);
  rows = signal<SaleItemRow[]>([]);
  loading = signal(false);
  dataLoading = signal(true);
  error = signal<string | null>(null);
  stockErrors = signal<Record<number, string>>({});

  headerForm: FormGroup;

  private nextRowId = 0; // Added for unique row ids

  readonly paymentMethods: { value: PaymentMethod; label: string }[] = [
    { value: 'CASH', label: 'Cash' },
    { value: 'CARD', label: 'Card' },
    { value: 'BANK', label: 'Bank Transfer' }
  ];

  readonly breadcrumbs: Breadcrumb[] = [
    { label: 'Sales', route: '/sales' },
    { label: 'New Sale' }
  ];

  // Expose global Object for template use
  protected readonly Object = Object;

  // Computed totals
  totalRevenue = computed(() =>
    this.rows().reduce((s, r) => s + r.lineRevenue, 0));
  totalCost = computed(() =>
    this.rows().reduce((s, r) => s + r.lineCost, 0));
  totalProfit = computed(() =>
    this.rows().reduce((s, r) => s + r.lineProfit, 0));

hasValidRows = computed(() => 
  this.rows().some(r => r.packTypeId !== null && r.qty >= 1 && r.unitPriceSold >= 0.01)
);


  canSave = computed(() => {
    const formValid = this.headerForm.valid;
    const rowsValid = this.hasValidRows();
    const noLoading = !this.loading();
    const noErrors = Object.keys(this.stockErrors()).length === 0;

    const result = formValid && rowsValid && noLoading && noErrors;

    console.log('canSave check:', {
      formValid,
      rowsValid,
      noLoading,
      noErrors,
      result
    });

    return result;
  });

  selectedCustomer = computed(() =>
    this.getCustomer(this.headerForm.get('customerId')?.value)
  );
 customerSearchText = signal<string>('');
customerDropdownOpen = signal<boolean>(false);
filteredCustomers = computed(() => {
    const search = this.customerSearchText().toLowerCase().trim();
    if (!search) return this.customers();
    return this.customers().filter(c =>
        c.name.toLowerCase().includes(search) ||
        c.customerCode.toLowerCase().includes(search)
    );
});

  constructor(
    private fb: FormBuilder,
    private saleService: SaleService,
    private customerService: CustomerService,
    private inventoryService: InventoryService,
    private router: Router
  ) {
    this.headerForm = this.fb.group({
      customerId: [null, Validators.required],
      paymentMethod: ['CASH', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadData();
    this.addRow();
  }

  private loadData(): void {
    this.dataLoading.set(true);
    let done = 0;
    const check = () => { if (++done === 2) this.dataLoading.set(false); };

    this.customerService.getAll().subscribe({
      next: res => { this.customers.set(res.data); check(); },
      error: () => check()
    });

    this.inventoryService.getAll().subscribe({
      next: res => {
        this.packTypes.set(res.data.map(p => ({ ...p, isLowStock: p.stockQty <= 10 })));
        check();
      },
      error: () => check()
    });
  }

  // ── Row management ──────────────────────────────────────────────

  addRow(): void {
    this.rows.update(rows => [
      ...rows,
      {
        id: this.nextRowId++, // Added
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

    // Load effective price for customer + pack
    if (customerId) {
      this.customerService.getEffectivePrice(customerId, packTypeId).subscribe({
        next: res => {
          this.updateRow(index, {
            packTypeId: packTypeId,
            packName: pack.packName,
            unitPriceSold: res.unitSellPrice,
            unitCostAtSale: pack.currentCost,
            availableStock: pack.stockQty
          });
          this.recomputeRow(index);
          this.validateStock(index);
          console.log('Effective price loaded:', res); // Debug
        }
      });
    } else {
      this.updateRow(index, {
        packTypeId: packTypeId,
        packName: pack.packName,
        unitPriceSold: 0,
        unitCostAtSale: pack.currentCost,
        availableStock: pack.stockQty
      });
      this.recomputeRow(index);
    }
    console.log('form', this.headerForm.value); // Debug
  }

  onCustomerChange(customerId: string | null): void {
    if (!customerId) return;
    // Reload prices for all already-selected packs
    this.rows().forEach((row, index) => {
      if (row.packTypeId) {
        this.onPackChange(index, row.packTypeId);
      }
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

  private updateRow(index: number, partial: Partial<SaleItemRow>): void {
    this.rows.update(rows =>
      rows.map((r, i) => i === index ? { ...r, ...partial } : r)
    );
  }

  private recomputeRow(index: number): void {
    const row = this.rows()[index];
    const lineRevenue = row.qty * row.unitPriceSold;
    const lineCost = row.qty * row.unitCostAtSale;
    const lineProfit = lineRevenue - lineCost;
    this.updateRow(index, { lineRevenue, lineCost, lineProfit });
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

  getAvailablePacks(currentIndex: number): InventoryItem[] {
    const usedIds = this.rows()
      .filter((_, i) => i !== currentIndex)
      .map(r => r.packTypeId)
      .filter(Boolean) as string[];
    return this.packTypes().filter(p => !usedIds.includes(p.packTypeId));
  }

  // ── Submit ───────────────────────────────────────────────────────

  onSave(): void {
    if (!this.canSave()) return;
    this.error.set(null);
    this.loading.set(true);

    const validRows = this.rows().filter(
      r => r.packTypeId !== null && r.qty > 0 && r.unitPriceSold > 0
    );

    this.saleService.createSale({
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
        this.error.set(err?.error?.message ?? 'Failed to save sale. Please check stock and try again.');
      }
    });
  }

  onCancel(): void {
    this.router.navigate(['/sales']);
  }

  getCustomer(customerId: string | null): Customer | null {
    return customerId ? this.customers().find(c => c.customerId === customerId) ?? null : null;
  }
  onCustomerSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.customerSearchText.set(value);
    this.customerDropdownOpen.set(true);
    // Clear selection if user edits the text
    if (this.headerForm.value.customerId) {
        this.headerForm.patchValue({ customerId: null });
    }
}

selectCustomer(customer: Customer): void {
    this.headerForm.patchValue({ customerId: customer.customerId });
    this.customerSearchText.set(`${customer.name} (${customer.customerCode})`);
    this.customerDropdownOpen.set(false);
    this.headerForm.get('customerId')?.markAsTouched();
    this.onCustomerChange(customer.customerId);
}
}