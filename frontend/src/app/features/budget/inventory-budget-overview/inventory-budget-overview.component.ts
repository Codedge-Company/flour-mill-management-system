// inventory-budget-overview.component.ts
import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../../core/services/inventory.service';
import { ExpenditureService } from '../../../core/services/expenditure.service';
import { BudgetService } from '../../../core/services/budget.service';
import { Expenditure } from '../../../core/models/expenditure';
import { LkrCurrencyPipe } from '../../../shared/pipes/lkr-currency.pipe';
import { getExpenditureIcon } from '../../../core/utils/expenditure-icon.util';

// ── Types ─────────────────────────────────────────────────────────
interface NormalisedItem {
  packTypeId: string; packName: string; weightKg: number;
  stockQty: number; threshold: number; unitCost: number;
}
interface ChartEntry {
  label: string; value: number; pct: number; color: string;
  iconPaths: string[]; iconColor: string;
}
interface ChartSlice extends ChartEntry { path: string; midAngle: number; }
interface FloatingIcon {
  x: number; y: number;
  lx1: number; ly1: number; lx2: number; ly2: number;
  paths: string[]; color: string; pct: number; label: string;
}
interface BarSlice extends ChartEntry {
  shortName: string; x: number; y: number; w: number; h: number;
}
interface PieLabel { label: string; x: number; y: number; pct: number; }

// ── Helpers ───────────────────────────────────────────────────────
function normalise(raw: any): NormalisedItem {
  return {
    packTypeId: raw.packTypeId ?? raw.pack_type_id ?? '',
    packName:   raw.packName  ?? raw.pack_name    ?? '',
    weightKg:   raw.weightKg  ?? raw.weight_kg    ?? 0,
    stockQty:   raw.stockQty  ?? raw.stock_qty    ?? 0,
    threshold:  raw.threshold ?? raw.threshold_qty ?? 0,
    unitCost:   raw.currentCost ?? raw.unit_cost  ?? 0,
  };
}

function arcPath(cx: number, cy: number, R: number, r: number,
  a0: number, a1: number): string {
  const lg = (a1 - a0) > Math.PI ? 1 : 0;
  const fmt = (n: number) => n.toFixed(3);
  const x1 = cx + R * Math.cos(a0), y1 = cy + R * Math.sin(a0);
  const x2 = cx + R * Math.cos(a1), y2 = cy + R * Math.sin(a1);
  if (r === 0) {
    return `M ${fmt(cx)} ${fmt(cy)} L ${fmt(x1)} ${fmt(y1)} A ${R} ${R} 0 ${lg} 1 ${fmt(x2)} ${fmt(y2)} Z`;
  }
  const ix1 = cx + r * Math.cos(a1), iy1 = cy + r * Math.sin(a1);
  const ix2 = cx + r * Math.cos(a0), iy2 = cy + r * Math.sin(a0);
  return `M ${fmt(x1)} ${fmt(y1)} A ${R} ${R} 0 ${lg} 1 ${fmt(x2)} ${fmt(y2)} ` +
    `L ${fmt(ix1)} ${fmt(iy1)} A ${r} ${r} 0 ${lg} 0 ${fmt(ix2)} ${fmt(iy2)} Z`;
}

const INV_ICON_PATHS = [
  'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
  'M3.27 6.96L12 12.01l8.73-5.05',
  'M12 22.08V12',
];

// ── Component ─────────────────────────────────────────────────────
@Component({
  selector: 'app-inventory-budget-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, LkrCurrencyPipe, DecimalPipe],
  templateUrl: './inventory-budget-overview.component.html',
  styleUrl: './inventory-budget-overview.component.css',
})
export class InventoryBudgetOverviewComponent implements OnInit {

  private inventoryService  = inject(InventoryService);
  private expenditureService = inject(ExpenditureService);
  private budgetService     = inject(BudgetService);

  // ── Signals ───────────────────────────────────────────────────────────────
  invItems     = signal<NormalisedItem[]>([]);
  expenditures = signal<Expenditure[]>([]);

  /** Budget amount loaded from / saved to the database */
  totalBudget  = signal<number>(0);
  budgetLabel  = signal<string>('');

  loading      = signal(true);
  savingBudget = signal(false);
  saving       = signal(false);
  deleting     = signal<string | null>(null);
  successMsg   = signal<string | null>(null);
  errorMsg     = signal<string | null>(null);

  // Budget input (local copy while user is editing — committed on blur/save)
  budgetInputValue = 0;
  budgetChanged    = false;

  hoveredSlice: number | null = null;
  chartType: 'pie' | 'donut' | 'bar' = 'donut';

  showForm  = false;
  editingId: string | null = null;
  form = { description: '', amount: null as number | null, date: '' };
  formError = '';

  readonly invColor  = '#3b82f6';
  readonly expColors = [
    '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316',
  ];

  ngOnInit(): void {
    this.setTodayDate();
    this.loadAll();
  }

  // ── Load all data ─────────────────────────────────────────────────────────
  loadAll(): void {
    this.loading.set(true);
    let inv = false, expAndBudget = false;
    const done = () => { if (inv && expAndBudget) this.loading.set(false); };

    // Load inventory
    this.inventoryService.getAll().subscribe({
      next: (res: any) => {
        const raw: any[] = Array.isArray(res) ? res : (res?.data ?? []);
        this.invItems.set(raw.map(normalise));
        inv = true; done();
      },
      error: () => { inv = true; done(); },
    });

    // Load budget summary (includes expenditures + computed totals from DB)
    this.budgetService.getSummary().subscribe({
      next: (data) => {
        // Set budget from DB
        this.totalBudget.set(data.budget.amount);
        this.budgetLabel.set(data.budget.label ?? '');
        this.budgetInputValue = data.budget.amount;

        // Use expenditures from the same response (avoids extra HTTP call)
        this.expenditures.set(data.expenditures as any);

        expAndBudget = true; done();
      },
      error: () => {
        // Fallback: load expenditures separately if budget API fails
        this.reloadExpenditures();
        expAndBudget = true; done();
      },
    });
  }

  private reloadExpenditures(): void {
    this.expenditureService.getAll().subscribe({
      next: res => this.expenditures.set(res.data),
    });
  }

  // ── Budget persistence ────────────────────────────────────────────────────
  onBudgetInput(event: Event): void {
    const val = parseFloat((event.target as HTMLInputElement).value);
    if (!isNaN(val) && val >= 0) {
      this.budgetInputValue = val;
      this.budgetChanged = true;
    }
  }

  /** Called when user leaves the budget input field — auto-save to DB */
  onBudgetBlur(): void {
    if (this.budgetChanged) {
      this.saveBudgetToDb();
    }
  }

  /** Called when user presses Enter in the budget input */
  onBudgetKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      (event.target as HTMLInputElement).blur();
    }
  }

  saveBudgetToDb(): void {
    if (this.savingBudget()) return;
    this.savingBudget.set(true);
    this.budgetChanged = false;

    this.budgetService.update(this.budgetInputValue, this.budgetLabel()).subscribe({
      next: (saved) => {
        this.totalBudget.set(saved.amount);
        this.budgetInputValue = saved.amount;
        this.savingBudget.set(false);
        this.showSuccess('Budget saved.');
      },
      error: (err) => {
        this.savingBudget.set(false);
        this.showError(err?.error?.message ?? 'Failed to save budget.');
      },
    });
  }

  // ── Expenditure form ──────────────────────────────────────────────────────
  private setTodayDate(): void { this.form.date = new Date().toISOString().split('T')[0]; }

  openAddForm(): void {
    this.editingId = null;
    this.form = { description: '', amount: null, date: '' };
    this.formError = ''; this.setTodayDate(); this.showForm = true;
  }

  openEditForm(exp: Expenditure): void {
    this.editingId = exp._id;
    this.form = { description: exp.description, amount: exp.amount, date: exp.date.split('T')[0] };
    this.formError = ''; this.showForm = true;
  }

  cancelForm(): void { this.showForm = false; this.editingId = null; this.formError = ''; }

  saveExpenditure(): void {
    if (!this.form.description?.trim()) { this.formError = 'Description is required.'; return; }
    if (!this.form.amount || this.form.amount <= 0) { this.formError = 'Amount must be > 0.'; return; }
    if (!this.form.date) { this.formError = 'Date is required.'; return; }

    this.formError = ''; this.saving.set(true);
    const isEdit = !!this.editingId;
    const dto = {
      description: this.form.description.trim(),
      amount:      this.form.amount,
      date:        new Date(this.form.date).toISOString(),
    };
    const req$ = isEdit
      ? this.expenditureService.update(this.editingId!, dto)
      : this.expenditureService.create(dto);

    req$.subscribe({
      next: () => {
        this.saving.set(false); this.showForm = false; this.editingId = null;
        this.showSuccess(isEdit ? 'Expenditure updated.' : 'Expenditure saved.');
        this.reloadExpenditures();
      },
      error: err => {
        this.saving.set(false);
        this.formError = err?.error?.message ?? 'Failed to save.';
      },
    });
  }

  deleteExpenditure(id: string): void {
    if (!confirm('Delete this expenditure?')) return;
    this.deleting.set(id);
    this.expenditureService.delete(id).subscribe({
      next: () => {
        this.deleting.set(null);
        this.expenditures.set(this.expenditures().filter(e => e._id !== id));
        this.showSuccess('Deleted.');
      },
      error: err => {
        this.deleting.set(null);
        this.showError(err?.error?.message ?? 'Failed to delete.');
      },
    });
  }

  // ── Computed ──────────────────────────────────────────────────────────────
  get invCosts(): number[] { return this.invItems().map(i => i.stockQty * i.unitCost); }
  get totalInvSpent(): number { return this.invCosts.reduce((s, c) => s + c, 0); }
  get totalExpSpent(): number { return this.expenditures().reduce((s, e) => s + e.amount, 0); }
  get totalSpent(): number   { return this.totalInvSpent + this.totalExpSpent; }

  /** Balance = budget from DB − all expenditures */
  get balance(): number { return this.totalBudget() - this.totalSpent; }

  get hasData(): boolean { return this.invItems().length > 0 || this.expenditures().length > 0; }
  get spentPercent(): number {
    const b = this.totalBudget();
    return b > 0 ? Math.min((this.totalSpent / b) * 100, 100) : 0;
  }

  // ── Chart entries ─────────────────────────────────────────────────────────
  get chartEntries(): ChartEntry[] {
    const total = this.totalSpent || 1;
    const entries: ChartEntry[] = [];

    if (this.totalInvSpent > 0) {
      entries.push({
        label: 'Inventory', value: this.totalInvSpent,
        pct: (this.totalInvSpent / total) * 100,
        color: this.invColor, iconPaths: INV_ICON_PATHS, iconColor: this.invColor,
      });
    }

    this.expenditures().forEach((e, i) => {
      const icon = getExpenditureIcon(e.description);
      entries.push({
        label: e.description, value: e.amount,
        pct: (e.amount / total) * 100,
        color: this.expColors[i % this.expColors.length],
        iconPaths: icon.paths, iconColor: this.expColors[i % this.expColors.length],
      });
    });

    return entries;
  }

  // ── Donut ─────────────────────────────────────────────────────────────────
  private readonly CX = 250; private readonly CY = 250;
  private readonly DR = 130; private readonly Dr = 78;

  get donutSlices(): ChartSlice[] {
    const cx = this.CX, cy = this.CY, R = this.DR, r = this.Dr;
    let angle = -Math.PI / 2;
    return this.chartEntries.map(e => {
      const sweep = Math.max((e.pct / 100) * 2 * Math.PI - 0.025, 0.001);
      const midAngle = angle + sweep / 2;
      const path = arcPath(cx, cy, R, r, angle, angle + sweep);
      angle += (e.pct / 100) * 2 * Math.PI;
      return { ...e, path, midAngle };
    });
  }

  get floatingIcons(): FloatingIcon[] {
    const cx = this.CX, cy = this.CY, R = this.DR;
    const ICON_DIST = 220, BUBBLE_R = 22, MIN_GAP_RAD = 0.44;
    const slices = this.donutSlices;
    const rawAngles = slices.map(s => s.midAngle);
    const adjusted = [...rawAngles];

    for (let pass = 0; pass < 10; pass++) {
      for (let i = 0; i < adjusted.length; i++) {
        for (let j = i + 1; j < adjusted.length; j++) {
          let diff = adjusted[j] - adjusted[i];
          while (diff > Math.PI) diff -= 2 * Math.PI;
          while (diff < -Math.PI) diff += 2 * Math.PI;
          if (Math.abs(diff) < MIN_GAP_RAD) {
            const push = (MIN_GAP_RAD - Math.abs(diff)) / 2;
            adjusted[i] -= push * Math.sign(diff);
            adjusted[j] += push * Math.sign(diff);
          }
        }
      }
    }

    return slices.map((s, i) => {
      const a = adjusted[i], raw = rawAngles[i];
      return {
        x: cx + ICON_DIST * Math.cos(a),
        y: cy + ICON_DIST * Math.sin(a),
        lx1: cx + (R + 5) * Math.cos(raw),
        ly1: cy + (R + 5) * Math.sin(raw),
        lx2: cx + (ICON_DIST - BUBBLE_R - 3) * Math.cos(a),
        ly2: cy + (ICON_DIST - BUBBLE_R - 3) * Math.sin(a),
        paths: s.iconPaths, color: s.iconColor, pct: s.pct, label: s.label,
      };
    });
  }

  // ── Pie ───────────────────────────────────────────────────────────────────
  get pieSlices(): ChartSlice[] {
    let angle = -Math.PI / 2;
    return this.chartEntries.map(e => {
      const sweep = Math.max((e.pct / 100) * 2 * Math.PI - 0.02, 0.001);
      const midAngle = angle + sweep / 2;
      const path = arcPath(150, 150, 130, 0, angle, angle + sweep);
      angle += (e.pct / 100) * 2 * Math.PI;
      return { ...e, path, midAngle };
    });
  }

  get pieLabels(): PieLabel[] {
    let angle = -Math.PI / 2;
    return this.chartEntries.map(e => {
      const mid = angle + (e.pct / 100) * Math.PI;
      const lbl = { label: e.label, x: 150 + 90 * Math.cos(mid), y: 150 + 90 * Math.sin(mid), pct: e.pct };
      angle += (e.pct / 100) * 2 * Math.PI;
      return lbl;
    });
  }

  // ── Bar ───────────────────────────────────────────────────────────────────
  get barSlices(): BarSlice[] {
    const entries = this.chartEntries;
    if (!entries.length) return [];
    const maxV = Math.max(...entries.map(e => e.value)) || 1;
    const n = entries.length, chartW = 266, maxH = 190, baseY = 225;
    const barW = Math.min(48, (chartW / n) * 0.55), gap = chartW / n;
    return entries.map((e, i) => {
      const h = Math.max((e.value / maxV) * maxH, 4);
      return { ...e, shortName: e.label.split(' ')[0], x: 24 + i * gap + (gap - barW) / 2, y: baseY - h, w: barW, h };
    });
  }

  // ── Inventory rows ────────────────────────────────────────────────────────
  get invBreakdownRows() {
    const c = this.invCosts, total = this.totalSpent || 1;
    return this.invItems().map((item, i) => ({
      ...item, cost: c[i], sharePct: (c[i] / total) * 100,
    }));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private showSuccess(msg: string): void {
    this.successMsg.set(msg); setTimeout(() => this.successMsg.set(null), 3500);
  }
  private showError(msg: string): void {
    this.errorMsg.set(msg); setTimeout(() => this.errorMsg.set(null), 4000);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  getIconForDesc = (desc: string) => getExpenditureIcon(desc);
}