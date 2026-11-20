import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentApiService } from '../../../core/services/payment-api.service';
import { SaleCreditSummary, CustomerPaymentResult } from '../../../core/models/payment.model';
import { LkrCurrencyPipe } from '../../../shared/pipes/lkr-currency.pipe';

interface PendingSale { saleId: string; saleNo: string; date: string; balance: number; }
interface PreviewRow  { saleNo: string; date: string; balance: number; applied: number; after: number; }

@Component({
  selector: 'app-customer-payment-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, LkrCurrencyPipe],
  templateUrl: './customer-payment-dialog.component.html',
  styleUrl: './customer-payment-dialog.component.css'
})
export class CustomerPaymentDialogComponent {
  @Input({ required: true }) customerId!: string;
  @Input() customerName = '';
  @Input() set summaries(list: SaleCreditSummary[]) {
    const pending = (list ?? [])
      .filter(s => !s.isPaid && s.balanceDue > 0)
      .map(s => ({
        saleId: s.sale.saleId, saleNo: s.sale.saleNo,
        date: s.sale.saleDatetime, balance: s.balanceDue
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    this.pending.set(pending);
  }
  @Output() saved     = new EventEmitter<CustomerPaymentResult>();
  @Output() cancelled = new EventEmitter<void>();

  pending  = signal<PendingSale[]>([]);
  amount   = signal<number | null>(null);
  payDate  = signal(this.colomboToday());
  notes    = signal('');
  mode     = signal<'AUTO' | 'SELECT'>('AUTO');
  selected = signal<Set<string>>(new Set());
  saving   = signal(false);
  error    = signal<string | null>(null);

  // sales that take part in the allocation (all pending, or only the ticked ones)
  targets = computed(() =>
    this.mode() === 'AUTO'
      ? this.pending()
      : this.pending().filter(p => this.selected().has(p.saleId))
  );
  targetTotal = computed(() => this.cents(this.targets().reduce((a, p) => a + this.toC(p.balance), 0)));
  totalOutstanding = computed(() => this.cents(this.pending().reduce((a, p) => a + this.toC(p.balance), 0)));

  preview = computed<PreviewRow[]>(() => {
    let left = this.toC(this.amount() ?? 0);
    return this.targets().map(p => {
      const bal = this.toC(p.balance);
      const used = Math.min(left, bal);
      left -= used;
      return { saleNo: p.saleNo, date: p.date, balance: p.balance, applied: used / 100, after: (bal - used) / 100 };
    });
  });
  appliedTotal = computed(() => this.cents(this.preview().reduce((a, r) => a + this.toC(r.applied), 0)));
  advanceKept  = computed(() => {
    const amt = this.toC(this.amount() ?? 0);
    return Math.max(0, amt - this.toC(this.appliedTotal())) / 100;
  });

  canSave = computed(() => {
    const a = this.amount() ?? 0;
    if (!(a > 0) || this.saving() || !this.payDate()) return false;
    if (this.mode() === 'SELECT' && this.selected().size === 0) return false;
    return true;
  });

  private toC(n: number): number { return Math.round(n * 100); }
  private cents(c: number): number { return c / 100; }

  private colomboToday(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date());
  }

  constructor(private api: PaymentApiService) {}

  onAmount(v: number | string | null): void {
    this.amount.set(v === null || v === '' ? null : +v);
  }

  payFull(): void {
    this.amount.set(this.mode() === 'AUTO' ? this.totalOutstanding() : this.targetTotal());
  }

  setMode(m: 'AUTO' | 'SELECT'): void {
    this.mode.set(m);
    this.selected.set(new Set());
  }

  toggle(id: string): void {
    const s = new Set(this.selected());
    s.has(id) ? s.delete(id) : s.add(id);
    this.selected.set(s);
  }

  isSelected(id: string): boolean { return this.selected().has(id); }

  save(): void {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.error.set(null);
    this.api.addCustomerPayment(this.customerId, {
      amount: this.amount()!,
      paymentDate: this.payDate(),
      notes: this.notes().trim(),
      saleIds: this.mode() === 'SELECT' ? [...this.selected()] : undefined
    }).subscribe({
      next: res => { this.saving.set(false); this.saved.emit(res); },
      error: err => {
        this.saving.set(false);
        this.error.set(err?.error?.message ?? 'Failed to record payment.');
      }
    });
  }

  close(): void { if (!this.saving()) this.cancelled.emit(); }
}
