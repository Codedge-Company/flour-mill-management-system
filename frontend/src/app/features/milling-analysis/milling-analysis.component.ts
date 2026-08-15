// src/app/features/milling-analysis/milling-analysis.component.ts
//
// UNIFIED MILLING ANALYSIS PAGE
// ─────────────────────────────
// Replaces having 3 separate dashboards (Grinding / Sifting / Packing) with
// ONE page that has a shared date filter (All / Today / Yesterday / 7 Days /
// 30 Days / single date / custom range) and a tab switcher between the three
// sections. Data is fetched once per refresh and filtered client-side so
// switching tabs or date presets never triggers a network round-trip.
//
// ⚠️ ADJUST BEFORE USE:
//   - Import paths for the 3 services below (MachineLogService,
//     SievingLogService, StockRequestService) — update to match your
//     actual folder structure if different.
//   - Field names on StockRequest (packName, qty, fulfilledQty,
//     fulfillments[].date, requestedAt) — these come from the
//     StockRequestService you already have; rename only if your model
//     differs.

import {
  Component, OnInit, signal, computed, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalendarModule } from 'primeng/calendar';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';

import { MachineLogService, MachineLog, MachineSession } from '../../core/services/machine-log.service';
import { SievingLogService, SievingLog } from '../../core/services/sieving-log.service';
import { StockRequestService, StockRequest } from '../../core/services/stock-request.service';

// ── Tab type ──────────────────────────────────────────────────────────────
export type MillingTab = 'grinding' | 'sifting' | 'packing';

// ── Row models (post-processing, ready for the template) ───────────────────
export interface GrindEntry {
  _id: string;
  date: string;
  batchNo: string;
  hasBatch: boolean;
  operatorName: string;
  partnerName: string;
  rawRiceReceived: number;
  input: number;
  output: number;
  rejection: number;
  runTimeMinutes: number;
  runTimeDisplay: string;
  efficiency: number;
  hasRunning: boolean;
}

export interface SiftEntry {
  _id: string;
  date: string;
  batchNo: string;
  operatorName: string;
  input: number;
  output: number;
  rejection: number;
  efficiency: number;
  isCompleted: boolean;
  partsCount: number;
}

export interface PackEntry {
  stockRequestId: string;
  date: string;          // requestedAt
  packName: string;
  weightKg: number;
  ordered: number;       // qty
  completed: number;     // fulfilledQty (all-time, NOT date filtered)
  completedInRange: number; // sum of fulfillments whose date falls in the active filter
  remaining: number;
  status: string;
  operatorName: string;
}

// ── Summaries ────────────────────────────────────────────────────────────
export interface GrindSummary {
  entriesCount: number;
  batchCount: number;
  totalRawReceived: number;
  totalInput: number;
  totalOutput: number;
  totalRejection: number;
  totalRunMinutes: number;
  avgEfficiency: number;
  uniqueOperators: string[];
}

export interface SiftSummary {
  entriesCount: number;
  batchCount: number;
  totalInput: number;
  totalOutput: number;
  totalRejection: number;
  avgEfficiency: number;
  uniqueOperators: string[];
  completedCount: number;
}

export interface PackSummary {
  requestCount: number;
  totalOrdered: number;
  totalCompletedInRange: number;
  totalRemaining: number;
  completionRate: number; // completedInRange / ordered (for requests touched in range)
}

@Component({
  selector: 'app-milling-analysis',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    CalendarModule, ChartModule, SkeletonModule, TooltipModule,
    DecimalPipe, DatePipe, TitleCasePipe,
  ],
  templateUrl: './milling-analysis.component.html',
  styleUrl: './milling-analysis.component.css',
})
export class MillingAnalysisComponent implements OnInit {

  // ── Tab state ──────────────────────────────────────────────────────────
  activeTab = signal<MillingTab>('grinding');
  setTab(tab: MillingTab): void { this.activeTab.set(tab); }

  // ── Loading / error (one flag per source so a slow one doesn't block others) ──
  loadingGrind = signal(true);
  loadingSift = signal(true);
  loadingPack = signal(true);
  loading = computed(() => this.loadingGrind() || this.loadingSift() || this.loadingPack());

  error = signal<string | null>(null);

  // ── Raw data (fetched once, filtered client-side) ─────────────────────
  rawMachineLogs = signal<MachineLog[]>([]);
  rawSievingLogs = signal<SievingLog[]>([]);
  rawStockRequests = signal<StockRequest[]>([]);

  // ── Shared date filter ──────────────────────────────────────────────────
  today = new Date();
  activePreset = signal<string>('all');
  dateFrom = signal<Date | null>(null);
  dateTo = signal<Date | null>(null);
  singleDate = signal<Date | null>(null);
  showSinglePicker = signal(false);
  showCustomRange = signal(false);

  get isCustomRangeValid(): boolean {
    return !!this.dateFrom() && !!this.dateTo();
  }

  constructor(
    private machineLogSvc: MachineLogService,
    private sievingLogSvc: SievingLogService,
    private stockRequestSvc: StockRequestService,
  ) {}

  ngOnInit(): void {
    this.setPreset('all');
    this.loadAll();
  }

  // ── Data loading (fetch everything once; filtering happens in computed()) ──
  loadAll(): void {
    this.error.set(null);

    this.loadingGrind.set(true);
    this.machineLogSvc.getAllLogs({ limit: 1000 }).subscribe({
      next: res => { this.rawMachineLogs.set(res.logs || []); this.loadingGrind.set(false); },
      error: () => { this.error.set('Failed to load grinding logs.'); this.loadingGrind.set(false); },
    });

    this.loadingSift.set(true);
    this.sievingLogSvc.getAllLogs({ limit: 1000 }).subscribe({
      next: logs => { this.rawSievingLogs.set(logs || []); this.loadingSift.set(false); },
      error: () => { this.error.set('Failed to load sifting logs.'); this.loadingSift.set(false); },
    });

    this.loadingPack.set(true);
    this.stockRequestSvc.getAll().subscribe({
      next: res => { this.rawStockRequests.set(res.data || []); this.loadingPack.set(false); },
      error: () => { this.error.set('Failed to load packing requests.'); this.loadingPack.set(false); },
    });
  }

  refresh(): void { this.loadAll(); }

  // ── Date range helper (date-only comparison, inclusive) ─────────────────
  private inRange(dateStr: string | null | undefined): boolean {
    if (!dateStr) return false;
    const from = this.dateFrom();
    const to = this.dateTo();
    if (!from && !to) return true; // "all"
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    if (from) {
      const f = new Date(from); f.setHours(0, 0, 0, 0);
      if (d < f) return false;
    }
    if (to) {
      const t = new Date(to); t.setHours(23, 59, 59, 999);
      if (d.getTime() > t.getTime()) return false;
    }
    return true;
  }

  // ════════════════════════════════════════════════════════════════════════
  // GRINDING
  // ════════════════════════════════════════════════════════════════════════
  grindEntries = computed<GrindEntry[]>(() =>
    this.rawMachineLogs()
      .filter(log => this.inRange(log.date))
      .map(log => this.buildGrindEntry(log))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  );

  grindSummary = computed<GrindSummary>(() => {
    const es = this.grindEntries();
    if (!es.length) {
      return {
        entriesCount: 0, batchCount: 0, totalRawReceived: 0, totalInput: 0,
        totalOutput: 0, totalRejection: 0, totalRunMinutes: 0, avgEfficiency: 0,
        uniqueOperators: [],
      };
    }
    const totalRaw = es.reduce((s, e) => s + e.rawRiceReceived, 0);
    const totalIn = es.reduce((s, e) => s + e.input, 0);
    const totalOut = es.reduce((s, e) => s + e.output, 0);
    const totalRej = es.reduce((s, e) => s + e.rejection, 0);
    const totalMins = es.reduce((s, e) => s + e.runTimeMinutes, 0);
    const batches = es.filter(e => e.hasBatch).length;
    const ops = new Set<string>();
    es.forEach(e => {
      if (e.operatorName && e.operatorName !== 'Unknown') ops.add(e.operatorName);
      if (e.partnerName && e.partnerName !== 'Unknown') ops.add(e.partnerName);
    });
    return {
      entriesCount: es.length,
      batchCount: batches,
      totalRawReceived: totalRaw,
      totalInput: totalIn,
      totalOutput: totalOut,
      totalRejection: totalRej,
      totalRunMinutes: totalMins,
      avgEfficiency: totalIn > 0 ? (totalOut / totalIn) * 100 : 0,
      uniqueOperators: Array.from(ops),
    };
  });

  grindTrendData = computed(() => {
    const es = [...this.grindEntries()].reverse();
    if (!es.length) return null;
    return {
      labels: es.map(e => this.fmtDateLabel(e.date)),
      datasets: [
        {
          label: 'Input (kg)', data: es.map(e => e.input),
          backgroundColor: 'rgba(37,99,235,.75)', borderRadius: 4, borderSkipped: false,
        },
        {
          label: 'Output (kg)', data: es.map(e => e.output),
          backgroundColor: 'rgba(5,150,105,.75)', borderRadius: 4, borderSkipped: false,
        },
      ],
    };
  });

  private buildGrindEntry(log: MachineLog): GrindEntry {
    const opName = (log.operator as any)?.username || (log.operator as any)?.name || 'Unknown';
    const prName = (log.partner as any)?.username || (log.partner as any)?.name || 'Unknown';
    const raw = log.rawRiceReceived ?? 0;
    const inp = log.input ?? 0;
    const out = log.output ?? 0;
    const rej = log.rejection ?? 0;
    const hasBatch = raw > 0;
    const runMins = this.calcRunMinutes(log.sessions);
    const hasRun = (log.sessions || []).some(s => s.startTime && !s.stopTime);
    const eff = inp > 0 ? (out / inp) * 100 : 0;

    return {
      _id: log._id,
      date: log.date,
      batchNo: hasBatch ? this.genBatchNo(log, opName, prName) : '—',
      hasBatch,
      operatorName: opName,
      partnerName: prName,
      rawRiceReceived: raw,
      input: inp,
      output: out,
      rejection: rej,
      runTimeMinutes: runMins,
      runTimeDisplay: this.formatRunTime(runMins),
      efficiency: eff,
      hasRunning: hasRun,
    };
  }

  private genBatchNo(log: MachineLog, opName: string, prName: string): string {
    const d = new Date(log.date);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const oi = opName[0]?.toUpperCase() ?? '?';
    const pi = prName[0]?.toUpperCase() ?? '?';
    return `ST-${mm}-${dd}-${oi}${pi}`;
  }

  private calcRunMinutes(sessions: MachineSession[] | undefined): number {
    return (sessions || []).reduce((total, s) => {
      if (s.startTime && s.stopTime) {
        return total + (new Date(s.stopTime).getTime() - new Date(s.startTime).getTime()) / 60000;
      }
      return total;
    }, 0);
  }

  // ════════════════════════════════════════════════════════════════════════
  // SIFTING
  // ════════════════════════════════════════════════════════════════════════
  siftEntries = computed<SiftEntry[]>(() =>
    this.rawSievingLogs()
      .filter(log => this.inRange(log.date))
      .map(log => this.buildSiftEntry(log))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  );

  siftSummary = computed<SiftSummary>(() => {
    const es = this.siftEntries();
    if (!es.length) {
      return {
        entriesCount: 0, batchCount: 0, totalInput: 0, totalOutput: 0,
        totalRejection: 0, avgEfficiency: 0, uniqueOperators: [], completedCount: 0,
      };
    }
    const totalIn = es.reduce((s, e) => s + e.input, 0);
    const totalOut = es.reduce((s, e) => s + e.output, 0);
    const totalRej = es.reduce((s, e) => s + e.rejection, 0);
    const ops = new Set<string>();
    es.forEach(e => { if (e.operatorName && e.operatorName !== '—') ops.add(e.operatorName); });
    return {
      entriesCount: es.length,
      batchCount: new Set(es.map(e => e.batchNo)).size,
      totalInput: totalIn,
      totalOutput: totalOut,
      totalRejection: totalRej,
      avgEfficiency: totalIn > 0 ? (totalOut / totalIn) * 100 : 0,
      uniqueOperators: Array.from(ops),
      completedCount: es.filter(e => e.isCompleted).length,
    };
  });

  siftTrendData = computed(() => {
    const es = [...this.siftEntries()].reverse();
    if (!es.length) return null;
    return {
      labels: es.map(e => this.fmtDateLabel(e.date)),
      datasets: [
        {
          label: 'Flour Input (kg)', data: es.map(e => e.input),
          backgroundColor: 'rgba(99,102,241,.65)', borderRadius: 4, borderSkipped: false,
        },
        {
          label: 'Flour Output (kg)', data: es.map(e => e.output),
          backgroundColor: 'rgba(16,185,129,.65)', borderRadius: 4, borderSkipped: false,
        },
        {
          label: 'Rejection (kg)', data: es.map(e => e.rejection),
          backgroundColor: 'rgba(225,29,72,.55)', borderRadius: 4, borderSkipped: false,
        },
      ],
    };
  });

  private buildSiftEntry(log: SievingLog): SiftEntry {
    const opName = log.operator?.username || '—';
    const inp = log.totalInput ?? 0;
    const out = log.totalOutput ?? 0;
    const rej = log.totalRejection ?? 0;
    return {
      _id: log._id,
      date: log.date,
      batchNo: log.batchNo || '—',
      operatorName: opName,
      input: inp,
      output: out,
      rejection: rej,
      efficiency: inp > 0 ? (out / inp) * 100 : 0,
      isCompleted: !!log.isCompleted,
      partsCount: log.parts?.length || 0,
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // PACKING
  // ════════════════════════════════════════════════════════════════════════
  // "Ordered" = requests whose requestedAt falls in the active date range.
  // "Completed" = sum of that request's fulfillments whose OWN date falls in
  // the active range (so a bag packed today counts today, even if the order
  // itself was placed last week).
  packEntries = computed<PackEntry[]>(() => {
    const preset = this.activePreset();
    return this.rawStockRequests()
      .filter(r => preset === 'all' ? true : this.inRange(r.requestedAt))
      .map(r => this.buildPackEntry(r))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });

  packSummary = computed<PackSummary>(() => {
    const es = this.packEntries();
    if (!es.length) {
      return { requestCount: 0, totalOrdered: 0, totalCompletedInRange: 0, totalRemaining: 0, completionRate: 0 };
    }
    const totalOrdered = es.reduce((s, e) => s + e.ordered, 0);
    const totalCompletedInRange = es.reduce((s, e) => s + e.completedInRange, 0);
    const totalRemaining = es.reduce((s, e) => s + e.remaining, 0);
    return {
      requestCount: es.length,
      totalOrdered,
      totalCompletedInRange,
      totalRemaining,
      completionRate: totalOrdered > 0 ? (totalCompletedInRange / totalOrdered) * 100 : 0,
    };
  });

  packTrendData = computed(() => {
    const es = [...this.packEntries()].reverse();
    if (!es.length) return null;
    return {
      labels: es.map(e => this.fmtDateLabel(e.date)),
      datasets: [
        {
          label: 'Ordered (bags)', data: es.map(e => e.ordered),
          backgroundColor: 'rgba(217,119,6,.7)', borderRadius: 4, borderSkipped: false,
        },
        {
          label: 'Completed (bags)', data: es.map(e => e.completedInRange),
          backgroundColor: 'rgba(5,150,105,.7)', borderRadius: 4, borderSkipped: false,
        },
      ],
    };
  });

  private buildPackEntry(r: StockRequest): PackEntry {
    const completedInRange = (r.fulfillments || [])
      .filter(f => this.inRange(f.date))
      .reduce((s, f) => s + (f.qty || 0), 0);

    return {
      stockRequestId: r.stockRequestId,
      date: r.requestedAt,
      packName: r.packName,
      weightKg: r.weightKg,
      ordered: r.qty ?? 0,
      completed: r.fulfilledQty ?? 0,
      completedInRange,
      remaining: r.remainingQty ?? Math.max((r.qty ?? 0) - (r.fulfilledQty ?? 0), 0),
      status: r.status,
      operatorName: r.operatorName || '—',
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // SHARED CHART OPTIONS
  // ════════════════════════════════════════════════════════════════════════
  readonly kgBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { position: 'bottom' as const, labels: { font: { family: 'DM Sans', size: 11 }, boxWidth: 10, padding: 12 } },
      tooltip: {
        backgroundColor: '#1e293b', titleColor: '#f8fafc', bodyColor: '#cbd5e1',
        callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString()}` },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#94a3b8', maxRotation: 45 } },
      y: { grid: { color: 'rgba(0,0,0,.05)' }, ticks: { font: { family: 'DM Sans', size: 11 }, color: '#94a3b8' } },
    },
  };

  // ════════════════════════════════════════════════════════════════════════
  // DATE PRESETS (shared across all 3 tabs)
  // ════════════════════════════════════════════════════════════════════════
  setPreset(preset: string): void {
    this.activePreset.set(preset);
    this.showCustomRange.set(false);
    this.showSinglePicker.set(false);
    this.singleDate.set(null);

    const now = new Date();
    switch (preset) {
      case 'all':
        this.dateFrom.set(null); this.dateTo.set(null); break;
      case 'today':
        this.dateFrom.set(new Date(now)); this.dateTo.set(new Date(now)); break;
      case 'yesterday': {
        const y = new Date(now); y.setDate(y.getDate() - 1);
        this.dateFrom.set(y); this.dateTo.set(y); break;
      }
      case '7d': {
        const f = new Date(now); f.setDate(f.getDate() - 6);
        this.dateFrom.set(f); this.dateTo.set(now); break;
      }
      case '30d': {
        const f = new Date(now); f.setDate(f.getDate() - 29);
        this.dateFrom.set(f); this.dateTo.set(now); break;
      }
    }
  }

  applySingleDate(date: Date | null): void {
    if (!date) return;
    this.singleDate.set(date);
    this.activePreset.set('single');
    this.showSinglePicker.set(false);
    this.dateFrom.set(date);
    this.dateTo.set(date);
  }

  toggleSinglePicker(): void {
    this.showSinglePicker.update(v => !v);
    this.showCustomRange.set(false);
  }

  toggleCustomRange(): void {
    this.showCustomRange.update(v => !v);
    this.showSinglePicker.set(false);
  }

  applyCustomRange(): void {
    if (!this.isCustomRangeValid) return;
    this.activePreset.set('custom');
    this.showCustomRange.set(false);
  }

  // ── Utilities ─────────────────────────────────────────────────────────
  fmtKg(v: number | null | undefined): string {
    if (v == null || isNaN(+v)) return '—';
    const n = +v;
    return n >= 1000
      ? (n / 1000).toFixed(2) + ' t'
      : n.toLocaleString('en-LK', { maximumFractionDigits: 1 }) + ' kg';
  }

  formatRunTime(minutes: number): string {
    if (!minutes || minutes < 1) return '0m';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }

  fmtDateLabel(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-LK', { day: 'numeric', month: 'short' });
  }
}