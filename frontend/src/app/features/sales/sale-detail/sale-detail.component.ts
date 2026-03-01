import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SaleService } from '../../../core/services/sale.service';
import { CustomerService } from '../../../core/services/customer.service';
import { InvoicePdfService } from '../../../core/services/invoice-pdf.service';
import { Sale } from '../../../core/models/sale';
import { Customer } from '../../../core/models/customer';
import { PageHeaderComponent, Breadcrumb } from '../../../shared/components/page-header/page-header.component';
import { LkrCurrencyPipe } from '../../../shared/pipes/lkr-currency.pipe';
import { StatusBadgePipe } from '../../../shared/pipes/status-badge.pipe';

@Component({
  selector: 'app-sale-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeaderComponent, LkrCurrencyPipe, StatusBadgePipe],
  templateUrl: './sale-detail.component.html',
  styleUrl: './sale-detail.component.css'
})
export class SaleDetailComponent implements OnInit {
  sale = signal<Sale | null>(null);
  customer = signal<Customer | null>(null);
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
    private customerService: CustomerService,
    private invoicePdfService: InvoicePdfService,
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
        this.sale.set(res.data);
        // Fetch customer after sale loads using customerId from sale
        this.customerService.getById(res.data.customerId).subscribe({
          next: (custRes) => {
            this.customer.set(custRes.data);
            this.loading.set(false);
          },
          error: () => {
            // Still allow page to load even if customer fetch fails
            this.loading.set(false);
          }
        });
      },
      error: (err) => {
        console.error('Sale load error:', err);
        this.error.set('Sale not found or failed to load.');
        this.loading.set(false);
      }
    });
  }

  onDownloadInvoice(): void {
    const sale = this.sale();
    const customer = this.customer();
    if (!sale || !customer) return;
    this.invoicePdfService.generate(sale, customer);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-LK', {
      weekday: 'long', day: '2-digit', month: 'long',
      year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  onPrint(): void {
    window.print();
  }
}
