import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MachineLogService } from '../../../core/services/machine-log.service';
import { RawRiceStockSummary } from '../../../core/models/material-store';

@Component({
  selector: 'app-raw-rice-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './raw-rice-panel.component.html',
  styleUrl: './raw-rice-panel.component.css',
})
export class RawRicePanelComponent implements OnInit {
  loading = signal(true);
  error = signal<string | null>(null);
  summary = signal<RawRiceStockSummary | null>(null);

  constructor(private machineLogSvc: MachineLogService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.machineLogSvc.getRawRiceStockSummary().subscribe({
      next: data => { this.summary.set(data); this.loading.set(false); },
      error: () => { this.error.set('Failed to load raw rice stock.'); this.loading.set(false); },
    });
  }

  fmt(n: number | null | undefined): string {
    const v = n ?? 0;
    return v.toLocaleString('en-LK', { maximumFractionDigits: 1 }) + ' kg';
  }
}
