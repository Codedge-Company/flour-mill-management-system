// src/app/features/sales/sale-list/sale-list.component.ts
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SaleService } from '../../../core/services/sale.service';
import { CustomerService } from '../../../core/services/customer.service';
import { Sale, SaleFilters, SaleStatus } from '../../../core/models/sale';
import { Customer } from '../../../core/models/customer';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { LkrCurrencyPipe } from '../../../shared/pipes/lkr-currency.pipe';
import { StatusBadgePipe } from '../../../shared/pipes/status-badge.pipe';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-sale-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    PageHeaderComponent,
    LkrCurrencyPipe,
    StatusBadgePipe,
    ConfirmDialogComponent
  ],
  templateUrl: './sale-list.component.html',
  styleUrl: './sale-list.component.css'
})
export class SaleListComponent implements OnInit {
  sales          = signal<Sale[]>([]);
  customers      = signal<Customer[]>([]);
  loading        = signal(true);
  error          = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Filters
  filterCustomerId = signal<string | null>(null);
  filterStatus     = signal<SaleStatus | ''>('');
  filterDateFrom   = signal('');
  filterDateTo     = signal('');

  // Pagination
  currentPage  = signal(0);
  totalPages   = signal(0);
  totalElements = signal(0);
  pageSize     = 20;

  // Cancel dialog
  cancelTarget  = signal<Sale | null>(null);
  cancelLoading = signal(false);

  // Summary
  filteredRevenue = signal(0);
  filteredProfit  = signal(0);

  constructor(
    private saleService: SaleService,
    private customerService: CustomerService
  ) {}

  ngOnInit(): void {
    this.loadCustomers();
    this.load();
  }

  loadCustomers(): void {
    this.customerService.getAll().subscribe({
      next: res => this.customers.set(res.data)
    });
  }

load(page = 0): void {
  this.loading.set(true);
  this.error.set(null);

  const filters: SaleFilters = {};
  if (this.filterCustomerId()) filters.customerId = this.filterCustomerId()!;
  if (this.filterStatus() && this.filterStatus() !== '') filters.status = this.filterStatus() as SaleStatus;
  if (this.filterDateFrom()) filters.dateFrom = this.filterDateFrom();
  if (this.filterDateTo()) filters.dateTo = this.filterDateTo();

  this.saleService.getSales(filters, page, this.pageSize).subscribe({
    next: (res) => {
      console.log('Loaded sales:', res); // Debug
      const paged = res.data;
      this.sales.set(paged.content);
      this.currentPage.set(paged.page || 0);
      this.totalPages.set(paged.totalPages || 0);
      this.totalElements.set(paged.totalElements || 0);
      this.computeSummary(paged.content);
      this.loading.set(false);
    },
    error: (err) => {
      console.error('Load error:', err);
      this.error.set('Failed to load sales.');
      this.loading.set(false);
    }
  });
}


  applyFilters(): void { this.load(0); }

  clearFilters(): void {
    this.filterCustomerId.set(null);
    this.filterStatus.set('');
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.load(0);
  }

  get hasActiveFilters(): boolean {
    return !!(
      this.filterCustomerId() ||
      this.filterStatus() ||
      this.filterDateFrom() ||
      this.filterDateTo()
    );
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.load(page);
  }

  get pages(): number[] {
    const total = this.totalPages();
    const cur   = this.currentPage();
    const range: number[] = [];
    const delta = 2;
    for (let i = Math.max(0, cur - delta); i <= Math.min(total - 1, cur + delta); i++) {
      range.push(i);
    }
    return range;
  }

  confirmCancel(sale: Sale): void { this.cancelTarget.set(sale); }
  cancelDialog(): void            { this.cancelTarget.set(null); }

  onCancelSale(): void {
    const sale = this.cancelTarget();
    if (!sale) return;
    this.cancelLoading.set(true);

    this.saleService.cancelSale(sale.saleId).subscribe({
      next: () => {
        this.cancelLoading.set(false);
        this.cancelTarget.set(null);
        this.showSuccess(`Sale ${sale.saleNo} cancelled.`);
        this.load(this.currentPage());
      },
      error: err => {
        this.cancelLoading.set(false);
        this.cancelTarget.set(null);
        this.error.set(err?.error?.message ?? 'Failed to cancel sale.');
      }
    });
  }

  private computeSummary(sales: Sale[]): void {
    const saved = sales.filter(s => s.status === 'SAVED');
    this.filteredRevenue.set(saved.reduce((a, s) => a + s.totalRevenue, 0));
    this.filteredProfit.set(saved.reduce((a, s) => a + s.totalProfit, 0));
  }

  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(null), 3500);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-LK', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  getPaymentIcon(method: string): string {
    const icons: Record<string, string> = {
      CASH: '💵', CARD: '💳', BANK: '🏦'
    };
    return icons[method] ?? '';
  }
}