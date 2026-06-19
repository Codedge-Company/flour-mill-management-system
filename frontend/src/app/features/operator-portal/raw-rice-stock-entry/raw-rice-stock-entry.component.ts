import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { MachineLogService, MachineLog } from '../../../core/services/machine-log.service';

@Component({
  selector: 'app-raw-rice-stock-entry',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './raw-rice-stock-entry.component.html',
  styleUrl: './raw-rice-stock-entry.component.css',
})
export class RawRiceStockEntryComponent implements OnInit {

  // ── Date ─────────────────────────────────────────────────────────────────
  selectedDateStr: string = this.toDateStr(new Date());
  maxDateStr: string = this.toDateStr(new Date());
  get selectedDate(): Date { return new Date(this.selectedDateStr); }

  // ── Existing log for this date (may be null — that's fine now) ────────────
  log: MachineLog | null = null;
  logLoading = false;
  logError = '';

  // ── Stock fields ──────────────────────────────────────────────────────────
  stockSaving = false;
  stockSaved = false;
  rawRiceReceived: number | null = null;
  stockInput: number | null = null;
  stockOutput: number | null = null;
  rejection: number | null = null;
  rejectionDateStr = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private machineLogSvc: MachineLogService,
  ) { }

  ngOnInit(): void {
    const qDate = this.route.snapshot.queryParamMap.get('date');
    if (qDate) this.selectedDateStr = qDate;
    this.loadExistingData();
  }

  // Loads whatever data exists for this date (if any) to prefill the form.
  // Does NOT block the form if nothing exists — it just stays empty.
  loadExistingData(): void {
    this.logLoading = true;
    this.logError = '';
    this.machineLogSvc.getByDate(this.selectedDate).subscribe({
      next: log => {
        this.log = log;
        if (log && log.hasStockEntry) {
          this.syncStockForm(log);
        } else {
          this.clearStockForm();
        }
        this.logLoading = false;
      },
      error: () => {
        // No log / network hiccup — not an error state for this page,
        // just treat it as "nothing saved yet".
        this.log = null;
        this.clearStockForm();
        this.logLoading = false;
      },
    });
  }

  onDateChange(): void {
    this.loadExistingData();
  }

  private syncStockForm(log: MachineLog): void {
    this.rawRiceReceived = log.rawRiceReceived;
    this.stockInput = log.input;
    this.stockOutput = log.output;
    this.rejection = log.rejection;
    this.rejectionDateStr = log.rejectionDate
      ? new Date(log.rejectionDate).toISOString().split('T')[0]
      : '';
  }

  private clearStockForm(): void {
    this.rawRiceReceived = null;
    this.stockInput = null;
    this.stockOutput = null;
    this.rejection = null;
    this.rejectionDateStr = '';
  }

  saveStock(): void {
    this.stockSaving = true;
    this.stockSaved = false;
    this.machineLogSvc
      .upsertStockByDate(this.selectedDate, {
        rawRiceReceived: this.rawRiceReceived,
        input: this.stockInput,
        output: this.stockOutput,
        rejection: this.rejection,
        rejectionDate: this.rejectionDateStr || null,
      })
      .subscribe({
        next: log => {
          this.log = log;
          this.stockSaving = false;
          this.stockSaved = true;
          setTimeout(() => this.stockSaved = false, 4000);
        },
        error: () => { this.stockSaving = false; },
      });
  }

  get efficiency(): string {
    if (!this.stockInput || !this.stockOutput || this.stockInput === 0) return '';
    return ((this.stockOutput / this.stockInput) * 100).toFixed(1) + '%';
  }

  goBack(): void {
    this.router.navigate(['/portal/machine-operator']);
  }

  formatDateLabel(d: Date): string {
    return d.toLocaleDateString('en-LK', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  get isToday(): boolean {
    const now = new Date();
    const d = this.selectedDate;
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }

  private toDateStr(d: Date): string {
    return d.toISOString().split('T')[0];
  }
}