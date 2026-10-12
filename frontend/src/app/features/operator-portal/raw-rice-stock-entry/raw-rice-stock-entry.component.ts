import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { DailySheetService } from '../../../core/services/daily-sheet.service';
import { UserService, UserResponse } from '../../../core/services/user.service';
import {
  DailySheet, PackTypeStock, QtyLine, SaveSheetRequest,
} from '../../../core/models/daily-sheet';

interface BatchRow {
  key: string;
  batchNo: string;
  operatorId: string;
  partnerId: string;
  input: number | null;
  output: number | null;
}

interface SiftRow {
  key: string;
  batchNo: string;
  input: number | null;
  output: number | null;
  rejection: number | null;
  note: string;
}

type QtyMap = Record<string, number | null>;

const EPS = 0.001;

/**
 * Daily Production Sheet (replaces the old "Raw Rice Stock Entry" page, same route).
 * One screen per day: grinding batches, sifting, packing, empty bags, end-of-day count.
 */
@Component({
  selector: 'app-raw-rice-stock-entry',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './raw-rice-stock-entry.component.html',
  styleUrl: './raw-rice-stock-entry.component.css',
})
export class RawRiceStockEntryComponent implements OnInit {

  // ── Date ───────────────────────────────────────────────────────────────
  dateStr = this.localDateStr(new Date());
  readonly maxDateStr = this.localDateStr(new Date());

  // ── Status ─────────────────────────────────────────────────────────────
  loading = false;
  loadError = '';
  saving = false;
  sending = false;
  saveError = '';
  toast = '';
  warnings: string[] = [];

  // discard-changes dialog (used when the date is changed with unsaved edits)
  discardOpen = false;
  private pendingDate = '';
  private pendingEl: HTMLInputElement | null = null;

  // ── Data ───────────────────────────────────────────────────────────────
  sheet: DailySheet | null = null;
  users: UserResponse[] = [];

  rawRiceReceived: number | null = null;
  batches: BatchRow[] = [];
  sifting: SiftRow[] = [];
  packing: QtyMap = {};
  empty: QtyMap = {};
  endStock: QtyMap = {};

  // what is already applied to stock on the server (so we can show the effect of edits)
  private savedPacking: Record<string, number> = {};
  private savedEmpty: Record<string, number> = {};
  private snapshot = '';
  private seq = 0;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: DailySheetService,
    private userService: UserService,
  ) { }

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap.get('date');
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q) && q <= this.maxDateStr) this.dateStr = q;

    this.userService.getAllUsers().subscribe({
      next: users => (this.users = users.filter(u => u.role !== 'ADMIN')),
      error: () => (this.users = []),
    });
    this.loadSheet();
  }

  // ── Load / apply ───────────────────────────────────────────────────────
  loadSheet(): void {
    this.loading = true;
    this.loadError = '';
    this.api.get(this.dateStr).subscribe({
      next: s => { this.applySheet(s); this.loading = false; },
      error: e => { this.loadError = this.errMsg(e, 'Could not load this day'); this.loading = false; },
    });
  }

  private applySheet(s: DailySheet): void {
    this.sheet = s;
    this.rawRiceReceived = s.rawRiceReceived;

    this.batches = s.batches.map(b => ({
      key: this.k(), batchNo: b.batchNo,
      operatorId: b.operatorId ?? '', partnerId: b.partnerId ?? '',
      input: b.input, output: b.output,
    }));
    if (!this.batches.length) {
      this.batches = [this.blankBatch(s.defaultOperatorId ?? '', s.defaultPartnerId ?? '')];
    }

    this.sifting = s.sifting.map(r => ({ key: this.k(), ...r }));

    this.packing = this.toMap(s.packing);
    this.empty = this.toMap(s.emptyBagsReceived);
    this.endStock = this.toMap(s.endOfDayStock);
    this.savedPacking = this.toNumMap(s.packing);
    this.savedEmpty = this.toNumMap(s.emptyBagsReceived);

    this.warnings = s.warnings ?? [];
    this.snapshot = JSON.stringify(this.buildPayload());
  }

  private toMap(lines: QtyLine[]): QtyMap {
    const m: QtyMap = {};
    for (const l of lines) m[l.packTypeId] = l.qty;
    return m;
  }
  private toNumMap(lines: QtyLine[]): Record<string, number> {
    const m: Record<string, number> = {};
    for (const l of lines) m[l.packTypeId] = l.qty ?? 0;
    return m;
  }

  // ── Date handling ──────────────────────────────────────────────────────
  get dateLabel(): string {
    const [y, m, d] = this.dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-LK', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  onDateInput(el: HTMLInputElement): void {
    if (!el.value || el.value > this.maxDateStr) { el.value = this.dateStr; return; }
    this.requestDate(el.value, el);
  }

  shiftDay(delta: number): void {
    const [y, m, d] = this.dateStr.split('-').map(Number);
    const next = this.localDateStr(new Date(y, m - 1, d + delta));
    if (next > this.maxDateStr) return;
    this.requestDate(next, null);
  }

  private requestDate(next: string, el: HTMLInputElement | null): void {
    if (next === this.dateStr) return;
    if (this.isDirty()) {
      this.pendingDate = next;
      this.pendingEl = el;
      this.discardOpen = true;
      return;
    }
    this.switchDate(next);
  }

  confirmDiscard(): void {
    this.discardOpen = false;
    this.switchDate(this.pendingDate);
  }

  cancelDiscard(): void {
    this.discardOpen = false;
    if (this.pendingEl) this.pendingEl.value = this.dateStr; // put the picker back
  }

  private switchDate(next: string): void {
    this.dateStr = next;
    this.sheet = null;
    this.saveError = '';
    this.loadSheet();
  }

  goBack(): void {
    this.router.navigate(['/portal/machine-operator']);
  }

  // ── Dirty / validation ─────────────────────────────────────────────────
  isDirty(): boolean {
    return !!this.sheet && this.snapshot !== JSON.stringify(this.buildPayload());
  }

  get hasErrors(): boolean {
    return this.batches.some(b => !!this.batchError(b))
      || this.sifting.some(r => !!this.rowError(r));
  }

  get canSave(): boolean {
    return !!this.sheet && !this.hasErrors && !this.saving && !this.sending;
  }

  // ── Grinding ───────────────────────────────────────────────────────────
  private blankBatch(op = '', partner = ''): BatchRow {
    return {
      key: this.k(), batchNo: this.nextBatchNo(), operatorId: op, partnerId: partner,
      input: null, output: null,
    };
  }

  /** GR + month + day (GR0930); a second batch the same day is GR0930-2, and so on */
  private nextBatchNo(): string {
    const mmdd = this.dateStr.slice(5, 7) + this.dateStr.slice(8, 10);
    const used = new Set(this.batches.map(b => b.batchNo));
    const make = (n: number) => (n === 1 ? `GR${mmdd}` : `GR${mmdd}-${n}`);
    let n = 1;
    while (used.has(make(n))) n++;
    return make(n);
  }

  addBatch(): void {
    const last = this.batches[this.batches.length - 1];
    this.batches = [...this.batches, this.blankBatch(last?.operatorId ?? '', last?.partnerId ?? '')];
  }

  canRemoveBatch(b: BatchRow): boolean {
    return this.batches.length > 1 && !this.sifting.some(r => r.batchNo === b.batchNo);
  }

  removeBatch(b: BatchRow): void {
    if (!this.canRemoveBatch(b)) return;
    this.batches = this.batches.filter(x => x.key !== b.key);
  }

  batchError(b: BatchRow): string {
    if (b.input !== null && b.output !== null && b.output > b.input + EPS) {
      return 'Output cannot be more than input.';
    }
    return '';
  }

  efficiency(input: number | null, output: number | null): string {
    if (!input || output === null || output === undefined) return '';
    return ((output / input) * 100).toFixed(1) + '%';
  }

  // ── Sifting ────────────────────────────────────────────────────────────
  /** kg of flour that came out of the mill for this batch (the ceiling for sifting) */
  ceiling(batchNo: string): number | null {
    const b = this.batches.find(x => x.batchNo === batchNo);
    if (!b) return null;
    return b.output ?? b.input ?? null;
  }

  siftedInput(batchNo: string): number {
    return this.sifting.filter(r => r.batchNo === batchNo).reduce((s, r) => s + (r.input ?? 0), 0);
  }

  remaining(batchNo: string): number | null {
    const c = this.ceiling(batchNo);
    return c === null ? null : Math.max(0, c - this.siftedInput(batchNo));
  }

  /** batches that have quantities, i.e. can be sifted */
  get siftableBatches(): BatchRow[] {
    return this.batches.filter(b => b.input !== null || b.output !== null);
  }

  batchOptionLabel(b: BatchRow): string {
    const left = this.remaining(b.batchNo);
    return left === null ? b.batchNo : `${b.batchNo} · ${this.n(left)} kg left`;
  }

  addSift(): void {
    const list = this.siftableBatches;
    if (!list.length) return;
    // default to the batch with the most flour still to sift
    const best = [...list].sort((a, b) => (this.remaining(b.batchNo) ?? 0) - (this.remaining(a.batchNo) ?? 0))[0];
    this.sifting = [...this.sifting, {
      key: this.k(), batchNo: best.batchNo, input: null, output: null, rejection: null, note: '',
    }];
  }

  removeSift(r: SiftRow): void {
    this.sifting = this.sifting.filter(x => x.key !== r.key);
  }

  private isBlankSift(r: SiftRow): boolean {
    return r.input === null && r.output === null && r.rejection === null && !r.note.trim();
  }

  rowError(r: SiftRow): string {
    if (this.isBlankSift(r)) return '';
    if (!r.batchNo || !this.batches.some(b => b.batchNo === r.batchNo)) return 'Choose a batch.';
    if ((r.output ?? 0) + (r.rejection ?? 0) > (r.input ?? 0) + EPS) {
      return 'Output + rejection is more than the input.';
    }
    const c = this.ceiling(r.batchNo);
    if (c !== null && this.siftedInput(r.batchNo) > c + EPS) {
      return `${r.batchNo}: sifted input is more than the grind output (${this.n(c)} kg).`;
    }
    return '';
  }

  // ── Packing / bags / end-of-day ────────────────────────────────────────
  get packTypes(): PackTypeStock[] { return this.sheet?.packTypes ?? []; }

  private q(map: QtyMap, id: string): number { return Number(map[id]) || 0; }

  /** packed rice in stock after the pending (unsaved) packing change is applied */
  projectedRice(pt: PackTypeStock): number {
    return pt.riceStock + (this.q(this.packing, pt.packTypeId) - (this.savedPacking[pt.packTypeId] ?? 0));
  }

  /** empty bags in stock after the pending received/packing changes are applied */
  projectedEmpty(pt: PackTypeStock): number {
    const received = this.q(this.empty, pt.packTypeId) - (this.savedEmpty[pt.packTypeId] ?? 0);
    const used = this.q(this.packing, pt.packTypeId) - (this.savedPacking[pt.packTypeId] ?? 0);
    return pt.emptyBagStock + received - used;
  }

  /** counted minus system, or null when that size has not been counted */
  countDiff(pt: PackTypeStock): number | null {
    const c = this.endStock[pt.packTypeId];
    if (c === null || c === undefined || (c as unknown) === '') return null;
    return Number(c) - this.projectedRice(pt);
  }

  sum(map: QtyMap): number {
    return Object.values(map).reduce<number>((s, v) => s + (Number(v) || 0), 0);
  }

  get countedSizes(): number {
    return Object.values(this.endStock).filter(v => v !== null && v !== undefined && (v as unknown) !== '').length;
  }

  get diffCount(): number {
    return this.packTypes.filter(p => { const d = this.countDiff(p); return d !== null && d !== 0; }).length;
  }

  // ── Totals ─────────────────────────────────────────────────────────────
  get grindIn(): number { return this.batches.reduce((s, b) => s + (b.input ?? 0), 0); }
  get grindOut(): number { return this.batches.reduce((s, b) => s + (b.output ?? 0), 0); }
  get siftIn(): number { return this.sifting.reduce((s, r) => s + (r.input ?? 0), 0); }
  get siftOut(): number { return this.sifting.reduce((s, r) => s + (r.output ?? 0), 0); }
  get siftRej(): number { return this.sifting.reduce((s, r) => s + (r.rejection ?? 0), 0); }

  // ── Save / send ────────────────────────────────────────────────────────
  private buildPayload(): SaveSheetRequest {
    return {
      rawRiceReceived: this.num(this.rawRiceReceived),
      batches: this.batches.map(b => ({
        batchNo: b.batchNo,
        operatorId: b.operatorId || null,
        partnerId: b.partnerId || null,
        input: this.num(b.input),
        output: this.num(b.output),
      })),
      sifting: this.sifting.filter(r => !this.isBlankSift(r)).map(r => ({
        batchNo: r.batchNo, input: this.num(r.input), output: this.num(r.output),
        rejection: this.num(r.rejection), note: r.note.trim(),
      })),
      packing: this.lines(this.packing),
      emptyBagsReceived: this.lines(this.empty),
      endOfDayStock: this.lines(this.endStock),
    };
  }

  /** blank = not entered (omitted); the server drops 0 for packing / bags but keeps a counted 0 */
  private lines(map: QtyMap): QtyLine[] {
    return Object.entries(map)
      .filter(([, v]) => v !== null && v !== undefined && (v as unknown) !== '')
      .map(([packTypeId, v]) => ({ packTypeId, qty: Number(v) }));
  }

  private num(v: number | null | undefined): number | null {
    return v === null || v === undefined || (v as unknown) === '' || isNaN(Number(v)) ? null : Number(v);
  }

  /** Saves the sheet. If an end-of-day count is entered and its WhatsApp summary has not gone out yet, it is sent automatically. */
  save(): void {
    if (!this.canSave) return;
    this.saving = true;
    this.saveError = '';
    this.api.save(this.dateStr, this.buildPayload()).subscribe({
      next: s => {
        this.applySheet(s);
        this.saving = false;
        if (this.needsSend) this.send(); else this.flash('Sheet saved');
      },
      error: e => { this.saving = false; this.saveError = this.errMsg(e, 'Could not save'); },
    });
  }

  /** end-of-day count entered and not yet sent (or changed since it was sent) */
  get needsSend(): boolean {
    return this.countedSizes > 0 && this.sentState !== 'current';
  }

  private send(): void {
    this.sending = true;
    this.api.sendSummary(this.dateStr).subscribe({
      next: r => {
        this.sending = false;
        if (this.sheet) this.sheet = { ...this.sheet, endStockSentAt: r.endStockSentAt };
        this.flash('Sheet saved and WhatsApp summary sent');
      },
      error: e => {
        this.sending = false;
        this.saveError = 'Sheet saved, but WhatsApp was not sent: ' + this.errMsg(e, 'unknown error');
      },
    });
  }

  get sentState(): 'never' | 'current' | 'stale' {
    const s = this.sheet;
    if (!s?.endStockSentAt) return 'never';
    return s.endStockSavedAt && s.endStockSavedAt > s.endStockSentAt ? 'stale' : 'current';
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  n(v: number | null | undefined): string {
    if (v === null || v === undefined) return '0';
    return Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-LK', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
    });
  }

  private flash(msg: string): void {
    this.toast = msg;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = ''), 4000);
  }

  private errMsg(e: unknown, fallback: string): string {
    const err = e as { error?: { message?: string }; message?: string };
    return err?.error?.message || err?.message || fallback;
  }

  private k(): string { return 'r' + (++this.seq); }

  private localDateStr(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
}