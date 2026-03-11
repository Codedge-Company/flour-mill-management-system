// src/app/features/flow-money/flow-money.component.ts
import {
  Component, OnInit, signal, computed, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe, PercentPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

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

import { FlowMoneyService }    from '../../../core/services/flow-money.service';
import {
  FlowMoneyData, TimelinePoint, CapitalEntry, AddCapitalRequest
} from '../../../core/models/flow-money';
import { LkrCurrencyPipe }     from '../../../shared/pipes/lkr-currency.pipe';

@Component({
  selector: 'app-flow-money',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, CalendarModule, ChartModule,
    InputNumberModule, InputTextModule, InputTextareaModule,
    SkeletonModule, TooltipModule, ConfirmDialogModule,
    LkrCurrencyPipe, DecimalPipe, DatePipe, PercentPipe,
  ],
  providers: [ConfirmationService],
  templateUrl: './flow-money.component.html',
  styleUrl:    './flow-money.component.css',
})
export class FlowMoneyComponent implements OnInit {

  readonly Math = Math;

  // ── State ────────────────────────────────────────────────────────────────
  loading  = signal(false);
  error    = signal<string | null>(null);
  data     = signal<FlowMoneyData | null>(null);

  today        = new Date();
  dateFrom     = signal<Date | null>(null);
  dateTo       = signal<Date | null>(null);
  activePreset = signal<string>('all');
  showCustomRange = signal(false);

  // Capital dialog
  showAddCapital = signal(false);
  savingCapital  = signal(false);
  capitalAmount  = signal<number | null>(null);
  capitalLabel   = signal('');
  capitalDate    = signal<Date>(new Date());
  capitalNote    = signal('');

  constructor(
    private flowSvc: FlowMoneyService,
    private confirmSvc: ConfirmationService,
  ) {}

  ngOnInit() { this.load(); }

  // ── Derived summary ──────────────────────────────────────────────────────
  readonly summary  = computed(() => this.data()?.summary ?? null);
  readonly timeline = computed(() => this.data()?.timeline ?? []);
  readonly capitals = computed(() => this.data()?.allCapitals ?? []);

  /** Profit = Income - Expenses (= totalProfit from backend) */
  readonly totalProfit = computed(() => this.summary()?.totalProfit ?? 0);

  /** Business Value = Capital + Profit */
  readonly businessValue = computed(() =>
    (this.summary()?.totalCapital ?? 0) + this.totalProfit()
  );

  /** Total Investment = Capital + Expenses */
  readonly totalInvestment = computed(() =>
    (this.summary()?.totalCapital ?? 0) + (this.summary()?.totalCost ?? 0)
  );

  readonly profitMargin = computed(() => {
    const rev = this.summary()?.totalRevenue ?? 0;
    return rev > 0 ? (this.totalProfit() / rev) * 100 : 0;
  });

  readonly businessValuePositive = computed(() => this.businessValue() >= 0);

  // ── Chart 1: Business Growth Timeline (Line) ─────────────────────────────
  readonly growthChartData = computed(() => {
    const pts = this.timeline();
    if (!pts.length) return null;
    return {
      labels: pts.map(p => p.date),
      datasets: [
        {
          label:           'Business Value',
          data:            pts.map(p => p.netWorth),
          borderColor:     '#2563eb',
          backgroundColor: 'rgba(37,99,235,0.08)',
          fill:            true,
          tension:         0.4,
          pointRadius:     pts.length > 60 ? 0 : 3,
          pointHoverRadius:5,
          borderWidth:     2.5,
        },
        {
          label:           'Capital Baseline',
          data:            pts.map(p => p.cumulativeCapital),
          borderColor:     '#7c3aed',
          backgroundColor: 'transparent',
          fill:            false,
          tension:         0.2,
          borderDash:      [6, 4],
          pointRadius:     0,
          borderWidth:     1.5,
        },
      ],
    };
  });

  // ── Chart 2: Income vs Expenses (Bar) ────────────────────────────────────
  readonly incomeExpenseChartData = computed(() => {
    const pts = this.timeline();
    if (!pts.length) return null;
    return {
      labels: pts.map(p => p.date),
      datasets: [
        {
          label:           'Income',
          data:            pts.map(p => p.dailyRevenue),
          backgroundColor: 'rgba(37,99,235,0.75)',
          borderRadius:    4,
          borderSkipped:   false,
        },
        {
          label:           'Expenses',
          data:            pts.map(p => p.dailyCost),
          backgroundColor: 'rgba(225,29,72,0.65)',
          borderRadius:    4,
          borderSkipped:   false,
        },
      ],
    };
  });

  // ── Chart 3: Profit Trend (Area) ─────────────────────────────────────────
  readonly profitTrendData = computed(() => {
    const pts = this.timeline();
    if (!pts.length) return null;
    return {
      labels: pts.map(p => p.date),
      datasets: [
        {
          label:           'Daily Profit',
          data:            pts.map(p => p.dailyProfit),
          borderColor:     '#059669',
          backgroundColor: (context: any) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return 'rgba(5,150,105,0.12)';
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(5,150,105,0.25)');
            gradient.addColorStop(1, 'rgba(5,150,105,0.01)');
            return gradient;
          },
          fill:            true,
          tension:         0.4,
          pointRadius:     pts.length > 60 ? 0 : 3,
          pointHoverRadius:5,
          borderWidth:     2,
        },
      ],
    };
  });

  // ── Chart 4: Expense Breakdown (Doughnut) ────────────────────────────────
  readonly expenseBreakdownData = computed(() => {
    const s = this.summary();
    if (!s || s.totalCost <= 0) return null;
    const profit = Math.max(0, s.totalProfit);
    const cost   = s.totalCost;
    const cap    = s.totalCapital;
    return {
      labels: ['Cost of Sales', 'Profit', 'Capital Invested'],
      datasets: [{
        data:            [cost, profit, cap],
        backgroundColor: ['rgba(225,29,72,0.80)', 'rgba(5,150,105,0.80)', 'rgba(37,99,235,0.80)'],
        borderColor:     ['#e11d48', '#059669', '#2563eb'],
        borderWidth:     2,
        hoverOffset:     10,
      }],
    };
  });

  // ── Shared chart options ──────────────────────────────────────────────────
  readonly lineChartOptions = computed(() => this.buildLineOpts());
  readonly barChartOptions  = computed(() => this.buildBarOpts());

  readonly doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels:   { color: '#475569', padding: 14, boxWidth: 12, font: { size: 11 } },
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor:      '#f8fafc',
        bodyColor:       '#cbd5e1',
        callbacks: {
          label: (ctx: any) => {
            const v: number = ctx.parsed;
            return ` ${ctx.label}: LKR ${v.toLocaleString('en-LK', { minimumFractionDigits: 0 })}`;
          },
        },
      },
    },
    cutout: '64%',
  };

  private buildLineOpts() {
    return {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        legend: { labels: { color: '#475569', font: { size: 12 }, boxWidth: 14 } },
        tooltip: {
          backgroundColor: '#1e293b', titleColor: '#f8fafc', bodyColor: '#cbd5e1',
          callbacks: {
            label: (ctx: any) => {
              const v: number = ctx.parsed.y ?? 0;
              return ` ${ctx.dataset.label}: LKR ${v.toLocaleString('en-LK', { minimumFractionDigits: 0 })}`;
            },
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
            callback: (v: number) => {
              if (v >= 1_000_000) return `${(v/1_000_000).toFixed(1)}M`;
              if (v >= 1_000)     return `${(v/1_000).toFixed(0)}k`;
              return v;
            },
          },
          grid: { color: 'rgba(226,232,240,0.6)' },
        },
      },
    };
  }

  private buildBarOpts() {
    return {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        legend: { labels: { color: '#475569', font: { size: 12 }, boxWidth: 14 } },
        tooltip: {
          backgroundColor: '#1e293b', titleColor: '#f8fafc', bodyColor: '#cbd5e1',
          callbacks: {
            label: (ctx: any) => {
              const v: number = ctx.parsed.y ?? 0;
              return ` ${ctx.dataset.label}: LKR ${v.toLocaleString('en-LK', { minimumFractionDigits: 0 })}`;
            },
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
            callback: (v: number) => {
              if (v >= 1_000_000) return `${(v/1_000_000).toFixed(1)}M`;
              if (v >= 1_000)     return `${(v/1_000).toFixed(0)}k`;
              return v;
            },
          },
          grid: { color: 'rgba(226,232,240,0.6)' },
        },
      },
    };
  }

  // ── Daily summary table (last 30 rows, newest first) ─────────────────────
  readonly tableRows = computed(() => {
    const pts = [...this.timeline()].reverse().slice(0, 100);
    let runningNetWorth = this.timeline()[this.timeline().length - 1]?.netWorth ?? 0;
    return pts.map((p, i) => {
      const bv = i === 0
        ? runningNetWorth
        : pts[i - 1] ? (this.timeline().find(t => t.date === pts[i-1].date)?.netWorth ?? 0) : 0;
      return { ...p, businessValue: this.timeline().find(t => t.date === p.date)?.netWorth ?? 0 };
    });
  });

  // ── Date presets ──────────────────────────────────────────────────────────
  setPreset(preset: string) {
    this.activePreset.set(preset);
    this.showCustomRange.set(false);
    const now = new Date();
    switch (preset) {
      case 'all':
        this.dateFrom.set(null); this.dateTo.set(null); break;
      case 'today':
        this.dateFrom.set(new Date(now)); this.dateTo.set(new Date(now)); break;
      case '7d':
        { const f = new Date(now); f.setDate(f.getDate() - 6);
          this.dateFrom.set(f); this.dateTo.set(now); } break;
      case '30d':
        { const f = new Date(now); f.setDate(f.getDate() - 29);
          this.dateFrom.set(f); this.dateTo.set(now); } break;
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

  // ── Load ──────────────────────────────────────────────────────────────────
  load() {
    this.loading.set(true);
    this.error.set(null);
    const fmt  = FlowMoneyService.fmtLocal;
    const from = this.dateFrom() ? fmt(this.dateFrom()!) : undefined;
    const to   = this.dateTo()   ? fmt(this.dateTo()!)   : undefined;

    this.flowSvc.getFlow(from, to).subscribe({
      next:  (res) => { this.data.set(res.data);  this.loading.set(false); },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Failed to load data');
        this.loading.set(false);
      },
    });
  }

  // ── Capital CRUD ──────────────────────────────────────────────────────────
  openAddCapital() {
    this.capitalAmount.set(null); this.capitalLabel.set('');
    this.capitalDate.set(new Date()); this.capitalNote.set('');
    this.showAddCapital.set(true);
  }

  saveCapital() {
    const amt = this.capitalAmount();
    if (!amt || amt <= 0) return;
    this.savingCapital.set(true);
    const req: AddCapitalRequest = {
      amount:       amt,
      label:        this.capitalLabel(),
      capital_date: FlowMoneyService.fmtLocal(this.capitalDate()),
      note:         this.capitalNote(),
    };
    this.flowSvc.addCapital(req).subscribe({
      next: () => { this.savingCapital.set(false); this.showAddCapital.set(false); this.load(); },
      error: (err) => {
        this.savingCapital.set(false);
        this.error.set(err?.error?.message ?? 'Failed to save capital');
      },
    });
  }

  confirmDelete(entry: CapitalEntry) {
    this.confirmSvc.confirm({
      message: `Delete capital entry of LKR ${entry.amount.toLocaleString()}?`,
      header:  'Confirm Delete',
      icon:    'pi pi-trash',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.flowSvc.deleteCapital(entry._id).subscribe({
          next:  () => this.load(),
          error: (err) => this.error.set(err?.error?.message ?? 'Delete failed'),
        });
      },
    });
  }

  get canSaveCapital() { return (this.capitalAmount() ?? 0) > 0; }

  trackByDate = (_: number, p: TimelinePoint) => p.date;
  trackById   = (_: number, e: CapitalEntry)  => e._id;
}