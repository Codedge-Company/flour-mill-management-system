import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SaleService } from '../../../core/services/sale.service';
import { Sale } from '../../../core/models/sale';
import { PageHeaderComponent, Breadcrumb } from '../../../shared/components/page-header/page-header.component';
import { LkrCurrencyPipe } from '../../../shared/pipes/lkr-currency.pipe';
import { StatusBadgePipe } from '../../../shared/pipes/status-badge.pipe';

@Component({
  selector: 'app-sale-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    PageHeaderComponent,
    LkrCurrencyPipe,
    StatusBadgePipe
  ],
  templateUrl: './sale-detail.component.html',
  styleUrl: './sale-detail.component.css'
})
export class SaleDetailComponent implements OnInit {
  sale = signal<Sale | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  get breadcrumbs(): Breadcrumb[] {
    return [
      { label: 'Sales', route: '/sales' },
      { label: this.sale()?.saleNo ?? 'Loading...' }
    ];
  }

  constructor(
    private saleService: SaleService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('No sale ID provided.');
      this.loading.set(false);
      return;
    }

    this.saleService.getById(id).subscribe({
      next: (res) => {
        console.log('Sale detail loaded:', res.data);
        this.sale.set(res.data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Sale load error:', err);
        this.error.set('Sale not found or failed to load.');
        this.loading.set(false);
      }
    });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-LK', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  onPrint(): void {
    window.print();
  }
}
