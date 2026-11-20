import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PaymentApiService } from '../../core/services/payment-api.service';
import { CustomerService } from '../../core/services/customer.service';
import { Customer } from '../../core/models/customer';
import { SaleCreditSummary, Payment, CustomerPaymentResult, AdvanceEntry } from '../../core/models/payment.model';
import { LkrCurrencyPipe } from '../../shared/pipes/lkr-currency.pipe';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { AddPaymentDialogComponent } from './add-payment-dialog/add-payment-dialog.component';
import { CustomerPaymentDialogComponent } from './customer-payment-dialog/customer-payment-dialog.component';
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
    AddPaymentDialogComponent,
    CustomerPaymentDialogComponent
  ],
  templateUrl: './credit-payments.component.html',
  styleUrl: './credit-payments.component.css'
})
export class CreditPaymentsComponent implements OnInit {

  customers           = signal<Customer[]>([]);
  selectedId          = signal<string | null>(null);
  summaries           = signal<SaleCreditSummary[]>([]);
  loading             = signal(false);
  customersLoading    = signal(true);
  error               = signal<string | null>(null);
  successMessage      = signal<string | null>(null);
  statusFilter        = signal<'all' | 'pending' | 'paid'>('pending');
  addPaymentTarget    = signal<SaleCreditSummary | null>(null);
  deletePaymentTarget = signal<Payment | null>(null);
  deleteLoading       = signal(false);
  downloadingId       = signal<string | null>(null);

  // customer-level payment + whole-receipt delete
  showCustomerPayment = signal(false);
  deleteReceiptTarget = signal<string | null>(null);

  // advance (money the customer paid ahead)
  advance          = signal(0);
  advanceEntries   = signal<AdvanceEntry[]>([]);
  applyAdvanceOpen = signal(false);
  applyLoading     = signal(false);

  // ── Customer search ────────────────────────────────────────────────────────
  searchQuery = signal('');

  filteredCustomers = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.customers();
    return this.customers().filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.customerCode?.toLowerCase().includes(q)
    );
  });

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

  // advance that can be used right now on the pending sales
  advanceUsable = computed(() =>
    Math.round(Math.min(this.advance(), this.totalOutstanding()) * 100) / 100
  );

  // pending count for tab badge
  pendingCount = computed(() => this.summaries().filter(s => !s.isPaid).length);

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
    this.advance.set(0);
    this.advanceEntries.set([]);
    this.loadSummary(id);
  }

  loadSummary(customerId: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.paymentSvc.getCreditSummary(customerId).subscribe({
      next:  res => { this.summaries.set(res.data); this.loading.set(false); },
      error: ()  => { this.error.set('Failed to load credit summary.'); this.loading.set(false); }
    });
    this.loadAdvance(customerId);
  }

  loadAdvance(customerId: string): void {
    this.customerSvc.getAdvance(customerId).subscribe(info => {
      if (this.selectedId() !== customerId) return;
      this.advance.set(info.balance);
      this.advanceEntries.set(info.entries);
    });
  }

  // ── Single-sale payment (existing) ─────────────────────────────────────────
  openAddPayment(s: SaleCreditSummary): void { this.addPaymentTarget.set(s); }

  onPaymentAdded(): void {
    this.addPaymentTarget.set(null);
    this.showSuccess('Payment recorded successfully.');
    const id = this.selectedId();
    if (id) this.loadSummary(id);
  }

  // ── Customer-level payment (one amount, spread over pending sales) ─────────
  openCustomerPayment(): void { this.showCustomerPayment.set(true); }

  onCustomerPaymentSaved(res: CustomerPaymentResult): void {
    this.showCustomerPayment.set(false);
    const adv = res.advance_added ? ` LKR ${res.advance_added.toFixed(2)} kept as advance.` : '';
    this.showSuccess(`Payment ${res.receipt_no} recorded (LKR ${res.amount.toFixed(2)}).${adv}`);
    const id = this.selectedId();
    if (id) this.loadSummary(id);
  }

  // ── Use the customer's advance on the pending sales (oldest first) ─────────
  applyAdvanceMessage(): string {
    return `Use LKR ${this.advanceUsable().toFixed(2)} of this customer's advance (balance LKR ${this.advance().toFixed(2)}) to pay the pending sales, oldest first?`;
  }

  onApplyAdvance(): void {
    const id = this.selectedId();
    if (!id) return;
    this.applyLoading.set(true);
    this.paymentSvc.applyAdvance(id).subscribe({
      next: res => {
        this.applyLoading.set(false);
        this.applyAdvanceOpen.set(false);
        this.showSuccess(`LKR ${res.advance_used.toFixed(2)} of advance used (${res.receipt_no}).`);
        this.loadSummary(id);
      },
      error: err => {
        this.applyLoading.set(false);
        this.applyAdvanceOpen.set(false);
        this.error.set(err?.error?.message ?? 'Failed to use advance.');
      }
    });
  }

  // ── Delete a single payment (payments made without a receipt) ──────────────
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

  // ── Delete a whole receipt ─────────────────────────────────────────────────
  receiptPayments(receiptNo: string): Payment[] {
    return this.summaries().flatMap(s => s.payments.filter(p => p.receiptNo === receiptNo));
  }

  confirmDeleteReceipt(receiptNo: string): void { this.deleteReceiptTarget.set(receiptNo); }
  closeReceiptDialog(): void                    { this.deleteReceiptTarget.set(null); }

  receiptDeleteMessage(): string {
    const no = this.deleteReceiptTarget();
    if (!no) return '';
    const items = this.receiptPayments(no);
    const total = items.reduce((a, p) => a + p.amount, 0);
    const parts = items.map(p => `${p.saleNo}: ${p.amount.toFixed(2)}`).join(', ');
    const deposit = this.advanceEntries().find(e => e.type === 'DEPOSIT' && e.receiptNo === no);
    let msg = items.length
      ? `Remove receipt ${no} (LKR ${total.toFixed(2)})? This removes: ${parts}. The balances of these sales will increase.`
      : `Remove receipt ${no}?`;
    if (deposit) msg += ` The advance of LKR ${deposit.amount.toFixed(2)} kept from this receipt will also be removed.`;
    if (items.some(p => p.source === 'ADVANCE')) msg += ' The advance that was used goes back to the customer.';
    return msg;
  }

  onDeleteReceipt(): void {
    const no = this.deleteReceiptTarget();
    if (!no) return;
    this.deleteLoading.set(true);
    this.paymentSvc.deleteReceipt(no).subscribe({
      next: () => {
        this.deleteLoading.set(false);
        this.deleteReceiptTarget.set(null);
        this.showSuccess(`Receipt ${no} removed.`);
        const id = this.selectedId();
        if (id) this.loadSummary(id);
      },
      error: err => {
        this.deleteLoading.set(false);
        this.deleteReceiptTarget.set(null);
        this.error.set(err?.error?.message ?? 'Failed to remove receipt.');
      }
    });
  }

  // ── PDFs ───────────────────────────────────────────────────────────────────
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

  // ── Thermal printer slips ──────────────────────────────────────────────────
  printDueSlip(s: SaleCreditSummary): void {
    this.paymentSvc.printDueSlip(s.sale.saleId).subscribe({
      next: () => this.showSuccess(`Due payment slip for ${s.sale.saleNo} sent to printer.`),
      error: () => this.error.set('Failed to print due slip.'),
    });
  }

  printCustomerDueSlip(): void {
    const id = this.selectedId();
    if (!id) return;
    this.paymentSvc.printCustomerDueSlip(id).subscribe({
      next: () => this.showSuccess('Overall due slip sent to printer.'),
      error: err => this.error.set(err?.error?.message ?? 'Failed to print overall due slip.'),
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
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
