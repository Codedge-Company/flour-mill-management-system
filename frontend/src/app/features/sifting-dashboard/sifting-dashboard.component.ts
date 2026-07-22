import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { SievingLogService, SievingLog, BatchOption } from '../../core/services/sieving-log.service';

@Component({
  selector: 'app-sifting-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartModule, SkeletonModule],
  templateUrl: './sifting-dashboard.component.html',
  styleUrl: './sifting-dashboard.component.css',
})
export class SiftingDashboardComponent implements OnInit {
  loading = signal(true);
  error = signal('');

  logs = signal<SievingLog[]>([]);
  outstandingBatches = signal<BatchOption[]>([]);   // ← NEW

  // ── Computed summary ──────────────────────────────────────────────────────
  totalLogs = computed(() => this.logs().length);
  totalParts = computed(() => this.logs().reduce((acc, log) => acc + (log.parts?.length || 0), 0));
  totalInput = computed(() => this.logs().reduce((acc, log) => acc + (log.totalInput || 0), 0));
  totalOutput = computed(() => this.logs().reduce((acc, log) => acc + (log.totalOutput || 0), 0));
  totalRejection = computed(() => this.logs().reduce((acc, log) => acc + (log.totalRejection || 0), 0));
  avgEfficiency = computed(() => {
    const input = this.totalInput();
    return input > 0 ? (this.totalOutput() / input) * 100 : 0;
  });

  // ── Outstanding batches ──────────────────────────────────────────────────
  totalOutstandingBatches = computed(() => this.outstandingBatches().length);
  totalRemainingStock = computed(() =>
    this.outstandingBatches().reduce((sum, b) => sum + (b.remainingStock || 0), 0)
  );

  // ── Charts ─────────────────────────────────────────────────────────────────
  trendData = computed(() => {
    const sorted = [...this.logs()].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (!sorted.length) return null;
    return {
      labels: sorted.map(log => new Date(log.date).toLocaleDateString('en-LK', { day: 'numeric', month: 'short' })),
      datasets: [
        {
          label: 'Input (kg)',
          data: sorted.map(log => log.totalInput),
          backgroundColor: 'rgba(99,102,241,0.6)',
          borderColor: '#4f46e5',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Output (kg)',
          data: sorted.map(log => log.totalOutput),
          backgroundColor: 'rgba(16,185,129,0.6)',
          borderColor: '#059669',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Rejection (kg)',
          data: sorted.map(log => log.totalRejection),
          backgroundColor: 'rgba(239,68,68,0.5)',
          borderColor: '#dc2626',
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  });

  efficiencyDistribution = computed(() => {
    const allParts = this.logs().flatMap(log => log.parts || []);
    const effs = allParts
      .filter(p => p.input && p.input > 0 && p.output !== null)
      .map(p => (p.output! / p.input!) * 100);
    const bins = { '<50%': 0, '50-70%': 0, '70-85%': 0, '85-95%': 0, '>95%': 0 };
    effs.forEach(e => {
      if (e < 50) bins['<50%']++;
      else if (e < 70) bins['50-70%']++;
      else if (e < 85) bins['70-85%']++;
      else if (e < 95) bins['85-95%']++;
      else bins['>95%']++;
    });
    return {
      labels: Object.keys(bins),
      datasets: [{
        data: Object.values(bins),
        backgroundColor: ['#f87171', '#fbbf24', '#60a5fa', '#34d399', '#6ee7b7'],
        borderWidth: 0,
      }],
    };
  });

  // ── Chart options ──────────────────────────────────────────────────────────
  readonly barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { font: { family: 'Inter', size: 11 }, boxWidth: 10, padding: 12 },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 } } },
      y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { family: 'Inter', size: 11 } } },
    },
  };

  readonly doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { font: { family: 'Inter', size: 11 }, boxWidth: 10, padding: 12 },
      },
    },
  };

  constructor(private sievingLogSvc: SievingLogService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set('');
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);

    // Fetch logs and outstanding batches in parallel
    Promise.all([
      this.sievingLogSvc.getAllLogs({
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
        limit: 200,
      }).toPromise(),
      this.sievingLogSvc.getAvailableBatches().toPromise(),
    ]).then(([logs, batches]) => {
      this.logs.set(logs || []);
      this.outstandingBatches.set((batches || []).filter(b => (b.remainingStock || 0) > 0));
      this.loading.set(false);
    }).catch(() => {
      this.error.set('Could not load sifting data. Please try again.');
      this.loading.set(false);
    });
  }

  // Utilities
  formatKg(value: number): string {
    if (value == null) return '—';
    return value >= 1000 ? (value / 1000).toFixed(2) + ' t' : value.toFixed(1) + ' kg';
  }

  formatPercent(value: number): string {
    return value.toFixed(1) + '%';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}