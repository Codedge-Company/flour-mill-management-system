import {
  Component, OnInit, signal, computed, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { CalendarModule } from 'primeng/calendar';
import { BadgeModule } from 'primeng/badge';
import { MessageModule } from 'primeng/message';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TooltipModule } from 'primeng/tooltip';
import { KnobModule } from 'primeng/knob';

// App
import { DashboardService } from '../../core/services/dashboard.service';
import { NotificationService } from '../../core/services/notification.service';
import { InventoryService } from '../../core/services/inventory.service';
import { DashboardData, DateRange, DailyMetric } from '../../core/models/dashboard';
import { InventoryItem } from '../../core/models/inventory';

import { RevenueChartComponent }
  from './components/revenue-chart/revenue-chart.component';
import { CustomerPerformanceChartComponent }
  from './components/customer-performance-chart/customer-performance-chart.component';
import { LowStockAlertPanelComponent }
  from './components/low-stock-alert-panel/low-stock-alert-panel.component';
import { LkrCurrencyPipe } from '../../shared/pipes/lkr-currency.pipe';
import { SaleService } from '../../core/services/sale.service';
import { SaleFilters } from '../../core/models/sale';

// ── TYPE DEFINITION ─────────────────────────────────────────────────────────
type RangePreset = 'all' | 'today' | 'yesterday' | '7days' | '30days' | 'custom';
// ── WEIGHT SUMMARY ──────────────────────────────────────────────────────────
export interface PackWeightSummary {
  packTypeId: string;
  packName: string;
  weightKg: number;
  qty: number;
  totalWeight: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, RouterLink, DecimalPipe, DatePipe,
    ButtonModule, ChartModule, CalendarModule, BadgeModule,
    MessageModule, SelectButtonModule, TooltipModule, KnobModule,
    RevenueChartComponent,
    CustomerPerformanceChartComponent,
    LowStockAlertPanelComponent,
    LkrCurrencyPipe,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  // ── Signals ────────────────────────────────────────────────────────────────
  data = signal<DashboardData | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  lowStockItems = signal<InventoryItem[]>([]);
  inventoryLoading = signal(true);
  activePreset = signal<RangePreset>('all');  // ✅ DEFAULT TODAY
  showCustom = signal(false);
  showCustomRange = signal(false);  // ✅ NEW Custom dropdown toggle

  // ── Date Pickers ───────────────────────────────────────────────────────────
  singleDate: Date | null = null;
  customFromDate = signal<Date | null>(null);
  customToDate = signal<Date | null>(null);
  today = new Date();

  // Chart view toggle
  chartView = 'both';
  chartViewOpts = [
    { label: 'All', value: 'both' },
    { label: 'Bars', value: 'bars' },
    { label: 'Trend', value: 'trend' },
  ];

  // ── Computed ───────────────────────────────────────────────────────────────
  summary = computed(() => this.data()?.summary ?? null);
  dailyMetrics = computed(() => this.data()?.dailyMetrics ?? []);

  // ✅ Check if we have enough data for meaningful deltas
  hasSufficientData = computed(() => this.dailyMetrics().length >= 2);

  profitMargin = computed(() => {
    const s = this.summary();
    if (!s || !s.totalRevenue) return 0;
    return +((s.totalProfit / s.totalRevenue) * 100).toFixed(1);
  });

  // ✅ Custom Range Label
  customRangeLabel = computed(() => {
    const from = this.customFromDate();
    const to = this.customToDate();
    if (!from || !to) return 'Custom Range';
    return `${from.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} → ${to.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`;
  });

  isCustomRangeValid = computed(() => !!this.customFromDate() && !!this.customToDate());


  // ── DYNAMIC PERCENTAGE DELTAS ──────────────────────────────────────────────
  prevTotals = computed(() => {
    const metrics = this.dailyMetrics();
    if (metrics.length < 2) {
      return { revenue: 0, cost: 0, profit: 0, sales: 0 };
    }

    // Simple: use first half of data as "previous period"
    const midPoint = Math.floor(metrics.length / 2);
    const prevMetrics = metrics.slice(0, midPoint);

    return {
      revenue: prevMetrics.reduce((sum, m) => sum + m.revenue, 0),
      cost: prevMetrics.reduce((sum, m) => sum + m.cost, 0),
      profit: prevMetrics.reduce((sum, m) => sum + m.profit, 0),
      sales: prevMetrics.reduce((sum, m) => sum + ((m as any).salesCount || 0), 0)
    };
  });

  revenueDelta = computed(() => {
    if (!this.hasSufficientData()) return 0;
    const curr = this.summary()?.totalRevenue ?? 0;
    const prev = this.prevTotals().revenue;
    return prev ? ((curr - prev) / prev * 100) : 0;
  });

  costDelta = computed(() => {
    if (!this.hasSufficientData()) return 0;
    const curr = this.summary()?.totalCost ?? 0;
    const prev = this.prevTotals().cost;
    return prev ? ((curr - prev) / prev * 100) : 0;
  });

  profitDelta = computed(() => {
    if (!this.hasSufficientData()) return 0;
    const curr = this.summary()?.totalProfit ?? 0;
    const prev = this.prevTotals().profit;
    return prev ? ((curr - prev) / prev * 100) : 0;
  });

  salesDelta = computed(() => {
    if (!this.hasSufficientData()) return 0;
    const curr = this.summary()?.totalSales ?? 0;
    const prev = this.prevTotals().sales;
    return prev ? ((curr - prev) / prev * 100) : 0;
  });

  marginDelta = computed(() => {
    if (!this.hasSufficientData()) return 0;
    const currMargin = this.profitMargin();
    const prevRev = this.prevTotals().revenue;
    const prevProf = this.prevTotals().profit;
    const prevMargin = prevRev ? (prevProf / prevRev * 100) : 0;
    return +(currMargin - prevMargin).toFixed(1);
  });

  // Existing computed signals
  avgDailyRevenue = computed(() => {
    const m = this.dailyMetrics();
    return m.length ? m.reduce((s, d) => s + d.revenue, 0) / m.length : 0;
  });

  avgDailyCost = computed(() => {
    const m = this.dailyMetrics();
    return m.length ? m.reduce((s, d) => s + d.cost, 0) / m.length : 0;
  });

  avgDailyProfit = computed(() => {
    const m = this.dailyMetrics();
    return m.length ? m.reduce((s, d) => s + d.profit, 0) / m.length : 0;
  });

  bestDay = computed<DailyMetric | null>(() => {
    const m = this.dailyMetrics();
    return m.length ? m.reduce((best, d) => d.revenue > best.revenue ? d : best, m[0]) : null;
  });

  topCustomer = computed(() => {
    const cp = this.data()?.customerPerformance;
    if (!cp?.length) return '—';
    return cp.reduce((top, c) => c.revenue > top.revenue ? c : top, cp[0]).customerName;
  });
  inventoryWeightByPack = computed<PackWeightSummary[]>(() =>
    this.allInventoryItems()
      .map(i => ({
        packTypeId: i.packTypeId,
        packName: i.packName,
        weightKg: i.weightKg,
        qty: i.stockQty,
        totalWeight: +(i.weightKg * i.stockQty).toFixed(2),
      }))
      .sort((a, b) => a.weightKg - b.weightKg)
  );

  totalSoldWeight = computed(() =>
    +this.soldWeightByPack().reduce((s, p) => s + p.totalWeight, 0).toFixed(2)
  );

  totalInventoryWeight = computed(() =>
    +this.inventoryWeightByPack().reduce((s, p) => s + p.totalWeight, 0).toFixed(2)
  );
  // ── Sparkline Charts ───────────────────────────────────────────────────────
  sparkRevenue: any = {};
  sparkCost: any = {};
  sparkProfit: any = {};
  sparkSales: any = {};

  sparkOpts: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false, grid: { display: false }, ticks: { display: false } },
      y: { display: false, beginAtZero: false, grid: { display: false }, ticks: { display: false } },
    },
    elements: { point: { radius: 0 } },
    animation: false,
  };

  sparkBarOpts: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false, grid: { display: false }, ticks: { display: false } },
      y: { display: false, beginAtZero: true, grid: { display: false }, ticks: { display: false } },
    },
    elements: {
      bar: { borderRadius: 2, borderSkipped: false },
      point: { radius: 0 }
    },
    animation: false,
    categoryPercentage: 0.8,
    barPercentage: 0.9,
  };

  // ── Presets ────────────────────────────────────────────────────────────────
  readonly presets: { key: RangePreset; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: '7days', label: '7 Days' },
    { key: '30days', label: '30 Days' },
    { key: 'custom', label: 'Custom' },
  ];
  allInventoryItems = signal<InventoryItem[]>([]);
  soldWeightByPack = signal<PackWeightSummary[]>([]);
  weightLoading = signal(true);
  constructor(
    private dashboardService: DashboardService,
    private inventoryService: InventoryService,
    private notificationService: NotificationService,
    private saleService: SaleService,
  ) { }

  // ── LIFECYCLE ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.setDateFilter('all');  // ✅ DEFAULT TODAY
    this.loadInventory();
    this.notificationService.getUnreadCount().subscribe();
  }

  // ── DATE FILTER METHODS ────────────────────────────────────────────────────
  setDateFilter(type: RangePreset): void {
    this.activePreset.set(type);
    this.showCustom.set(false);
    this.showCustomRange.set(false);

    switch (type) {
      case 'today':
        this.singleDate = new Date();
        break;
      case 'yesterday':
        this.singleDate = this.daysAgo(1);
        break;
      case 'all':
      default:
        this.singleDate = null;
    }

    this.loadData(this.buildRange(type));
  }

  applySingleDate(): void {
    if (!this.singleDate) return;
    const d = this.fmt(this.singleDate);
    this.loadData({ dateFrom: d, dateTo: d });
    this.activePreset.set('custom');
  }

  applyCustomRange(): void {
    if (!this.isCustomRangeValid()) return;
    this.loadData({
      dateFrom: this.fmt(this.customFromDate()!),
      dateTo: this.fmt(this.customToDate()!)
    });
    this.showCustomRange.set(false);
    this.activePreset.set('custom');
  }

  toggleCustomRange(): void {
    this.showCustomRange.update(show => !show);
  }


  clearCustomRange(): void {
    this.customFromDate.set(null);
    this.customToDate.set(null);
    this.showCustomRange.set(false);
  }
  // ── EXISTING METHODS (Updated) ─────────────────────────────────────────────
  applyPreset(preset: RangePreset): void {
    this.setDateFilter(preset);  // ✅ Reuse new filter logic
  }

  // ✅ Use LOCAL date string, not UTC (fixes Sri Lanka UTC+5:30 offset)
  private fmt(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private buildRange(preset: RangePreset): DateRange {
    const today = new Date();
    switch (preset) {
      case 'all':
        return { dateFrom: null as any, dateTo: null as any };
      case 'today':
        return { dateFrom: this.fmt(today), dateTo: this.fmt(today) };
      case 'yesterday':
        return { dateFrom: this.fmt(this.daysAgo(1)), dateTo: this.fmt(this.daysAgo(1)) };
      case '7days':
        return { dateFrom: this.fmt(this.daysAgo(6)), dateTo: this.fmt(today) };
      case '30days':
        return { dateFrom: this.fmt(this.daysAgo(29)), dateTo: this.fmt(today) };
      default:
        return { dateFrom: null as any, dateTo: null as any };
    }
  }

  private daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }

  private loadData(range: DateRange): void {
    this.loading.set(true);
    this.error.set(null);


    const safeRange: DateRange = {
      dateFrom: range.dateFrom || null as any,
      dateTo: range.dateTo || null as any,
    };

    this.dashboardService.getData(safeRange).subscribe({
      next: (res) => {
        this.data.set(res.data);
        this.buildSparklines(res.data.dailyMetrics ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Dashboard error:', err);
        this.error.set('Failed to load dashboard data. Please try again.');
        this.loading.set(false);
      },
    });

    this.loadSoldWeights(safeRange);
  }

  private loadInventory(): void {
    this.inventoryService.getAll().subscribe({
      next: res => {
        this.allInventoryItems.set(res.data);
        this.lowStockItems.set(res.data.filter(i => i.isLowStock));
        this.inventoryLoading.set(false);
      },
      error: () => this.inventoryLoading.set(false),
    });
  }

  refresh(): void {
    if (this.activePreset() === 'custom' && this.customFromDate() && this.customToDate()) {
      this.applyCustomRange();
    } else {
      this.loadData(this.buildRange(this.activePreset()));
    }
    this.loadInventory();
  }
  private loadSoldWeights(range: DateRange): void {
    this.weightLoading.set(true);

    const filters: SaleFilters = { status: 'SAVED' };
    if (range.dateFrom) filters.dateFrom = range.dateFrom;
    if (range.dateTo) filters.dateTo = range.dateTo;

    this.saleService.getSales(filters, 0, 10000).subscribe({
      next: res => {
        const map = new Map<string, PackWeightSummary>();

        (res.data.content as any[]).forEach(sale => {
          (sale.items ?? []).forEach((item: any) => {
            const kg = item.weightKg ?? 0;
            if (!kg) return;

            const existing = map.get(item.packTypeId);
            if (existing) {
              existing.qty += item.qty;
              existing.totalWeight = +(existing.totalWeight + kg * item.qty).toFixed(2);
            } else {
              map.set(item.packTypeId, {
                packTypeId: item.packTypeId,
                packName: item.packName,
                weightKg: kg,
                qty: item.qty,
                totalWeight: +(kg * item.qty).toFixed(2),
              });
            }
          });
        });

        this.soldWeightByPack.set(
          Array.from(map.values()).sort((a, b) => a.weightKg - b.weightKg)
        );
        this.weightLoading.set(false);
      },
      error: () => this.weightLoading.set(false),
    });
  }
  // ── Sparkline builders ──────────────────────────────────────────────────────
  private buildSparklines(metrics: DailyMetric[]): void {
    const labels = metrics.map(m => m.date);

    this.sparkRevenue = this.buildSparkLine(labels, metrics.map(m => m.revenue), '#3b82f6', 'rgba(59,130,246,0.12)');
    this.sparkCost = this.buildSparkLine(labels, metrics.map(m => m.cost), '#f59e0b', 'rgba(245,158,11,0.12)');
    this.sparkProfit = this.buildSparkLine(labels, metrics.map(m => m.profit), '#10b981', 'rgba(16,185,129,0.12)');

    // Fixed sales data with fallback from summary
    const salesData = metrics.map(() => (this.summary()?.totalSales ?? 1) / Math.max(1, metrics.length));
    this.sparkSales = this.buildSparkBar(labels, salesData);
  }

  private buildSparkLine(labels: string[], data: number[], color: string, bg: string): any {
    return {
      labels,
      datasets: [{
        data,
        borderColor: color,
        backgroundColor: bg,
        borderWidth: 1.8,
        fill: true,
        tension: 0.4,
      }],
    };
  }

  private buildSparkBar(labels: string[], data: number[]): any {
    return {
      labels,
      datasets: [{
        data,
        backgroundColor: 'rgba(139,92,246,0.5)',
        borderRadius: 2,
        borderSkipped: false,
      }],
    };
  }
}
