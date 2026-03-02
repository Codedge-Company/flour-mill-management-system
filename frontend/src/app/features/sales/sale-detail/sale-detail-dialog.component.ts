import { Component, Input, Output, EventEmitter, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SaleService } from '../../../core/services/sale.service';
import { Sale } from '../../../core/models/sale';
import { LkrCurrencyPipe } from '../../../shared/pipes/lkr-currency.pipe';
import { StatusBadgePipe } from '../../../shared/pipes/status-badge.pipe';

@Component({
  selector: 'app-sale-detail-dialog',
  standalone: true,
  imports: [CommonModule, RouterLink, LkrCurrencyPipe, StatusBadgePipe],
  templateUrl: './sale-detail-dialog.component.html',
  styleUrl: './sale-detail-dialog.component.css'
})
export class SaleDetailDialogComponent implements OnInit {
  @Input() saleId!: string;
  @Output() closed = new EventEmitter<void>();

  sale = signal<Sale | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  constructor(private saleService: SaleService) { }

  ngOnInit(): void {
    this.saleService.getById(this.saleId).subscribe({
      next: res => {
        this.sale.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load sale details.');
        this.loading.set(false);
      }
    });
  }

  formatDate(dateStr: string): string {
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
}