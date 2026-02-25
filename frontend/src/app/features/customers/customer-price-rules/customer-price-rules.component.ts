import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CustomerService } from '../../../core/services/customer.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { CustomerPriceRule } from '../../../core/models/customer-price-rule';
import { InventoryItem } from '../../../core/models/inventory';
import { Customer } from '../../../core/models/customer';
import { PageHeaderComponent, Breadcrumb } from '../../../shared/components/page-header/page-header.component';
import { LkrCurrencyPipe } from '../../../shared/pipes/lkr-currency.pipe';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-customer-price-rules',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    LkrCurrencyPipe,
    ConfirmDialogComponent
  ],
  templateUrl: './customer-price-rules.component.html',
  styleUrl: './customer-price-rules.component.css'
})
export class CustomerPriceRulesComponent implements OnInit {
  customer = signal<Customer | null>(null);
  rules = signal<CustomerPriceRule[]>([]);
  packTypes = signal<InventoryItem[]>([]);
  loading = signal(true);
  saveLoading = signal(false);
  error = signal<string | null>(null);
  successMsg = signal<string | null>(null);
  showForm = signal(false);
  editingRule = signal<CustomerPriceRule | null>(null);
  deleteTarget = signal<CustomerPriceRule | null>(null);
  deleteLoad = signal(false);

  form: FormGroup;
  customerId!: string;

  get breadcrumbs(): Breadcrumb[] {
    return [
      { label: 'Customers', route: '/customers' },
      { label: this.customer()?.name ?? '...', route: '/customers' },
      { label: 'Price Rules' }
    ];
  }

  get f() { return this.form.controls; }

get availablePacks(): InventoryItem[] {
  // Null-safe: ensure both arrays exist before processing
  const rules = this.rules() ?? [];
  const packTypes = this.packTypes() ?? [];
  
  const usedIds = rules
    .filter(r => !this.editingRule() || r.priceRuleId !== this.editingRule()!.priceRuleId)
    .map(r => r.packTypeId);
    
  return packTypes.filter(p => !usedIds.includes(p.packTypeId));
}


  constructor(
    private fb: FormBuilder,
    private customerService: CustomerService,
    private inventoryService: InventoryService,
    private route: ActivatedRoute
  ) {
    this.form = this.fb.group({
      packTypeId: [null, Validators.required],
      unitSellPrice: [null, [Validators.required, Validators.min(0.01)]]
    });
  }

  ngOnInit(): void {
    this.customerId = this.route.snapshot.paramMap.get('id') || '';
    this.loadAll();
  }

  loadAll(): void {
    this.loading.set(true);

    // Load customer (non-blocking)
    this.customerService.getById(this.customerId).subscribe({
      next: res => this.customer.set(res.data),
      error: () => { }  // non-fatal
    });

    // Load pack types from InventoryService - matches InventoryItem perfectly
    this.inventoryService.getAll().subscribe({
      next: res => this.packTypes.set(res.data),
      error: () => { }  // non-fatal, cost hints will show 0
    });

    // Load price rules
    this.customerService.getPriceRules(this.customerId).subscribe({
      next: res => {
        this.rules.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load price rules.');
        this.loading.set(false);
      }
    });
  }

  openAddForm(): void {
    this.editingRule.set(null);
    this.form.reset();
    this.form.get('packTypeId')?.enable();
    this.showForm.set(true);
  }

  openEditForm(rule: CustomerPriceRule): void {
    this.editingRule.set(rule);
    this.form.patchValue({
      packTypeId: rule.packTypeId,
      unitSellPrice: rule.unitSellPrice
    });
    this.form.get('packTypeId')?.disable();
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingRule.set(null);
    this.form.reset();
    this.form.get('packTypeId')?.enable();
  }

onSave(): void {
  if (this.form.invalid || this.saveLoading()) return;
  this.error.set(null);
  this.saveLoading.set(true);

  const raw = this.form.getRawValue();

  this.customerService.upsertPriceRule({
    customerId: this.customerId,
    packTypeId: raw.packTypeId,
    unitSellPrice: raw.unitSellPrice
  }).subscribe({
    next: (response) => {
      console.log('Save response:', response); // Debug log
      this.saveLoading.set(false);
      this.closeForm();
      this.showSuccess('Price rule saved successfully.');
      this.loadAll();
    },
    error: (err) => {
      console.error('Save error:', err); // Debug log
      this.saveLoading.set(false);
      
      // Handle both wrapped and raw responses
      const errorMsg = err.error?.message || 
                      err.error?.error || 
                      (typeof err.error === 'string' ? err.error : 'Failed to save price rule.');
      this.error.set(errorMsg);
    }
  });
}


  confirmDeleteRule(rule: CustomerPriceRule): void {
    this.deleteTarget.set(rule);
  }

  onDeleteRule(): void {
    const rule = this.deleteTarget();
    if (!rule) return;
    this.deleteLoad.set(true);

    this.customerService.deletePriceRule(this.customerId, rule.priceRuleId).subscribe({
      next: () => {
        this.deleteLoad.set(false);
        this.deleteTarget.set(null);
        this.showSuccess('Price rule removed.');
        this.loadAll();
      },
      error: err => {
        this.deleteLoad.set(false);
        this.deleteTarget.set(null);
        this.error.set(err?.error?.message ?? 'Failed to delete rule.');
      }
    });
  }

  getPackName(packTypeId: string): string {
    return this.packTypes().find(p => p.packTypeId === packTypeId)?.packName
      ?? this.rules().find(r => r.packTypeId === packTypeId)?.packName
      ?? '—';
  }

  getDefaultCost(packTypeId: string): number {
    return this.packTypes().find(p => p.packTypeId === packTypeId)?.currentCost ?? 0;
  }

  private showSuccess(msg: string): void {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(null), 3500);
  }

}
