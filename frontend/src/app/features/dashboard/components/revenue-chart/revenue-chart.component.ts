// revenue-chart.component.ts
import {
  Component, Input, OnChanges, SimpleChanges,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule }  from 'primeng/chart';
import { TableModule }  from 'primeng/table';
import { DailyMetric }  from '../../../../core/models/dashboard';

interface MonthRow {
  month:   string;
  revenue: number;
  cost:    number;
  profit:  number;
  margin:  number;
  isBest:  boolean;
}

interface PieLeg {
  label: string;
  color: string;
  value: number;
  pct:   string;
}

interface SpotlightData {
  revenue: number;
  cost:    number;
  profit:  number;
}

const MONTHS = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec'
];

@Component({
  selector: 'app-revenue-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ChartModule, TableModule],
  templateUrl: './revenue-chart.component.html',
  styleUrls:   ['./revenue-chart.component.css'],
})
export class RevenueChartComponent implements OnChanges {
  @Input() metrics: DailyMetric[] = [];
  /** 'both' | 'bars' | 'trend' — passed from parent SelectButton */
  @Input() view: string = 'both';

  // ── State ──────────────────────────────────────────────────────────────────
  selectedMonth = -1;     // -1 = "All"
  spotlightData: SpotlightData | null = null;
  spotlightMargin = 0;

  readonly monthLabels = MONTHS;

  // ── Chart data ─────────────────────────────────────────────────────────────
  barLineData:    any = {};
  barLineOptions: any = {};
  pieData:        any = {};
  pieOptions:     any = {};

  // ── Table data ─────────────────────────────────────────────────────────────
  tableRows:   MonthRow[] = [];
  pieLegend:   PieLeg[]   = [];
  peakRevenue  = 1;
  totalMargin  = 0;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['metrics'] || changes['view']) {
      this.buildAll();
    }
  }

  // ── Month tab interaction ──────────────────────────────────────────────────
  selectMonth(idx: number): void {
    this.selectedMonth = idx;
    if (idx === -1) {
      this.spotlightData = null;
    } else {
      const d = this.monthlyData[idx];
      this.spotlightData = { revenue: d.revenue, cost: d.cost, profit: d.profit };
      this.spotlightMargin = d.revenue
        ? +((d.profit / d.revenue) * 100).toFixed(1) : 0;
    }
    this.buildBarLine();
    this.cdr.markForCheck();
  }

  // ── Aggregated monthly data (always 12 buckets) ────────────────────────────
  private monthlyData: { revenue: number; cost: number; profit: number }[] = [];

  private buildAll(): void {
    this.monthlyData = this.aggregateByMonth(this.metrics);
    this.peakRevenue = Math.max(...this.monthlyData.map(m => m.revenue), 1);

    const totRev    = this.monthlyData.reduce((s, m) => s + m.revenue, 0);
    const totCost   = this.monthlyData.reduce((s, m) => s + m.cost,    0);
    const totProfit = this.monthlyData.reduce((s, m) => s + m.profit,  0);
    this.totalMargin = totRev ? +((totProfit / totRev) * 100).toFixed(1) : 0;

    this.buildBarLine();
    this.buildPie(totRev, totCost, totProfit);
    this.buildTable();
  }

  // ── Monthly aggregation from daily metrics ─────────────────────────────────
  private aggregateByMonth(
    metrics: DailyMetric[]
  ): { revenue: number; cost: number; profit: number }[] {
    const buckets: { revenue: number; cost: number; profit: number }[] =
      Array.from({ length: 12 }, () => ({ revenue: 0, cost: 0, profit: 0 }));

    metrics.forEach(m => {
      const d = new Date(m.date);
      const idx = d.getMonth(); // 0-11
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
    const src = this.selectedMonth === -1
      ? this.monthlyData
      : [this.monthlyData[this.selectedMonth]];

    const labels   = this.selectedMonth === -1 ? MONTHS : [MONTHS[this.selectedMonth]];
    const revenues = src.map(m => m.revenue);
    const costs    = src.map(m => m.cost);
    const profits  = src.map(m => m.profit);

    const showBars  = this.view !== 'trend';
    const showLine  = this.view !== 'bars';

    const datasets: any[] = [];

    if (showBars) {
      datasets.push(
        {
          type: 'bar',
          label: 'Revenue',
          data: revenues,
          backgroundColor: 'rgba(59,130,246,0.7)',
          borderColor:     '#3b82f6',
          borderWidth: 1.5,
          borderRadius: 6,
          borderSkipped: false,
          order: 2,
        },
        {
          type: 'bar',
          label: 'Cost',
          data: costs,
          backgroundColor: 'rgba(245,158,11,0.7)',
          borderColor:     '#f59e0b',
          borderWidth: 1.5,
          borderRadius: 6,
          borderSkipped: false,
          order: 2,
        }
      );
    }

    if (showLine) {
      datasets.push({
        type: 'line',
        label: 'Profit',
        data: profits,
        borderColor:     '#10b981',
        backgroundColor: 'rgba(16,185,129,0.08)',
        borderWidth: 2.5,
        pointRadius: 5,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#111120',
        pointBorderWidth: 2,
        tension: 0.35,
        fill: true,
        order: 1,
      });
    }

    this.barLineData = { labels, datasets };

    this.barLineOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0b0b13',
          titleColor: '#94a3b8',
          bodyColor:  '#f1f5f9',
          borderColor: 'rgba(255,255,255,.1)',
          borderWidth: 1,
          padding: 14,
          callbacks: {
            label: (ctx: any) => ` ${ctx.dataset.label}: ${this.formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false, drawBorder: false },
          ticks: { color: '#475569', font: { size: 11, family: 'Syne, sans-serif', weight: '600' } },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,.05)', drawBorder: false },
          ticks: {
            color: '#475569',
            font:  { size: 11, family: 'Geist Mono, monospace' },
            callback: (v: number) => this.shortFmt(v),
          },
        },
      },
    };
  }

  // ── Doughnut / Pie chart ───────────────────────────────────────────────────
  private buildPie(totRev: number, totCost: number, totProfit: number): void {
    const total = totRev + totCost + totProfit || 1;
    const pct   = (v: number) => ((v / total) * 100).toFixed(1);

    this.pieLegend = [
      { label: 'Revenue', color: '#3b82f6', value: totRev,    pct: pct(totRev)    },
      { label: 'Cost',    color: '#f59e0b', value: totCost,   pct: pct(totCost)   },
      { label: 'Profit',  color: '#10b981', value: totProfit, pct: pct(totProfit) },
    ];

    this.pieData = {
      labels: ['Revenue', 'Cost', 'Profit'],
      datasets: [{
        data: [totRev, totCost, totProfit],
        backgroundColor: [
          'rgba(59,130,246,0.85)',
          'rgba(245,158,11,0.85)',
          'rgba(16,185,129,0.85)',
        ],
        hoverBackgroundColor: ['#3b82f6', '#f59e0b', '#10b981'],
        borderColor: '#111120',
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
          backgroundColor: '#0b0b13',
          titleColor: '#94a3b8',
          bodyColor:  '#f1f5f9',
          borderColor: 'rgba(255,255,255,.1)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (ctx: any) => ` ${ctx.label}: ${this.formatCurrency(ctx.parsed)}`,
          },
        },
      },
    };
  }

  // ── Table rows ─────────────────────────────────────────────────────────────
  private buildTable(): void {
    const maxProfit = Math.max(...this.monthlyData.map(m => m.profit));
    this.tableRows = this.monthlyData.map((m, i) => ({
      month:   MONTHS[i],
      revenue: m.revenue,
      cost:    m.cost,
      profit:  m.profit,
      margin:  m.revenue ? (m.profit / m.revenue) * 100 : 0,
      isBest:  m.profit === maxProfit && maxProfit > 0,
    }));
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  formatCurrency(v: number): string {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
    if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
    return v.toFixed(0);
  }

  private shortFmt(v: number): string {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
    return String(v);
  }
}