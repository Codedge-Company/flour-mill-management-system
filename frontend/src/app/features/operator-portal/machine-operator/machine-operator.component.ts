// machine-operator.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { UserService, UserResponse } from '../../../core/services/user.service';
import { MachineLogService, MachineLog, MachineSession } from '../../../core/services/machine-log.service';

interface SessionUI {
  number: number;
  label: string;
  data: MachineSession | null;
  loading: boolean;
}

@Component({
  selector: 'app-machine-operator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './machine-operator.component.html',
  styleUrl: './machine-operator.component.css',
})
export class MachineOperatorComponent implements OnInit {

  // ── Date ─────────────────────────────────────────────────────────────────
  /** String bound to <input type="date"> — format YYYY-MM-DD */
  selectedDateStr: string = this.toDateStr(new Date());
  maxDateStr: string = this.toDateStr(new Date());

  get selectedDate(): Date { return new Date(this.selectedDateStr); }

  // ── Operators ─────────────────────────────────────────────────────────────
  operatorList: UserResponse[] = [];
  selectedOperatorId = '';
  selectedPartnerId = '';

  // ── Log ───────────────────────────────────────────────────────────────────
  log: MachineLog | null = null;
  logLoading = false;
  logError = '';


  // ── Sessions ──────────────────────────────────────────────────────────────
  sessions: SessionUI[] = [
    { number: 1, label: 'Morning Session', data: null, loading: false },
    { number: 2, label: 'Mid-day Session', data: null, loading: false },
    { number: 3, label: 'Afternoon Session', data: null, loading: false },
    { number: 4, label: 'Evening Session',   data: null, loading: false }, 
  ];

  // ── Stock ─────────────────────────────────────────────────────────────────
  showStockForm = false;
  stockSaving = false;
  stockSaved = false;   // ← add this
  rawRiceReceived: number | null = null;
  stockInput: number | null = null;
  stockOutput: number | null = null;
  rejection: number | null = null;
  rejectionDateStr = '';

  constructor(
    public authService: AuthService,
    private router: Router,
    private userService: UserService,
    private machineLogSvc: MachineLogService,
  ) { }

  ngOnInit(): void {
    this.loadOperators();
    this.loadLog();
  }

  // ── Operators ─────────────────────────────────────────────────────────────
  loadOperators(): void {
    this.userService.getUsersByRoles(['MACHINE_OPERATOR']).subscribe({
      next: users => (this.operatorList = users),
      error: () => {
        this.userService.getAllUsers().subscribe(
          all => (this.operatorList = all.filter(u => u.role === 'MACHINE_OPERATOR'))
        );
      },
    });
  }
  canStart(s: SessionUI): boolean {
    // Disable if THIS session is already done or running
    if (this.sessionState(s) !== 'idle') return false;
    // Disable if ANY other session is currently running
    return !this.sessions.some(other => this.sessionState(other) === 'running');
  }
  get operatorOptions(): UserResponse[] {
    return this.operatorList.filter(u => u._id !== this.selectedPartnerId);
  }

  get partnerOptions(): UserResponse[] {
    return this.operatorList.filter(u => u._id !== this.selectedOperatorId);
  }

  onOperatorChange(): void {
    if (this.log) this.updateOperators();
  }

  onPartnerChange(): void {
    if (this.log) this.updateOperators();
  }

  // ── Log ───────────────────────────────────────────────────────────────────
  loadLog(): void {
    this.logLoading = true;
    this.logError = '';
    this.machineLogSvc.getByDate(this.selectedDate).subscribe({
      next: log => {
        this.log = log;
        if (log) {
          this.selectedOperatorId = log.operator._id;
          this.selectedPartnerId = log.partner._id;
          this.syncSessions(log);
          this.syncStockForm(log);
        }
        this.logLoading = false;
      },
      error: () => { this.logLoading = false; this.logError = 'Could not load log. Please try again.'; },
    });
  }

  onDateChange(): void {
    this.log = null;
    this.resetSessions();
    this.loadLog();
  }

  createLog(): void {
    if (!this.selectedOperatorId || !this.selectedPartnerId) {
      this.logError = 'Please select both an operator and a partner.';
      return;
    }
    if (this.selectedOperatorId === this.selectedPartnerId) {
      this.logError = 'Operator and partner must be different people.';
      return;
    }
    this.logLoading = true;
    this.logError = '';
    this.machineLogSvc
      .createLog(this.selectedDate, this.selectedOperatorId, this.selectedPartnerId)
      .subscribe({
        next: log => { this.log = log; this.syncSessions(log); this.logLoading = false; },
        error: () => { this.logLoading = false; this.logError = 'Failed to create log.'; },
      });
  }

  updateOperators(): void {
    if (!this.log || !this.selectedOperatorId || !this.selectedPartnerId) return;
    if (this.selectedOperatorId === this.selectedPartnerId) {
      this.logError = 'Operator and partner must be different.'; return;
    }
    this.logError = '';
    this.machineLogSvc
      .updateOperators(this.log._id, this.selectedOperatorId, this.selectedPartnerId)
      .subscribe({ next: log => (this.log = log) });
  }

  // ── Sessions ──────────────────────────────────────────────────────────────
  startSession(s: SessionUI): void {
    if (!this.log) return;
    s.loading = true;
    this.machineLogSvc.recordStart(this.log._id, s.number).subscribe({
      next: log => { this.log = log; this.syncSessions(log); s.loading = false; },
      error: () => { s.loading = false; },
    });
  }

  stopSession(s: SessionUI): void {
    if (!this.log) return;
    s.loading = true;
    this.machineLogSvc.recordStop(this.log._id, s.number).subscribe({
      next: log => { this.log = log; this.syncSessions(log); s.loading = false; },
      error: () => { s.loading = false; },
    });
  }

  sessionState(s: SessionUI): 'idle' | 'running' | 'done' {
    if (!s.data) return 'idle';
    if (s.data.startTime && !s.data.stopTime) return 'running';
    if (s.data.startTime && s.data.stopTime) return 'done';
    return 'idle';
  }

  sessionTagLabel(s: SessionUI): string {
    const st = this.sessionState(s);
    if (st === 'running') return 'Running';
    if (st === 'done') return 'Complete';
    return 'Idle';
  }

  sessionDuration(s: SessionUI): string {
    if (!s.data?.startTime || !s.data.stopTime) return '';
    const ms = new Date(s.data.stopTime).getTime() - new Date(s.data.startTime).getTime();
    const min = Math.floor(ms / 60000);
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  private syncSessions(log: MachineLog): void {
    this.sessions.forEach(s => {
      s.data = log.sessions.find(ls => ls.sessionNumber === s.number) ?? null;
    });
  }

  private resetSessions(): void {
    this.sessions.forEach(s => (s.data = null));
  }

  // ── Stock ─────────────────────────────────────────────────────────────────
  private syncStockForm(log: MachineLog): void {
    if (!log.hasStockEntry) return;
    this.showStockForm = true;
    this.rawRiceReceived = log.rawRiceReceived;
    this.stockInput = log.input;
    this.stockOutput = log.output;
    this.rejection = log.rejection;
    this.rejectionDateStr = log.rejectionDate
      ? new Date(log.rejectionDate).toISOString().split('T')[0]
      : '';
  }

  saveStock(): void {
    if (!this.log) return;
    this.stockSaving = true;
    this.stockSaved = false;
    this.machineLogSvc
      .updateStock(this.log._id, {
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
          setTimeout(() => this.stockSaved = false, 4000); // auto-hide after 4s
        },
        error: () => { this.stockSaving = false; },
      });
  }

  get efficiency(): string {
    if (!this.stockInput || !this.stockOutput || this.stockInput === 0) return '';
    return ((this.stockOutput / this.stockInput) * 100).toFixed(1) + '%';
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/portal/machine-operator');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  formatTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', hour12: true });
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
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  }
}
