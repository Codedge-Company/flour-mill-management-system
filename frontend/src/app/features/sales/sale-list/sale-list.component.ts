// src/app/features/sales/sale-list/sale-list.component.ts
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { SaleService } from '../../../core/services/sale.service';
import { CustomerService } from '../../../core/services/customer.service';
import { Sale, SaleFilters, SaleStatus, PaymentStatus } from '../../../core/models/sale';
import { AuthService } from '../../../core/services/auth.service';
import { Customer } from '../../../core/models/customer';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { LkrCurrencyPipe } from '../../../shared/pipes/lkr-currency.pipe';
import { StatusBadgePipe } from '../../../shared/pipes/status-badge.pipe';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { InvoicePdfService } from '../../../core/services/invoice-pdf.service';
import { Router } from '@angular/router';
import { SaleDetailDialogComponent } from '../sale-detail/sale-detail-dialog.component';

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
    ConfirmDialogComponent,
    SaleDetailDialogComponent
  ],
  templateUrl: './sale-list.component.html',
  styleUrl: './sale-list.component.css'
})
export class SaleListComponent implements OnInit {
  sales         = signal<Sale[]>([]);
  customers     = signal<Customer[]>([]);
  loading       = signal(true);
  error         = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // ── Filters ──────────────────────────────────────────────────────────────
  filterCustomerId   = signal<string | null>(null);
  filterStatus       = signal<SaleStatus | ''>('');
  filterPaymentStatus = signal<PaymentStatus | ''>('');   // ← NEW

  filterDateFrom = signal('');
  filterDateTo   = signal('');

  // ── Pagination ────────────────────────────────────────────────────────────
  currentPage   = signal(0);
  totalPages    = signal(0);
  totalElements = signal(0);
  pageSize      = 20;

  // ── Dialogs / actions ─────────────────────────────────────────────────────
  cancelTarget  = signal<Sale | null>(null);
  cancelLoading = signal(false);
  deleteTarget  = signal<Sale | null>(null);
  deleteLoading = signal(false);
  viewSaleId    = signal<string | null>(null);
  downloadingId = signal<string | null>(null);

  // ── Mark-as-paid ─────────────────────────────────────────────────────────
  markPaidTarget  = signal<Sale | null>(null);   // ← NEW: confirms before calling API
  markPaidLoading = signal(false);               // ← NEW

  // ── Summary ───────────────────────────────────────────────────────────────
  filteredRevenue = signal(0);
  filteredProfit  = signal(0);

  constructor(
    private saleService:   SaleService,
    private customerService: CustomerService,
    private invoicePdf:    InvoicePdfService,
    private authService:   AuthService,
    private router:        Router
  ) {}

  ngOnInit(): void {
    this.loadCustomers();
    this.load();
  }

  loadCustomers(): void {
    this.customerService.getAll().subscribe({ next: res => this.customers.set(res.data) });
  }

  load(page = 0): void {
    this.loading.set(true);
    this.error.set(null);

    const filters: SaleFilters = {};
    if (this.filterCustomerId())    filters.customerId    = this.filterCustomerId()!;
    if (this.filterStatus())        filters.status        = this.filterStatus() as SaleStatus;
    if (this.filterPaymentStatus()) filters.paymentStatus = this.filterPaymentStatus() as PaymentStatus;  // ← NEW
    if (this.filterDateFrom())      filters.dateFrom      = this.filterDateFrom();
    if (this.filterDateTo())        filters.dateTo        = this.filterDateTo();

    this.saleService.getSales(filters, page, this.pageSize).subscribe({
      next: (res) => {
        const paged = res.data;
        this.sales.set(paged.content);
        this.currentPage.set(paged.page || 0);
        this.totalPages.set(paged.totalPages || 0);
        this.totalElements.set(paged.totalElements || 0);
        this.computeSummary(paged.content);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load sales.');
        this.loading.set(false);
      }
    });
  }

  applyFilters(): void { this.load(0); }

  clearFilters(): void {
    this.filterCustomerId.set(null);
    this.filterStatus.set('');
    this.filterPaymentStatus.set('');
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.load(0);
  }

  get hasActiveFilters(): boolean {
    return !!(
      this.filterCustomerId()    ||
      this.filterStatus()        ||
      this.filterPaymentStatus() ||
      this.filterDateFrom()      ||
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
    for (let i = Math.max(0, cur - 2); i <= Math.min(total - 1, cur + 2); i++) range.push(i);
    return range;
  }

  changePageSize(size: number): void {
    this.pageSize = size;
    this.currentPage.set(0);
    this.load(0);
  }

  // ── Cancel ────────────────────────────────────────────────────────────────
  confirmCancel(sale: Sale): void  { this.cancelTarget.set(sale); }
  cancelDialog(): void             { this.cancelTarget.set(null); }

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

  // ── Delete ────────────────────────────────────────────────────────────────
  confirmDelete(sale: Sale): void { this.deleteTarget.set(sale); }
  deleteDialog(): void            { this.deleteTarget.set(null); }

  onDeleteSale(): void {
    const sale = this.deleteTarget();
    if (!sale) return;
    this.deleteLoading.set(true);
    this.saleService.deleteSale(sale.saleId).subscribe({
      next: () => {
        this.deleteLoading.set(false);
        this.deleteTarget.set(null);
        this.showSuccess(`Sale ${sale.saleNo} deleted.`);
        this.load(this.currentPage());
      },
      error: err => {
        this.deleteLoading.set(false);
        this.deleteTarget.set(null);
        this.error.set(err?.error?.message ?? 'Failed to delete sale.');
      }
    });
  }

  // ── Mark as Paid ──────────────────────────────────────────────────────────
  confirmMarkPaid(sale: Sale): void { this.markPaidTarget.set(sale); }
  markPaidDialog(): void            { this.markPaidTarget.set(null); }

  onMarkAsPaid(): void {
    const sale = this.markPaidTarget();
    if (!sale) return;
    this.markPaidLoading.set(true);
    this.saleService.markAsPaid(sale.saleId).subscribe({
      next: () => {
        this.markPaidLoading.set(false);
        this.markPaidTarget.set(null);
        this.showSuccess(`Payment for ${sale.saleNo} marked as received.`);
        this.load(this.currentPage());
      },
      error: err => {
        this.markPaidLoading.set(false);
        this.markPaidTarget.set(null);
        this.error.set(err?.error?.message ?? 'Failed to mark payment as paid.');
      }
    });
  }

  // ── View ──────────────────────────────────────────────────────────────────
  openView(sale: Sale): void  { this.viewSaleId.set(sale.saleId); }
  closeView(): void           { this.viewSaleId.set(null); }

  // ── Invoice ───────────────────────────────────────────────────────────────
  downloadInvoice(sale: Sale): void {
    if (this.downloadingId()) return;
    this.downloadingId.set(sale.saleId);
    forkJoin({
      saleDetail: this.saleService.getById(sale.saleId),
      customer:   this.customerService.getById(sale.customerId)
    }).subscribe({
      next: ({ saleDetail, customer }) => {
        try {
          this.invoicePdf.generate(saleDetail.data, customer.data);
          this.downloadingId.set(null);
          this.showSuccess(`Invoice ${sale.saleNo} downloaded.`);
        } catch {
          this.downloadingId.set(null);
          this.error.set('Failed to generate invoice PDF.');
        }
      },
      error: () => {
        this.downloadingId.set(null);
        this.error.set('Failed to load invoice data.');
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
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

  get isAdmin(): boolean {
    return this.authService.currentUser()?.role === 'ADMIN';
  }

  /** Whether a sale has an outstanding (unpaid) credit balance */
  isPendingCredit(sale: Sale): boolean {
    return sale.paymentMethod === 'CREDIT' && sale.paymentStatus === 'PENDING';
  }
}