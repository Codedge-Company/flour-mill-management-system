import { Component, Input, Output, EventEmitter, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SaleCreditSummary, CustomerPaymentResult } from '../../../core/models/payment.model';
import { PaymentApiService } from '../../../core/services/payment-api.service';
import { LkrCurrencyPipe } from '../../../shared/pipes/lkr-currency.pipe';

interface AllocationRow {
  summary: SaleCreditSummary;
  applied: number;
  balanceAfter: number;
}

const toC = (n: number) => Math.round((Number(n) || 0) * 100);

@Component({
  selector: 'app-customer-payment-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, LkrCurrencyPipe],
  templateUrl: './customer-payment-dialog.component.html',
  styleUrl: './customer-payment-dialog.component.css'
})
export class CustomerPaymentDialogComponent implements OnInit {
  @Input() customerId!: string;
  @Input() customerName = '';
  @Input() summaries: SaleCreditSummary[] = [];
  @Output() saved     = new EventEmitter<CustomerPaymentResult>();
  @Output() cancelled = new EventEmitter<void>();

  readonly todayStr = new Date().toISOString().split('T')[0];

  pending     = signal<SaleCreditSummary[]>([]);   // pending sales, oldest first
  mode        = signal<'auto' | 'select'>('auto');
  selected    = signal<Set<string>>(new Set());
  amount      = signal<number | null>(null);
  paymentDate = signal(this.todayStr);
  notes       = signal('');
  loading     = signal(false);
  error       = signal<string | null>(null);

  candidates = computed(() =>
    this.mode() === 'auto'
      ? this.pending()
      : this.pending().filter(s => this.selected().has(s.sale.saleId))
  );

  maxAmount = computed(() =>
    this.candidates().reduce((a, s) => a + toC(s.balanceDue), 0) / 100
  );

  // oldest-first split of the typed amount (same rule the server uses)
  allocation = computed<AllocationRow[]>(() => {
    let left = toC(this.amount() ?? 0);
    const rows: AllocationRow[] = [];
    for (const s of this.candidates()) {
      if (left <= 0) break;
      const dueC = toC(s.balanceDue);
      const take = Math.min(left, dueC);
      if (take <= 0) continue;
      rows.push({ summary: s, applied: take / 100, balanceAfter: (dueC - take) / 100 });
      left -= take;
    }
    return rows;
  });

  amountError = computed(() => {
    const a = this.amount();
    if (a === null || a === undefined || !(a > 0)) return null;
    if (toC(a) > toC(this.maxAmount())) return `Amount is more than the outstanding balance (max ${this.maxAmount().toFixed(2)})`;
    return null;
  });

  canSubmit = computed(() => {
    const a = this.amount();
    return !!a && a > 0 && !this.amountError() && this.candidates().length > 0 && !!this.paymentDate() && !this.loading();
  });

  constructor(private paymentSvc: PaymentApiService) {}

  ngOnInit(): void {
    const sorted = this.summaries
      .filter(s => !s.isPaid)
      .sort((a, b) => new Date(a.sale.saleDatetime).getTime() - new Date(b.sale.saleDatetime).getTime());
    this.pending.set(sorted);
    this.amount.set(this.maxAmount());
  }

  setMode(m: 'auto' | 'select'): void {
    this.mode.set(m);
    if (m === 'select') this.selected.set(new Set());
    this.amount.set(this.maxAmount() > 0 ? this.maxAmount() : null);
  }

  toggle(id: string): void {
    const next = new Set(this.selected());
    next.has(id) ? next.delete(id) : next.add(id);
    this.selected.set(next);
    this.amount.set(this.maxAmount() > 0 ? this.maxAmount() : null);
  }

  payFull(): void { this.amount.set(this.maxAmount()); }

  remainingAfter(): number {
    return Math.max(0, this.maxAmount() - (this.amount() ?? 0));
  }

  onSubmit(): void {
    if (!this.canSubmit()) return;
    this.error.set(null);
    this.loading.set(true);
    this.paymentSvc.addCustomerPayment(this.customerId, {
      amount:      this.amount()!,
      paymentDate: this.paymentDate(),
      notes:       this.notes(),
      saleIds:     this.mode() === 'select' ? [...this.selected()] : undefined,
    }).subscribe({
      next: res => { this.loading.set(false); this.saved.emit(res); },
      error: err => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'Failed to record payment.');
      }
    });
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}