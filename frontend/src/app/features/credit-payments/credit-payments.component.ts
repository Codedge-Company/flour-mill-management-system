import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PaymentApiService } from '../../core/services/payment-api.service';
import { CustomerService } from '../../core/services/customer.service';
import { Customer } from '../../core/models/customer';
import { SaleCreditSummary, Payment } from '../../core/models/payment.model';
import { LkrCurrencyPipe } from '../../shared/pipes/lkr-currency.pipe';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { AddPaymentDialogComponent } from './add-payment-dialog/add-payment-dialog.component';
import { InvoicePdfService } from '../../core/services/invoice-pdf.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-credit-payments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    LkrCurrencyPipe,
    ConfirmDialogComponent,
    PageHeaderComponent,
    AddPaymentDialogComponent
  ],
  templateUrl: './credit-payments.component.html',
  styleUrl: './credit-payments.component.css'
})
export class CreditPaymentsComponent implements OnInit {

  customers         = signal<Customer[]>([]);
  selectedId        = signal<string | null>(null);
  summaries         = signal<SaleCreditSummary[]>([]);
  loading           = signal(false);
  customersLoading  = signal(true);
  error             = signal<string | null>(null);
  successMessage    = signal<string | null>(null);
  statusFilter      = signal<'all' | 'pending' | 'paid'>('pending');
  addPaymentTarget  = signal<SaleCreditSummary | null>(null);
  deletePaymentTarget = signal<Payment | null>(null);
  deleteLoading     = signal(false);
  downloadingId     = signal<string | null>(null);

  // ── NEW: Customer search ───────────────────────────────────────────────────
  searchQuery = signal('');

  filteredCustomers = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.customers();
    return this.customers().filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.customerCode?.toLowerCase().includes(q)
    );
  });
  // ── /NEW ──────────────────────────────────────────────────────────────────

  totalOutstanding = computed(() =>
    this.summaries().filter(s => !s.isPaid).reduce((a, s) => a + s.balanceDue, 0)
  );

  totalCredit = computed(() =>
    this.summaries().reduce((a, s) => a + s.sale.totalRevenue, 0)
  );

  filteredSummaries = computed(() => {
    const f = this.statusFilter();
    if (f === 'pending') return this.summaries().filter(s => !s.isPaid);
    if (f === 'paid')    return this.summaries().filter(s => s.isPaid);
    return this.summaries();
  });

  // ── NEW: pending count for tab badge ──────────────────────────────────────
  pendingCount = computed(() => this.summaries().filter(s => !s.isPaid).length);
  // ── /NEW ──────────────────────────────────────────────────────────────────

  selectedCustomer = computed(() =>
    this.customers().find(c => c.customerId === this.selectedId()) ?? null
  );

  constructor(
    private paymentSvc: PaymentApiService,
    private customerSvc: CustomerService,
    private invoicePdf: InvoicePdfService
  ) {}

  ngOnInit(): void {
    this.customerSvc.getAll().subscribe({
      next: res => { this.customers.set(res.data); this.customersLoading.set(false); }
    });
  }

  selectCustomer(id: string): void {
    this.selectedId.set(id);
    this.loadSummary(id);
  }

  loadSummary(customerId: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.paymentSvc.getCreditSummary(customerId).subscribe({
      next:  res => { this.summaries.set(res.data); this.loading.set(false); },
      error: ()  => { this.error.set('Failed to load credit summary.'); this.loading.set(false); }
    });
  }

  openAddPayment(s: SaleCreditSummary): void { this.addPaymentTarget.set(s); }

  onPaymentAdded(): void {
    this.addPaymentTarget.set(null);
    this.showSuccess('Payment recorded successfully.');
    const id = this.selectedId();
    if (id) this.loadSummary(id);
  }

  confirmDeletePayment(p: Payment): void  { this.deletePaymentTarget.set(p); }
  closeDeleteDialog(): void               { this.deletePaymentTarget.set(null); }

  onDeletePayment(): void {
    const p = this.deletePaymentTarget();
    if (!p) return;
    this.deleteLoading.set(true);
    this.paymentSvc.deletePayment(p.paymentId).subscribe({
      next: () => {
        this.deleteLoading.set(false);
        this.deletePaymentTarget.set(null);
        this.showSuccess('Payment removed.');
        const id = this.selectedId();
        if (id) this.loadSummary(id);
      },
      error: err => {
        this.deleteLoading.set(false);
        this.deletePaymentTarget.set(null);
        this.error.set(err?.error?.message ?? 'Failed to remove payment.');
      }
    });
  }

  downloadDueInvoice(s: SaleCreditSummary): void {
    this.downloadingId.set(s.sale.saleId);
    try { this.invoicePdf.generateDueInvoice(s); }
    finally { this.downloadingId.set(null); }
  }

  downloadProforma(s: SaleCreditSummary): void {
    this.downloadingId.set(s.sale.saleId);
    try { this.invoicePdf.generateProforma(s); }
    finally { this.downloadingId.set(null); }
  }

  downloadCustomerDueInvoice(): void {
    this.invoicePdf.generateCustomerDueInvoice(this.summaries());
  }

  downloadCustomerProforma(): void {
    this.invoicePdf.generateCustomerProforma(this.summaries());
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(null), 3500);
  }
}