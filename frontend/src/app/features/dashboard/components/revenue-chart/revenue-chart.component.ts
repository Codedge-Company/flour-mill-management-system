// revenue-chart.component.ts
import {
  Component, Input, OnChanges, SimpleChanges,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ChartModule }  from 'primeng/chart';
import { TableModule }  from 'primeng/table';
import { DailyMetric }  from '../../../../core/models/dashboard';
import { LkrCurrencyPipe } from '../../../../shared/pipes/lkr-currency.pipe'; // adjust path if needed

interface MonthRow {
  month:     string;
  revenue:   number;
  cost:      number;
  profit:    number;
  margin:    number;
  isBest:    boolean;
  revPct:    number;
  costPct:   number;
  profitPct: number;
}

const MONTHS = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec'
];

@Component({
  selector: 'app-revenue-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ChartModule, TableModule, LkrCurrencyPipe, DecimalPipe],
  templateUrl: './revenue-chart.component.html',
  styleUrls:   ['./revenue-chart.component.css'],
})
export class RevenueChartComponent implements OnChanges {
  @Input() metrics: DailyMetric[] = [];
  /** 'both' | 'bars' | 'trend' — passed from parent SelectButton */
  @Input() view: string = 'both';

  // ── Month tab state ────────────────────────────────────────────────────────
  /** -1 = "All months", 0-11 = specific month index */
  selectedMonth = -1;

  /** Months that actually have data — used to render tabs */
  get availableMonths(): { key: number; label: string }[] {
    return this.monthlyData
      .map((m, i) => ({ key: i, label: MONTHS[i], hasData: m.revenue > 0 || m.cost > 0 }))
      .filter(m => m.hasData);
  }

  // ── Spotlight getters (react to selectedMonth) ─────────────────────────────
  get spotRevenue(): number {
    return this.selectedMonth === -1
      ? this._totRevenue
      : (this.monthlyData[this.selectedMonth]?.revenue ?? 0);
  }

  get spotCost(): number {
    return this.selectedMonth === -1
      ? this._totCost
      : (this.monthlyData[this.selectedMonth]?.cost ?? 0);
  }

  get spotProfit(): number {
    return this.selectedMonth === -1
      ? this._totProfit
      : (this.monthlyData[this.selectedMonth]?.profit ?? 0);
  }

  get spotMargin(): number {
    return this.spotRevenue > 0
      ? +((this.spotProfit / this.spotRevenue) * 100).toFixed(1)
      : 0;
  }

  // ── Pie legend percentage getters ──────────────────────────────────────────
  private get _pieTotal(): number {
    return (this.spotRevenue + this.spotCost + this.spotProfit) || 1;
  }

  get revPct(): string {
    return ((this.spotRevenue / this._pieTotal) * 100).toFixed(1);
  }

  get costPct(): string {
    return ((this.spotCost / this._pieTotal) * 100).toFixed(1);
  }

  get profitPct(): string {
    return ((this.spotProfit / this._pieTotal) * 100).toFixed(1);
  }

  // ── Chart data ─────────────────────────────────────────────────────────────
  barLineData:    any = {};
  barLineOptions: any = {};
  pieData:        any = {};
  pieOptions:     any = {};

  // ── Table data ─────────────────────────────────────────────────────────────
  tableRows: MonthRow[] = [];

  // ── Cached totals ──────────────────────────────────────────────────────────
  private _totRevenue = 0;
  private _totCost    = 0;
  private _totProfit  = 0;

  // ── Monthly buckets (always 12) ────────────────────────────────────────────
  private monthlyData: { revenue: number; cost: number; profit: number }[] =
    Array.from({ length: 12 }, () => ({ revenue: 0, cost: 0, profit: 0 }));

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['metrics'] || changes['view']) {
      this.buildAll();
    }
  }

  // ── Month tab click ────────────────────────────────────────────────────────
  selectMonth(key: number): void {
    this.selectedMonth = key;
    this.buildBarLine();
    this.buildPieFor(this.spotRevenue, this.spotCost, this.spotProfit);
    this.cdr.markForCheck();
  }

  // ── Build everything on data/view change ──────────────────────────────────
  private buildAll(): void {
    this.monthlyData  = this.aggregateByMonth(this.metrics);
    this._totRevenue  = this.monthlyData.reduce((s, m) => s + m.revenue, 0);
    this._totCost     = this.monthlyData.reduce((s, m) => s + m.cost,    0);
    this._totProfit   = this.monthlyData.reduce((s, m) => s + m.profit,  0);

    this.buildBarLine();
    this.buildPieFor(this._totRevenue, this._totCost, this._totProfit);
    this.buildTable();
  }

  // ── Aggregate daily → monthly ──────────────────────────────────────────────
  private aggregateByMonth(
    metrics: DailyMetric[]
  ): { revenue: number; cost: number; profit: number }[] {
    const buckets: { revenue: number; cost: number; profit: number }[] =
      Array.from({ length: 12 }, () => ({ revenue: 0, cost: 0, profit: 0 }));

    metrics.forEach(m => {
      const idx = new Date(m.date).getMonth();
      if (idx >= 0 && idx < 12) {
        buckets[idx].revenue += m.revenue;
        buckets[idx].cost    += m.cost;
        buckets[idx].profit  += m.profit ?? (m.revenue - m.cost);
      }
    });

    return buckets;
  }

  // ── Bar + Line chart ───────────────────────────────────────────────────────
  private buildBarLine(): void {
    const isFiltered = this.selectedMonth !== -1;
    const src    = isFiltered ? [this.monthlyData[this.selectedMonth]] : this.monthlyData;
    const labels = isFiltered ? [MONTHS[this.selectedMonth]] : [...MONTHS];

    const revenues = src.map(m => m.revenue);
    const costs    = src.map(m => m.cost);
    const profits  = src.map(m => m.profit);

    const showBars = this.view !== 'trend';
    const showLine = this.view !== 'bars';
    const datasets: any[] = [];

    if (showBars) {
      datasets.push(
        {
          type: 'bar', label: 'Revenue', data: revenues,
          backgroundColor: 'rgba(59,130,246,0.7)', borderColor: '#3b82f6',
          borderWidth: 1.5, borderRadius: 6, borderSkipped: false, order: 2,
        },
        {
          type: 'bar', label: 'Cost', data: costs,
          backgroundColor: 'rgba(245,158,11,0.7)', borderColor: '#f59e0b',
          borderWidth: 1.5, borderRadius: 6, borderSkipped: false, order: 2,
        }
      );
    }

    if (showLine) {
      datasets.push({
        type: 'line', label: 'Profit', data: profits,
        borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)',
        borderWidth: 2.5, pointRadius: 5, pointBackgroundColor: '#10b981',
        pointBorderColor: '#fff', pointBorderWidth: 2,
        tension: 0.35, fill: true, order: 1,
      });
    }

    this.barLineData    = { labels, datasets };
    this.barLineOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a', titleColor: '#94a3b8',
          bodyColor: '#f1f5f9', borderColor: 'rgba(0,0,0,.1)',
          borderWidth: 1, padding: 14,
          callbacks: {
            label: (ctx: any) => ` ${ctx.dataset.label}: ${this.shortFmt(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#475569', font: { size: 11, weight: '600' } },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(226,232,240,.6)' },
          ticks: {
            color: '#475569',
            font: { size: 11 },
            callback: (v: number) => this.shortFmt(v),
          },
        },
      },
    };
  }

  // ── Donut / Pie ────────────────────────────────────────────────────────────
  private buildPieFor(rev: number, cost: number, profit: number): void {
    this.pieData = {
      labels: ['Revenue', 'Cost', 'Profit'],
      datasets: [{
        data: [rev, cost, profit],
        backgroundColor: [
          'rgba(59,130,246,0.85)',
          'rgba(245,158,11,0.85)',
          'rgba(16,185,129,0.85)',
        ],
        hoverBackgroundColor: ['#3b82f6', '#f59e0b', '#10b981'],
        borderColor: '#f8fafc',
        borderWidth: 3,
        hoverOffset: 8,
      }],
    };

    this.pieOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a', titleColor: '#94a3b8',
          bodyColor: '#f1f5f9', borderColor: 'rgba(0,0,0,.1)',
          borderWidth: 1, padding: 12,
          callbacks: {
            label: (ctx: any) => ` ${ctx.label}: ${this.shortFmt(ctx.parsed)}`,
          },
        },
      },
    };
  }

  // ── Table ──────────────────────────────────────────────────────────────────
  private buildTable(): void {
    const maxRev    = Math.max(...this.monthlyData.map(m => m.revenue), 1);
    const maxCost   = Math.max(...this.monthlyData.map(m => m.cost),    1);
    const maxProfit = Math.max(...this.monthlyData.map(m => m.profit),  1);

    this.tableRows = this.monthlyData.map((m, i) => ({
      month:     MONTHS[i],
      revenue:   m.revenue,
      cost:      m.cost,
      profit:    m.profit,
      margin:    m.revenue ? (m.profit / m.revenue) * 100 : 0,
      isBest:    m.profit === maxProfit && maxProfit > 0,
      revPct:    (m.revenue / maxRev)    * 100,
      costPct:   (m.cost    / maxCost)   * 100,
      profitPct: (m.profit  / maxProfit) * 100,
    }));
  }

  // ── Format helpers ─────────────────────────────────────────────────────────
  shortFmt(v: number): string {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
    return String(Math.round(v));
  }
}