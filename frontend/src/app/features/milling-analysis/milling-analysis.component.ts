// src/app/features/milling-analysis/milling-analysis.component.ts
import {
  Component, OnInit, signal, computed, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe, PercentPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ButtonModule }        from 'primeng/button';
import { CalendarModule }      from 'primeng/calendar';
import { ChartModule }         from 'primeng/chart';
import { InputNumberModule }   from 'primeng/inputnumber';
import { InputTextModule }     from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { SkeletonModule }      from 'primeng/skeleton';
import { TooltipModule }       from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { DropdownModule }      from 'primeng/dropdown';

import { environment } from '../../../environments/environment.prod';
import { LkrCurrencyPipe } from '../../shared/pipes/lkr-currency.pipe';

// ── Models ────────────────────────────────────────────────────────────────────

export interface StockEntry {
  _id: string;
  date: string;
  hasStockEntry: boolean;
  rawRiceReceived: number | null;
  input: number | null;
  output: number | null;
  rejection: number | null;
  rejectionDate: string | null;
  // Computed on frontend
  efficiency?: number;
  rejectionRate?: number;
  yieldRate?: number;
}

export interface MillingSummary {
  totalRawReceived:  number;
  totalInput:        number;
  totalOutput:       number;
  totalRejection:    number;
  avgEfficiency:     number;
  avgRejectionRate:  number;
  avgYieldRate:      number;
  entriesCount:      number;
  bestEfficiencyDate: string | null;
  worstEfficiencyDate: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-milling-analysis',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, CalendarModule, ChartModule,
    InputNumberModule, InputTextModule, InputTextareaModule,
    SkeletonModule, TooltipModule, ConfirmDialogModule, DropdownModule,
    DecimalPipe, DatePipe, PercentPipe,
  ],
  providers: [ConfirmationService],
  templateUrl: './milling-analysis.component.html',
  styleUrl:    './milling-analysis.component.css',
})
export class MillingAnalysisComponent implements OnInit {

  // ── State ──────────────────────────────────────────────────────────────────
  loading       = signal(false);
  error         = signal<string | null>(null);
  entries       = signal<StockEntry[]>([]);

  today         = new Date();
  dateFrom      = signal<Date | null>(null);
  dateTo        = signal<Date | null>(null);
  activePreset  = signal<string>('all');
  showCustomRange = signal(false);

  sortOptions = [
    { label: 'Date (Newest)',  value: 'date_desc'        },
    { label: 'Date (Oldest)',  value: 'date_asc'         },
    { label: 'Best Efficiency',value: 'eff_desc'         },
    { label: 'Most Output',    value: 'output_desc'      },
    { label: 'Most Rejection', value: 'rej_desc'         },
  ];
  selectedSort = signal('date_desc');

  constructor(private http: HttpClient) {}

  ngOnInit() { this.setPreset('all'); }

  // ── Data loading ────────────────────────────────────────────────────────────
  private fmtDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  load() {
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams().set('limit', '500');
    if (this.dateFrom()) params = params.set('from', this.fmtDate(this.dateFrom()!));
    if (this.dateTo())   params = params.set('to',   this.fmtDate(this.dateTo()!));

    this.http.get<{ success: boolean; logs: any[]; total: number }>(
      `${environment.apiUrl}/machine-logs`, { params }
    ).subscribe({
      next: (res) => {
        const raw = (res.logs ?? [])
          .filter((l: any) => l.hasStockEntry)
          .map((l: any) => this.enrichEntry(l));
        this.entries.set(raw);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Failed to load milling data');
        this.loading.set(false);
      },
    });
  }

  private enrichEntry(l: any): StockEntry {
    const input     = l.input     ?? 0;
    const output    = l.output    ?? 0;
    const rejection = l.rejection ?? 0;
    const received  = l.rawRiceReceived ?? 0;

    const efficiency    = input  > 0 ? (output / input)  * 100 : 0;
    const rejectionRate = input  > 0 ? (rejection / input) * 100 : 0;
    const yieldRate     = received > 0 ? (output / received) * 100 : 0;

    return {
      _id:             l._id,
      date:            l.date,
      hasStockEntry:   l.hasStockEntry,
      rawRiceReceived: received,
      input,
      output,
      rejection,
      rejectionDate:   l.rejectionDate ?? null,
      efficiency:      +efficiency.toFixed(2),
      rejectionRate:   +rejectionRate.toFixed(2),
      yieldRate:       +yieldRate.toFixed(2),
    };
  }

  // ── Sorted entries ──────────────────────────────────────────────────────────
  readonly sortedEntries = computed(() => {
    const list = [...this.entries()];
    switch (this.selectedSort()) {
      case 'date_asc':    return list.sort((a,b) => a.date.localeCompare(b.date));
      case 'eff_desc':    return list.sort((a,b) => (b.efficiency??0) - (a.efficiency??0));
      case 'output_desc': return list.sort((a,b) => (b.output??0) - (a.output??0));
      case 'rej_desc':    return list.sort((a,b) => (b.rejection??0) - (a.rejection??0));
      default:            return list.sort((a,b) => b.date.localeCompare(a.date));
    }
  });

  // ── Summary ─────────────────────────────────────────────────────────────────
  readonly summary = computed<MillingSummary>(() => {
    const e = this.entries();
    if (!e.length) return {
      totalRawReceived: 0, totalInput: 0, totalOutput: 0, totalRejection: 0,
      avgEfficiency: 0, avgRejectionRate: 0, avgYieldRate: 0,
      entriesCount: 0, bestEfficiencyDate: null, worstEfficiencyDate: null,
    };

    const totalRawReceived = e.reduce((s,x) => s + (x.rawRiceReceived ?? 0), 0);
    const totalInput       = e.reduce((s,x) => s + (x.input       ?? 0), 0);
    const totalOutput      = e.reduce((s,x) => s + (x.output      ?? 0), 0);
    const totalRejection   = e.reduce((s,x) => s + (x.rejection   ?? 0), 0);

    const avgEfficiency    = e.reduce((s,x) => s + (x.efficiency    ?? 0), 0) / e.length;
    const avgRejectionRate = e.reduce((s,x) => s + (x.rejectionRate ?? 0), 0) / e.length;
    const avgYieldRate     = e.reduce((s,x) => s + (x.yieldRate     ?? 0), 0) / e.length;

    const sorted = [...e].sort((a,b) => (b.efficiency??0) - (a.efficiency??0));
    const bestEff  = sorted[0]?.date ?? null;
    const worstEff = sorted[sorted.length - 1]?.date ?? null;

    return {
      totalRawReceived, totalInput, totalOutput, totalRejection,
      avgEfficiency:    +avgEfficiency.toFixed(2),
      avgRejectionRate: +avgRejectionRate.toFixed(2),
      avgYieldRate:     +avgYieldRate.toFixed(2),
      entriesCount:     e.length,
      bestEfficiencyDate:  bestEff,
      worstEfficiencyDate: worstEff,
    };
  });

  readonly totalLoss = computed(() =>
    (this.summary().totalInput ?? 0) - (this.summary().totalOutput ?? 0) - (this.summary().totalRejection ?? 0)
  );

  readonly overallEfficiency = computed(() => {
    const s = this.summary();
    return s.totalInput > 0 ? +((s.totalOutput / s.totalInput) * 100).toFixed(2) : 0;
  });

  readonly overallRejectionRate = computed(() => {
    const s = this.summary();
    return s.totalInput > 0 ? +((s.totalRejection / s.totalInput) * 100).toFixed(2) : 0;
  });

  readonly efficiencyStatus = computed(() => {
    const e = this.overallEfficiency();
    if (e >= 90) return 'excellent';
    if (e >= 80) return 'good';
    if (e >= 70) return 'fair';
    return 'poor';
  });

  // ── Chart: Efficiency over time ─────────────────────────────────────────────
  readonly efficiencyChartData = computed(() => {
    const pts = [...this.entries()].sort((a,b) => a.date.localeCompare(b.date));
    if (!pts.length) return null;
    return {
      labels: pts.map(p => new Date(p.date).toLocaleDateString('en-LK', { month:'short', day:'numeric' })),
      datasets: [
        {
          label:           'Efficiency %',
          data:            pts.map(p => p.efficiency),
          borderColor:     '#2563eb',
          backgroundColor: 'rgba(37,99,235,0.10)',
          fill:            true,
          tension:         0.4,
          pointRadius:     pts.length > 60 ? 0 : 4,
          pointHoverRadius:6,
          borderWidth:     2.5,
          yAxisID:         'y',
        },
        {
          label:           'Rejection %',
          data:            pts.map(p => p.rejectionRate),
          borderColor:     '#e11d48',
          backgroundColor: 'rgba(225,29,72,0.06)',
          fill:            true,
          tension:         0.4,
          pointRadius:     pts.length > 60 ? 0 : 4,
          pointHoverRadius:6,
          borderWidth:     2,
          yAxisID:         'y',
        },
      ],
    };
  });

  // ── Chart: Input / Output / Rejection bar ──────────────────────────────────
  readonly ioBarChartData = computed(() => {
    const pts = [...this.entries()].sort((a,b) => a.date.localeCompare(b.date));
    if (!pts.length) return null;
    return {
      labels: pts.map(p => new Date(p.date).toLocaleDateString('en-LK', { month:'short', day:'numeric' })),
      datasets: [
        {
          label:           'Input (kg)',
          data:            pts.map(p => p.input),
          backgroundColor: 'rgba(37,99,235,0.75)',
          borderRadius:    4,
          borderSkipped:   false,
          stack:           'a',
        },
        {
          label:           'Output (kg)',
          data:            pts.map(p => p.output),
          backgroundColor: 'rgba(5,150,105,0.75)',
          borderRadius:    4,
          borderSkipped:   false,
          stack:           'b',
        },
        {
          label:           'Rejection (kg)',
          data:            pts.map(p => p.rejection),
          backgroundColor: 'rgba(225,29,72,0.70)',
          borderRadius:    4,
          borderSkipped:   false,
          stack:           'b',
        },
      ],
    };
  });

  // ── Chart: Raw Rice Received trend ─────────────────────────────────────────
  readonly rawRiceChartData = computed(() => {
    const pts = [...this.entries()].sort((a,b) => a.date.localeCompare(b.date));
    if (!pts.length) return null;
    return {
      labels: pts.map(p => new Date(p.date).toLocaleDateString('en-LK', { month:'short', day:'numeric' })),
      datasets: [
        {
          label:           'Raw Rice Received (kg)',
          data:            pts.map(p => p.rawRiceReceived),
          borderColor:     '#d97706',
          backgroundColor: 'rgba(217,119,6,0.12)',
          fill:            true,
          tension:         0.35,
          pointRadius:     pts.length > 60 ? 0 : 4,
          pointHoverRadius:6,
          borderWidth:     2.5,
        },
      ],
    };
  });

  // ── Chart: Doughnut output composition ─────────────────────────────────────
  readonly compositionDoughnutData = computed(() => {
    const s = this.summary();
    if (!s.totalInput) return null;
    const loss = Math.max(0, this.totalLoss());
    return {
      labels: ['Output', 'Rejection', 'Processing Loss'],
      datasets: [{
        data:            [s.totalOutput, s.totalRejection, loss],
        backgroundColor: ['rgba(5,150,105,0.80)', 'rgba(225,29,72,0.80)', 'rgba(148,163,184,0.60)'],
        borderColor:     ['#059669', '#e11d48', '#94a3b8'],
        borderWidth:     2,
        hoverOffset:     10,
      }],
    };
  });

  // ── Chart: Yield rate scatter / line ───────────────────────────────────────
  readonly yieldTrendData = computed(() => {
    const pts = [...this.entries()].sort((a,b) => a.date.localeCompare(b.date));
    if (!pts.length) return null;
    return {
      labels: pts.map(p => new Date(p.date).toLocaleDateString('en-LK', { month:'short', day:'numeric' })),
      datasets: [
        {
          label:           'Yield Rate %',
          data:            pts.map(p => p.yieldRate),
          borderColor:     '#059669',
          backgroundColor: (ctx: any) => {
            const chart = ctx.chart;
            const { chartArea } = chart;
            if (!chartArea) return 'rgba(5,150,105,0.12)';
            const g = chart.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            g.addColorStop(0, 'rgba(5,150,105,0.25)');
            g.addColorStop(1, 'rgba(5,150,105,0.01)');
            return g;
          },
          fill:            true,
          tension:         0.4,
          pointRadius:     pts.length > 60 ? 0 : 4,
          pointHoverRadius:6,
          borderWidth:     2.5,
        },
      ],
    };
  });

  // ── Chart options ───────────────────────────────────────────────────────────
  readonly percentLineOptions = computed(() => ({
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { labels: { color: '#475569', font: { size: 12 }, boxWidth: 14 } },
      tooltip: {
        backgroundColor: '#1e293b', titleColor: '#f8fafc', bodyColor: '#cbd5e1',
        callbacks: {
          label: (ctx: any) => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1)}%`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#94a3b8', maxTicksLimit: 10, maxRotation: 0, font: { size: 11 } },
        grid:  { color: 'rgba(226,232,240,0.6)' },
      },
      y: {
        min: 0, max: 100,
        ticks: { color: '#94a3b8', font: { size: 11 }, callback: (v: number) => `${v}%` },
        grid:  { color: 'rgba(226,232,240,0.6)' },
      },
    },
  }));

  readonly kgBarOptions = computed(() => ({
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { labels: { color: '#475569', font: { size: 12 }, boxWidth: 14 } },
      tooltip: {
        backgroundColor: '#1e293b', titleColor: '#f8fafc', bodyColor: '#cbd5e1',
        callbacks: {
          label: (ctx: any) => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString()} kg`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#94a3b8', maxTicksLimit: 10, maxRotation: 0, font: { size: 11 } },
        grid:  { display: false },
      },
      y: {
        ticks: {
          color: '#94a3b8', font: { size: 11 },
          callback: (v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}t` : `${v}kg`,
        },
        grid: { color: 'rgba(226,232,240,0.6)' },
      },
    },
  }));

  readonly kgLineOptions = computed(() => ({
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { labels: { color: '#475569', font: { size: 12 }, boxWidth: 14 } },
      tooltip: {
        backgroundColor: '#1e293b', titleColor: '#f8fafc', bodyColor: '#cbd5e1',
        callbacks: {
          label: (ctx: any) => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString()} kg`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#94a3b8', maxTicksLimit: 10, maxRotation: 0, font: { size: 11 } },
        grid:  { color: 'rgba(226,232,240,0.6)' },
      },
      y: {
        ticks: {
          color: '#94a3b8', font: { size: 11 },
          callback: (v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}t` : `${v}kg`,
        },
        grid: { color: 'rgba(226,232,240,0.6)' },
      },
    },
  }));

  readonly doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: '#475569', padding: 14, boxWidth: 12, font: { size: 11 } },
      },
      tooltip: {
        backgroundColor: '#1e293b', titleColor: '#f8fafc', bodyColor: '#cbd5e1',
        callbacks: {
          label: (ctx: any) => {
            const v: number = ctx.parsed;
            return ` ${ctx.label}: ${v.toLocaleString()} kg`;
          },
        },
      },
    },
    cutout: '64%',
  };

  // ── Date presets ─────────────────────────────────────────────────────────────
  setPreset(preset: string) {
    this.activePreset.set(preset);
    this.showCustomRange.set(false);
    const now = new Date();
    switch (preset) {
      case 'all':
        this.dateFrom.set(null); this.dateTo.set(null); break;
      case 'today':
        this.dateFrom.set(new Date(now)); this.dateTo.set(new Date(now)); break;
      case '7d': {
        const f = new Date(now); f.setDate(f.getDate() - 6);
        this.dateFrom.set(f); this.dateTo.set(now); break;
      }
      case '30d': {
        const f = new Date(now); f.setDate(f.getDate() - 29);
        this.dateFrom.set(f); this.dateTo.set(now); break;
      }
      case 'month':
        this.dateFrom.set(new Date(now.getFullYear(), now.getMonth(), 1));
        this.dateTo.set(now); break;
    }
    this.load();
  }

  toggleCustomRange() { this.showCustomRange.update(v => !v); }

  applyCustomRange() {
    this.activePreset.set('custom');
    this.showCustomRange.set(false);
    this.load();
  }

  get isCustomRangeValid() { return !!(this.dateFrom() && this.dateTo()); }

  fmtKg(v: number) {
    if (v >= 1000) return `${(v/1000).toFixed(2)} t`;
    return `${v.toLocaleString()} kg`;
  }
}