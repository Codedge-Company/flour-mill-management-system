// src/app/features/dashboard/dashboard.component.ts
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../core/services/dashboard.service';
import { NotificationService } from '../../core/services/notification.service';
import { DashboardData, DateRange } from '../../core/models/dashboard';
import { InventoryItem } from '../../core/models/inventory';
import { InventoryService } from '../../core/services/inventory.service';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { RevenueChartComponent } from './components/revenue-chart/revenue-chart.component';
import { CustomerPerformanceChartComponent } from './components/customer-performance-chart/customer-performance-chart.component';
import { LowStockAlertPanelComponent } from './components/low-stock-alert-panel/low-stock-alert-panel.component';
import { LkrCurrencyPipe } from '../../shared/pipes/lkr-currency.pipe';

type RangePreset = 'today' | '7days' | '30days' | 'custom';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    StatCardComponent,
    PageHeaderComponent,
    RevenueChartComponent,
    CustomerPerformanceChartComponent,
    LowStockAlertPanelComponent,
    LkrCurrencyPipe
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  data     = signal<DashboardData | null>(null);
  loading  = signal(true);
  error    = signal<string | null>(null);

  lowStockItems  = signal<InventoryItem[]>([]);
  inventoryLoading = signal(true);

  activePreset = signal<RangePreset>('today');
  customFrom   = signal('');
  customTo     = signal('');
  showCustom   = signal(false);

  readonly presets: { key: RangePreset; label: string }[] = [
    { key: 'today',   label: 'Today'    },
    { key: '7days',   label: 'Last 7 Days' },
    { key: '30days',  label: 'Last 30 Days' },
    { key: 'custom',  label: 'Custom'   }
  ];

  summary = computed(() => this.data()?.summary ?? null);

  readonly icons = {
  revenue: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none"
    viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>`
};


  constructor(
    private dashboardService: DashboardService,
    private inventoryService: InventoryService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.applyPreset('today');
    this.loadInventory();
    this.notificationService.getUnreadCount().subscribe();
  }

  applyPreset(preset: RangePreset): void {
    this.activePreset.set(preset);
    this.showCustom.set(preset === 'custom');
    if (preset !== 'custom') {
      this.loadData(this.buildRange(preset));
    }
  }

  applyCustomRange(): void {
    if (!this.customFrom() || !this.customTo()) return;
    this.loadData({ dateFrom: this.customFrom(), dateTo: this.customTo() });
  }

  private buildRange(preset: RangePreset): DateRange {
    const today = new Date();
    const fmt   = (d: Date) => d.toISOString().split('T')[0];

    switch (preset) {
      case 'today':
        return { dateFrom: fmt(today), dateTo: fmt(today) };
      case '7days': {
        const from = new Date(today);
        from.setDate(today.getDate() - 6);
        return { dateFrom: fmt(from), dateTo: fmt(today) };
      }
      case '30days': {
        const from = new Date(today);
        from.setDate(today.getDate() - 29);
        return { dateFrom: fmt(from), dateTo: fmt(today) };
      }
      default:
        return { dateFrom: fmt(today), dateTo: fmt(today) };
    }
  }


private loadData(range: DateRange): void {
  console.log('Loading dashboard data for range:', range);
  this.loading.set(true);
  this.error.set(null);

  this.dashboardService.getData(range).subscribe({
    next: (res) => {
      console.log('Dashboard response:', res);
      console.log('Dashboard data:', res.data);
      console.log('Summary:', res.data.summary);
      console.log('Daily metrics:', res.data.dailyMetrics);
      console.log('Customer perf:', res.data.customerPerformance);
      
      this.data.set(res.data);
      this.loading.set(false);
    },
    error: (err) => {
      console.error('Dashboard error:', err);
      this.error.set('Failed to load dashboard data.');
      this.loading.set(false);
    }
  });
}


  private loadInventory(): void {
    this.inventoryService.getAll().subscribe({
      next: res => {
        this.lowStockItems.set(res.data.filter(i => i.isLowStock));
        this.inventoryLoading.set(false);
      },
      error: () => this.inventoryLoading.set(false)
    });
  }

  refresh(): void {
    if (this.activePreset() !== 'custom') {
      this.loadData(this.buildRange(this.activePreset()));
    } else {
      this.applyCustomRange();
    }
    this.loadInventory();
  }
}