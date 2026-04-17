import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { UserService, UserResponse } from '../../../core/services/user.service';
import { SievingLogService, SievingLog, SievingPart, BatchOption } from '../../../core/services/sieving-log.service';

interface PartForm {
  input: number | null;
  output: number | null;
  rejection: number | null;
  note: string;
}

@Component({
  selector: 'app-sifting-operator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sifting-operator.component.html',
  styleUrl: './sifting-operator.component.css',
})
export class SiftingOperatorComponent implements OnInit {

  operatorList: UserResponse[] = [];
  selectedOperatorId = '';

  batches: BatchOption[] = [];
  batchesLoading = false;
  selectedBatchId = '';

  get selectedBatch(): BatchOption | null {
    return this.batches.find(b => b._id === this.selectedBatchId) ?? null;
  }

  // ── log getter/setter ──────────────────────────────────────────────────────
  // Using a setter so that whenever log is assigned (startLog, submitPart,
  // saveEdit, or loadActiveLog on reload) we immediately attempt to resolve
  // the batch ceiling — whichever arrives last (log or batches) wins.
  private _log: SievingLog | null = null;

  get log(): SievingLog | null { return this._log; }

  set log(value: SievingLog | null) {
    this._log = value;
    if (value && this.remainingAtStart === null) {
      this.resolveActiveBatch();
    }
  }

  logLoading = false;
  logError = '';

  // ── Part add form ──────────────────────────────────────────────────────────
  showAddForm = false;
  addingPart = false;
  newPart: PartForm = { input: null, output: null, rejection: null, note: '' };

  // ── Part edit ──────────────────────────────────────────────────────────────
  editingPartId: string | null = null;
  editPart: PartForm = { input: null, output: null, rejection: null, note: '' };
  savingPartId: string | null = null;

  // ── Delete ─────────────────────────────────────────────────────────────────
  deletingPartId: string | null = null;

  // ── Complete ───────────────────────────────────────────────────────────────
  completing = false;
  showConfirmDialog = false;

  // ── Batch tracking ─────────────────────────────────────────────────────────
  activeBatch: BatchOption | null = null;

  // Locked in ONCE — the kg ceiling for this session.
  // Set directly in startLog() from the live selectedBatch.
  // Reconstructed in resolveActiveBatch() after a page reload.
  // Never mutated after that — so adding parts cannot corrupt it.
  remainingAtStart: number | null = null;

  constructor(
    public authService: AuthService,
    private router: Router,
    private userService: UserService,
    private sievingLogSvc: SievingLogService,
  ) { }

  ngOnInit(): void {
    this.loadOperators();
    // Run both in parallel — whichever finishes last triggers resolveActiveBatch()
    this.loadBatches();
    this.loadActiveLog();
  }

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

  loadBatches(): void {
    this.batchesLoading = true;
    this.sievingLogSvc.getAvailableBatches().subscribe({
      next: b => {
        this.batches = b.filter(batch => (batch.remainingStock ?? 0) > 0);
        this.batchesLoading = false;
        // Batches just arrived — if log was already set, resolve now
        if (this._log && this.remainingAtStart === null) {
          this.resolveActiveBatch();
        }
      },
      error: () => { this.batchesLoading = false; },
    });
  }

  /**
   * On page reload, re-fetch the operator's active (incomplete) log.
   * This restores this.log so resolveActiveBatch() can compute remainingAtStart.
   * If your SievingLogService has a getActiveLog() or getTodayLog() method, use it.
   * If not, see the note below on what to add to the service.
   */
  loadActiveLog(): void {
    this.sievingLogSvc.getActiveLog().subscribe({
      next: log => {
        if (log && !log.isCompleted) {
          // Uses the setter — triggers resolveActiveBatch() if batches already loaded
          this.log = log;
        }
      },
      error: () => {
        // No active log found — fresh session, nothing to restore
      },
    });
  }

  startLog(): void {
    if (!this.selectedBatchId || !this.selectedOperatorId) {
      this.logError = 'Please select a batch and an operator.';
      return;
    }
    this.logLoading = true;
    this.logError = '';
    this.sievingLogSvc.createLog(this.selectedBatchId, this.selectedOperatorId).subscribe({
      next: log => {
        this.activeBatch = this.selectedBatch;
        // Lock in the ceiling BEFORE any parts exist — direct assignment, not via setter logic
        this.remainingAtStart = this.selectedBatch?.remainingStock ?? 0;
        this.log = log;
        this.logLoading = false;
      },
      error: () => { this.logLoading = false; this.logError = 'Failed to start sifting log.'; },
    });
  }

  // ── Parts ──────────────────────────────────────────────────────────────────
  openAddForm(): void {
    this.newPart = { input: null, output: null, rejection: null, note: '' };
    this.showAddForm = true;
    this.editingPartId = null;
  }

  cancelAdd(): void { this.showAddForm = false; }

  submitPart(): void {
    if (!this.log) return;
    this.addingPart = true;
    this.sievingLogSvc.addPart(this.log._id, this.newPart).subscribe({
      next: log => {
        this.log = log;
        this.addingPart = false;
        this.showAddForm = false;
        this.checkAutoComplete();
      },
      error: () => { this.addingPart = false; },
    });
  }

  startEdit(part: SievingPart): void {
    this.editingPartId = part._id;
    this.editPart = {
      input: part.input, output: part.output,
      rejection: part.rejection, note: part.note,
    };
    this.showAddForm = false;
  }

  cancelEdit(): void { this.editingPartId = null; }

  saveEdit(partId: string): void {
    if (!this.log) return;
    this.savingPartId = partId;
    this.sievingLogSvc.updatePart(this.log._id, partId, this.editPart).subscribe({
      next: log => {
        this.log = log;
        this.savingPartId = null;
        this.editingPartId = null;
        this.checkAutoComplete();
      },
      error: () => { this.savingPartId = null; },
    });
  }

  deletePart(partId: string): void {
    if (!this.log) return;
    this.deletingPartId = partId;
    this.sievingLogSvc.removePart(this.log._id, partId).subscribe({
      next: log => { this.log = log; this.deletingPartId = null; },
      error: () => { this.deletingPartId = null; },
    });
  }

  // ── Complete ───────────────────────────────────────────────────────────────
  confirmComplete(): void { this.showConfirmDialog = true; }
  cancelComplete(): void { this.showConfirmDialog = false; }

  doComplete(): void {
    if (!this.log) return;
    this.showConfirmDialog = false;
    this.completing = true;
    this.sievingLogSvc.completeLog(this.log._id).subscribe({
      next: log => { this.log = log; this.completing = false; },
      error: () => { this.completing = false; },
    });
  }

  // ── Computed ───────────────────────────────────────────────────────────────
  get totalInput(): number { return this._log?.totalInput ?? 0; }
  get totalOutput(): number { return this._log?.totalOutput ?? 0; }
  get totalRejection(): number { return this._log?.totalRejection ?? 0; }
  get totalLoss(): number { return Math.max(0, this.totalInput - this.totalOutput - this.totalRejection); }

  get overallEfficiency(): string {
    if (!this.totalInput || !this.totalOutput) return '';
    return ((this.totalOutput / this.totalInput) * 100).toFixed(1) + '%';
  }

  /**
   * Kg still available to enter as Input for this session.
   * remainingAtStart is locked once and never changes.
   * Returns Infinity when not yet resolved → validation never fires a false positive.
   */
  get sessionRemaining(): number {
    if (this.remainingAtStart === null) return Infinity;
    return Math.max(0, this.remainingAtStart - this.totalInput);
  }

  get newPartInputExceedsLimit(): boolean {
    if (this.newPart.input === null || this.newPart.input <= 0) return false;
    if (!isFinite(this.sessionRemaining)) return false;
    return this.newPart.input > this.sessionRemaining;
  }

  get newPartValid(): boolean {
    const hasInput  = this.newPart.input  !== null && this.newPart.input  > 0;
    const hasOutput = this.newPart.output !== null && this.newPart.output > 0;
    if (!hasInput && !hasOutput) return false;
    if (this.newPartInputExceedsLimit) return false;
    return true;
  }

  get canComplete(): boolean {
    return !!this._log
      && !this._log.isCompleted
      && (this._log.parts?.length ?? 0) > 0
      && !this.newPartInputExceedsLimit;
  }

  get partEfficiency() {
    return (part: SievingPart): string => {
      if (!part.input || !part.output || part.input === 0) return '';
      return ((part.output / part.input) * 100).toFixed(1) + '%';
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Reconstructs remainingAtStart after a page reload.
   * Safe to call multiple times — exits immediately if already resolved.
   * Requires BOTH this._log and this.batches to be populated.
   *
   * The server's match.remainingStock at this point already excludes this log's
   * saved totalInput, so we add it back to restore the original session ceiling.
   */
  private resolveActiveBatch(): void {
    if (this.remainingAtStart !== null) return; // already set
    if (!this._log) return;                      // log not loaded yet
    if (!this.batches.length) return;            // batches not loaded yet

    const match = this.batches.find(b => b.batchNo === this._log!.batchNo);
    if (match) {
      this.activeBatch = match;
      this.remainingAtStart = match.remainingStock + this.totalInput;
    }
  }

  private checkAutoComplete(): void {
    if (!this._log || this._log.isCompleted) return;
    if (this.sessionRemaining <= 0 && this.totalInput > 0) {
      this.doComplete();
    }
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/portal/sifting-operator');
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-LK', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  formatTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-LK', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  }
}