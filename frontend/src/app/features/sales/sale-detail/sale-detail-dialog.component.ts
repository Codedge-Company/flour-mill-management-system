// sale-detail-dialog.component.ts
import { Component, Input, Output, EventEmitter, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SaleService } from '../../../core/services/sale.service';
import { PaymentApiService } from '../../../core/services/payment-api.service';
import { Sale } from '../../../core/models/sale';
import { Payment } from '../../../core/models/payment.model';
import { LkrCurrencyPipe } from '../../../shared/pipes/lkr-currency.pipe';

@Component({
  selector: 'app-sale-detail-dialog',
  standalone: true,
  imports: [CommonModule, RouterLink, LkrCurrencyPipe, DatePipe],
  templateUrl: './sale-detail-dialog.component.html',
  styleUrl: './sale-detail-dialog.component.css'
})
export class SaleDetailDialogComponent implements OnInit {
  @Input() saleId!: string;
  @Output() closed = new EventEmitter<void>();

  sale            = signal<Sale | null>(null);
  loading         = signal(true);
  error           = signal<string | null>(null);
  payments        = signal<Payment[]>([]);
  paymentsLoading = signal(false);

  // Expose reduce helper for template
  sumAmt = (acc: number, p: Payment) => acc + p.amount;

  constructor(
    private saleService: SaleService,
    private paymentService: PaymentApiService
  ) {}

  ngOnInit(): void {
    this.saleService.getById(this.saleId).subscribe({
      next: res => {
        this.sale.set(res.data);
        this.loading.set(false);
        // Load payments if CREDIT
        if (res.data.paymentMethod === 'CREDIT') {
          this.loadPayments();
        }
      },
      error: () => {
        this.error.set('Failed to load sale details.');
        this.loading.set(false);
      }
    });
  }

  private loadPayments(): void {
    this.paymentsLoading.set(true);
    this.paymentService.getBySale(this.saleId).subscribe({
      next: res => {
        this.payments.set(res.data);
        this.paymentsLoading.set(false);
      },
      error: () => {
        this.paymentsLoading.set(false);
      }
    });
  }

  // ── Template helpers ────────────────────────────────────────────────────────

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-LK', {
      weekday: 'short', day: '2-digit', month: 'short',
      year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  get profitMargin(): number {
    const s = this.sale();
    if (!s || s.totalRevenue === 0) return 0;
    return Math.round((s.totalProfit / s.totalRevenue) * 100);
  }

  getCreditPct(totalRevenue: number): number {
    if (totalRevenue === 0) return 0;
    const paid = this.payments().reduce(this.sumAmt, 0);
    return Math.min(100, Math.round((paid / totalRevenue) * 100));
  }

  getCreditBalance(totalRevenue: number): number {
    const paid = this.payments().reduce(this.sumAmt, 0);
    return Math.max(0, totalRevenue - paid);
  }

  // ── CSS class helpers ───────────────────────────────────────────────────────

  getSaleStatusClass(status: string): string {
    return status === 'SAVED'
      ? 'status-badge badge-saved'
      : 'status-badge badge-cancelled';
  }

  getPaymentStatusClass(paymentStatus: string): string {
    return paymentStatus === 'PAID'
      ? 'pay-status-badge badge-paid'
      : 'pay-status-badge badge-pending';
  }

  getMethodBadgeClass(method: string): string {
    const map: Record<string, string> = {
      CASH:   'method-badge method-cash',
      CARD:   'method-badge method-card',
      BANK:   'method-badge method-bank',
      CREDIT: 'method-badge method-credit',
    };
    return map[method] ?? 'method-badge';
  }
}