// customer-performance-chart.component.ts
import {
  Component, Input, OnChanges, SimpleChanges,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule }    from '@angular/common';
import { ChartModule }     from 'primeng/chart';
import { TableModule }     from 'primeng/table';
import { CustomerPerformance } from '../../../../core/models/dashboard';

// Accent palette cycling for bars
const COLORS = [
  'rgba(59,130,246,0.8)',
  'rgba(16,185,129,0.8)',
  'rgba(245,158,11,0.8)',
  'rgba(139,92,246,0.8)',
  'rgba(244,63,94,0.8)',
  'rgba(14,165,233,0.8)',
  'rgba(234,179,8,0.8)',
];

@Component({
  selector: 'app-customer-performance-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ChartModule, TableModule],
  templateUrl: './customer-performance-chart.component.html',
  styleUrls:   ['./customer-performance-chart.component.css'],
})
export class CustomerPerformanceChartComponent implements OnChanges {
  @Input() data: CustomerPerformance[] = [];

  // ── Derived state ──────────────────────────────────────────────────────────
  sorted:       CustomerPerformance[] = [];
  top3:         CustomerPerformance[] = [];
  totalRevenue  = 1;
  chartData:    any = {};
  chartOptions: any = {};

  ngOnChanges(c: SimpleChanges): void {
    if (c['data']) this.build();
  }

  // ── Builder ────────────────────────────────────────────────────────────────
  private build(): void {
    this.sorted       = [...this.data].sort((a, b) => b.revenue - a.revenue);
    this.top3         = this.sorted.slice(0, 3);
    this.totalRevenue = this.sorted.reduce((s, c) => s + c.revenue, 0) || 1;

    this.buildChart();
  }

  private buildChart(): void {
    const top = this.sorted.slice(0, 10); // max 10 in chart for readability

    this.chartData = {
      labels: top.map(c => this.truncate(c.customerName, 12)),
      datasets: [
        {
          label: 'Revenue',
          data: top.map(c => c.revenue),
          backgroundColor: top.map((_, i) => COLORS[i % COLORS.length]),
          borderRadius: 6,
          borderSkipped: false,
          borderWidth: 0,
        },
      ],
    };

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',      // horizontal bars for readability
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0b0b13',
          titleColor:  '#94a3b8',
          bodyColor:   '#f1f5f9',
          borderColor: 'rgba(255,255,255,.1)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (ctx: any) => ` Revenue: ${this.formatCurrency(ctx.parsed.x)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,.05)', drawBorder: false },
          ticks: {
            color: '#475569',
            font: { size: 11, family: 'Geist Mono, monospace' },
            callback: (v: number) => this.shortFmt(v),
          },
          beginAtZero: true,
        },
        y: {
          grid:  { display: false },
          ticks: { color: '#94a3b8', font: { size: 12, family: 'Syne, sans-serif', weight: '600' } },
        },
      },
    };
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

  private truncate(s: string, max: number): string {
    return s.length > max ? s.slice(0, max) + '…' : s;
  }
}