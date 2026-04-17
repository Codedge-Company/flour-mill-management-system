import { Component, OnInit, signal, computed, effect, Inject } from '@angular/core';
import { CommonModule, DecimalPipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalendarModule } from 'primeng/calendar';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { MachineLogService, MachineLog, MachineSession } from '../../core/services/machine-log.service';

// ─── Extended entry with all computed fields ─────────────────────────────────
export interface OperatorEntry {
  _id: string;
  date: string;
  batchNo: string;
  hasBatch: boolean;
  rawRiceReceived: number;
  input: number;
  output: number;
  rejection: number | null;
  rejectionDate: string | null;
  stockAvailable: number;         // rawRiceReceived - input
  runTimeMinutes: number;         // total completed session minutes
  runTimeDisplay: string;         // "Xh Ym"
  operatorName: string;
  partnerName: string;
  efficiency: number;             // output/input * 100
  sessions: MachineSession[];
  hasRunning: boolean;            // any session currently running
  completedSessions: number;
  hasStockEntry: boolean;
}

export interface DashSummary {
  entriesCount: number;
  batchCount: number;
  totalRawReceived: number;
  totalStockAvailable: number;
  totalGrinded: number;
  totalRunMinutes: number;
  totalOutput: number;
  totalRejection: number;
  avgEfficiency: number;
  avgRunHoursPerDay: number;
  uniqueEmployees: string[];
}

@Component({
  selector: 'app-machine-operators-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe,
            CalendarModule, ChartModule, SkeletonModule, TooltipModule],
  templateUrl: './machine-operators-dashboard.component.html',
  styleUrl: './machine-operators-dashboard.component.css',
})
export class MachineOperatorsDashboardComponent implements OnInit {

  // ── Reactive state ────────────────────────────────────────────────────────
  loading   = signal(true);
  error     = signal('');
  rawLogs   = signal<MachineLog[]>([]);

  // ── Filter ────────────────────────────────────────────────────────────────
  activePreset    = signal<string>('today');
  showCustomRange = signal(false);
  showSinglePicker = signal(false);
  dateFrom        = signal<Date | null>(null);
  dateTo          = signal<Date | null>(null);
  singleDate      = signal<Date | null>(null);

  today = new Date();

  // ── Derived entries ───────────────────────────────────────────────────────
  entries = computed<OperatorEntry[]>(() =>
    this.rawLogs().map(log => this.buildEntry(log))
  );

  sortedEntries = computed<OperatorEntry[]>(() =>
    [...this.entries()].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  );

  summary = computed<DashSummary>(() => {
    const es = this.entries();
    if (!es.length) return this.emptySummary();

    const totalRaw  = es.reduce((s, e) => s + e.rawRiceReceived, 0);
    const totalIn   = es.reduce((s, e) => s + e.input, 0);
    const totalOut  = es.reduce((s, e) => s + e.output, 0);
    const totalRej  = es.reduce((s, e) => s + (e.rejection ?? 0), 0);
    const totalMins = es.reduce((s, e) => s + e.runTimeMinutes, 0);
    const batches   = es.filter(e => e.hasBatch).length;
    const allEmps   = new Set<string>();
    es.forEach(e => {
      if (e.operatorName && e.operatorName !== 'Unknown') allEmps.add(e.operatorName);
      if (e.partnerName  && e.partnerName  !== 'Unknown') allEmps.add(e.partnerName);
    });

    return {
      entriesCount:        es.length,
      batchCount:          batches,
      totalRawReceived:    totalRaw,
      totalStockAvailable: totalRaw - totalIn,
      totalGrinded:        totalIn,
      totalRunMinutes:     totalMins,
      totalOutput:         totalOut,
      totalRejection:      totalRej,
      avgEfficiency:       totalIn > 0 ? (totalOut / totalIn) * 100 : 0,
      avgRunHoursPerDay:   es.length > 0 ? totalMins / 60 / es.length : 0,
      uniqueEmployees:     Array.from(allEmps),
    };
  });

  // ── Hero card logic ───────────────────────────────────────────────────────
  heroValue = computed(() => {
    const es = this.entries();
    const preset = this.activePreset();
    if ((preset === 'today' || preset === 'yesterday' || preset === 'single') && es.length === 1) {
      return es[0].hasBatch ? es[0].batchNo : 'No Batch';
    }
    const n = this.summary().batchCount;
    return n > 0 ? `${n} Batch${n !== 1 ? 'es' : ''}` : 'No Batches';
  });

  heroSub = computed(() => {
    const es = this.entries();
    const preset = this.activePreset();
    if ((preset === 'today' || preset === 'yesterday' || preset === 'single') && es.length === 1 && es[0].hasBatch) {
      return `${es[0].operatorName} & ${es[0].partnerName}`;
    }
    const n = this.summary().uniqueEmployees.length;
    return n > 0 ? this.summary().uniqueEmployees.join(', ') : 'No operator data';
  });

  totalRunDisplay = computed(() => this.formatRunTime(this.summary().totalRunMinutes));

  employeesDisplay = computed(() => {
    const emps = this.summary().uniqueEmployees;
    if (!emps.length) return '—';
    if (emps.length <= 4) return emps.join(', ');
    return `${emps.slice(0, 3).join(', ')} +${emps.length - 3}`;
  });

  // ── Chart data ────────────────────────────────────────────────────────────
  runTimeChartData = computed(() => {
    const es = [...this.sortedEntries()].reverse();
    if (!es.length) return null;
    return {
      labels: es.map(e => this.fmtDateLabel(new Date(e.date))),
      datasets: [{
        label: 'Run Time (hrs)',
        data: es.map(e => +(e.runTimeMinutes / 60).toFixed(2)),
        backgroundColor: es.map(e => e.hasRunning
          ? 'rgba(5,150,105,.55)' : 'rgba(14,165,233,.75)'),
        borderColor: es.map(e => e.hasRunning ? '#059669' : '#0ea5e9'),
        borderWidth: 1.5,
        borderRadius: 5,
        borderSkipped: false,
      }],
    };
  });

  ioBarChartData = computed(() => {
    const es = [...this.sortedEntries()].reverse();
    if (!es.length) return null;
    return {
      labels: es.map(e => this.fmtDateLabel(new Date(e.date))),
      datasets: [
        {
          label: 'Input (Grinded)',
          data: es.map(e => e.input),
          backgroundColor: 'rgba(37,99,235,.7)',
          borderColor: '#2563eb',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Output',
          data: es.map(e => e.output),
          backgroundColor: 'rgba(5,150,105,.7)',
          borderColor: '#059669',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Rejection',
          data: es.map(e => e.rejection ?? 0),
          backgroundColor: 'rgba(225,29,72,.6)',
          borderColor: '#e11d48',
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  });

  stockChartData = computed(() => {
    const es = [...this.sortedEntries()].reverse();
    if (!es.length) return null;
    return {
      labels: es.map(e => this.fmtDateLabel(new Date(e.date))),
      datasets: [{
        label: 'Stock Available (kg)',
        data: es.map(e => Math.max(0, e.stockAvailable)),
        fill: true,
        backgroundColor: 'rgba(217,119,6,.1)',
        borderColor: '#d97706',
        borderWidth: 2,
        tension: 0.4,
        pointBackgroundColor: '#d97706',
        pointRadius: 4,
        pointHoverRadius: 6,
      }],
    };
  });

  sessionDoughnutData = computed(() => {
    const es = this.entries();
    if (!es.length) return null;
    const times = [0, 0, 0, 0];
    es.forEach(e =>
      e.sessions.forEach(s => {
        if (s.startTime && s.stopTime && s.sessionNumber >= 1 && s.sessionNumber <= 4) {
          times[s.sessionNumber - 1] +=
            (new Date(s.stopTime).getTime() - new Date(s.startTime).getTime()) / 60000;
        }
      })
    );
    if (times.every(t => t === 0)) return null;
    return {
      labels: ['Morning', 'Mid-day', 'Afternoon', 'Evening'],
      datasets: [{
        data: times.map(t => +(t / 60).toFixed(2)),
        backgroundColor: ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6'],
        borderWidth: 0,
        hoverOffset: 8,
      }],
    };
  });

  // ── Chart options ─────────────────────────────────────────────────────────
  readonly hoursBarOptions = this.makeBarOptions('h');
  readonly kgBarOptions    = this.makeBarOptions('kg');
  readonly kgLineOptions   = this.makeLineOptions('kg');
  readonly doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx: any) => ` ${ctx.label}: ${ctx.parsed.toFixed(2)}h` } },
    },
  };

  // ── Session totals for doughnut legend ────────────────────────────────────
  sessionTimes = computed(() => {
    const data = this.sessionDoughnutData();
    if (!data) return [0, 0, 0, 0];
    return (data.datasets[0].data as number[]);
  });

  get isCustomRangeValid(): boolean {
    return !!this.dateFrom() && !!this.dateTo();
  }

  constructor(@Inject(MachineLogService) private machineLogSvc: MachineLogService) {}

  ngOnInit(): void {
    this.applyPreset('today');
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  load(from?: string, to?: string): void {
    this.loading.set(true);
    this.error.set('');
    this.machineLogSvc.getAllLogs({ limit: 500, from: from ?? null, to: to ?? null }).subscribe({
      next: result => { this.rawLogs.set(result.logs); this.loading.set(false); },
      error: () => {
        this.error.set('Failed to load operator logs. Please retry.');
        this.loading.set(false);
      },
    });
  }

  // ── Presets ───────────────────────────────────────────────────────────────
  setPreset(key: string): void {
    this.showCustomRange.set(false);
    this.showSinglePicker.set(false);
    this.applyPreset(key);
  }

  applyPreset(key: string): void {
    this.activePreset.set(key);
    const now = new Date();
    if (key === 'today') {
      const d = this.toDateStr(now);
      this.load(d, d);
    } else if (key === 'yesterday') {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      const d = this.toDateStr(y);
      this.load(d, d);
    } else if (key === '7d') {
      const f = new Date(now); f.setDate(f.getDate() - 6);
      this.load(this.toDateStr(f), this.toDateStr(now));
    } else if (key === '30d') {
      const f = new Date(now); f.setDate(f.getDate() - 29);
      this.load(this.toDateStr(f), this.toDateStr(now));
    } else {
      this.load();
    }
  }

  toggleCustomRange(): void {
    this.showSinglePicker.set(false);
    this.showCustomRange.update(v => !v);
  }

  toggleSinglePicker(): void {
    this.showCustomRange.set(false);
    this.showSinglePicker.update(v => !v);
  }

  applyCustomRange(): void {
    if (!this.isCustomRangeValid) return;
    this.activePreset.set('custom');
    this.showCustomRange.set(false);
    this.load(this.toDateStr(this.dateFrom()!), this.toDateStr(this.dateTo()!));
  }

  applySingleDate(date: Date): void {
    this.singleDate.set(date);
    this.activePreset.set('single');
    this.showSinglePicker.set(false);
    const d = this.toDateStr(date);
    this.load(d, d);
  }

  // ── Build entry ───────────────────────────────────────────────────────────
  private buildEntry(log: MachineLog): OperatorEntry {
    const opName   = (log.operator as any)?.username || (log.operator as any)?.name || 'Unknown';
    const prName   = (log.partner  as any)?.username || (log.partner  as any)?.name || 'Unknown';
    const raw      = log.rawRiceReceived ?? 0;
    const inp      = log.input ?? 0;
    const out      = log.output ?? 0;
    const hasBatch = raw > 0;
    const runMins  = this.calcRunMinutes(log.sessions);
    const hasRun   = log.sessions.some(s => s.startTime && !s.stopTime);
    const eff      = inp > 0 ? (out / inp) * 100 : 0;

    return {
      _id:              log._id,
      date:             log.date,
      batchNo:          hasBatch ? this.genBatchNo(log, opName, prName) : '—',
      hasBatch,
      rawRiceReceived:  raw,
      input:            inp,
      output:           out,
      rejection:        log.rejection,
      rejectionDate:    log.rejectionDate,
      stockAvailable:   raw - inp,
      runTimeMinutes:   runMins,
      runTimeDisplay:   this.formatRunTime(runMins),
      operatorName:     opName,
      partnerName:      prName,
      efficiency:       eff,
      sessions:         log.sessions,
      hasRunning:       hasRun,
      completedSessions: log.sessions.filter(s => s.startTime && s.stopTime).length,
      hasStockEntry:    log.hasStockEntry,
    };
  }

  private genBatchNo(log: MachineLog, opName: string, prName: string): string {
    const d  = new Date(log.date);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const oi = opName[0]?.toUpperCase() ?? '?';
    const pi = prName[0]?.toUpperCase() ?? '?';
    return `ST-${mm}-${dd}-${oi}${pi}`;
  }

  private calcRunMinutes(sessions: MachineSession[]): number {
    return sessions.reduce((total, s) => {
      if (s.startTime && s.stopTime) {
        return total + (new Date(s.stopTime).getTime() - new Date(s.startTime).getTime()) / 60000;
      }
      return total;
    }, 0);
  }

  formatRunTime(minutes: number): string {
    if (!minutes || minutes < 1) return '0m';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }

  // ── Chart options helpers ─────────────────────────────────────────────────
  private makeBarOptions(unit: 'kg' | 'h') {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: unit === 'kg',
          position: 'bottom',
          labels: { font: { family: 'DM Sans', size: 11 }, boxWidth: 10, padding: 12 },
        },
        tooltip: {
          callbacks: {
            label: (ctx: any) => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}${unit}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: 'DM Sans', size: 11 }, color: '#94a3b8', maxRotation: 45 },
        },
        y: {
          grid: { color: 'rgba(0,0,0,.05)' },
          ticks: {
            font: { family: 'DM Sans', size: 11 },
            color: '#94a3b8',
            callback: (v: any) => `${v}${unit}`,
          },
        },
      },
    };
  }

  private makeLineOptions(unit: 'kg' | '%') {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: any) => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}${unit}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: 'DM Sans', size: 11 }, color: '#94a3b8', maxRotation: 45 },
        },
        y: {
          grid: { color: 'rgba(0,0,0,.05)' },
          ticks: {
            font: { family: 'DM Sans', size: 11 },
            color: '#94a3b8',
            callback: (v: any) => `${v}${unit}`,
          },
        },
      },
    };
  }

  // ── Utility ───────────────────────────────────────────────────────────────
  fmtKg(v: number | null | undefined): string {
    if (v == null || isNaN(+v)) return '—';
    const n = +v;
    return n >= 1000
      ? (n / 1000).toFixed(2) + ' t'
      : n.toLocaleString('en-LK', { maximumFractionDigits: 1 }) + ' kg';
  }

  fmtDateLabel(d: Date): string {
    return d.toLocaleDateString('en-LK', { day: 'numeric', month: 'short' });
  }

  private toDateStr(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  private emptySummary(): DashSummary {
    return {
      entriesCount: 0, batchCount: 0, totalRawReceived: 0,
      totalStockAvailable: 0, totalGrinded: 0, totalRunMinutes: 0,
      totalOutput: 0, totalRejection: 0, avgEfficiency: 0,
      avgRunHoursPerDay: 0, uniqueEmployees: [],
    };
  }
}