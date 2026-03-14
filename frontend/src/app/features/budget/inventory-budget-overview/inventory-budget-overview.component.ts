// inventory-budget-overview.component.ts
import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../../core/services/inventory.service';
import { ExpenditureService } from '../../../core/services/expenditure.service';
import { BudgetEntryService } from '../../../core/services/budget-entry.service';
import { SaleService } from '../../../core/services/sale.service';
import { Expenditure } from '../../../core/models/expenditure';
import { BudgetEntry } from '../../../core/models/budget-entry';
import { Sale } from '../../../core/models/sale';
import { LkrCurrencyPipe } from '../../../shared/pipes/lkr-currency.pipe';
import { getExpenditureIcon } from '../../../core/utils/expenditure-icon.util';
import { HasCreditPipe } from '../../../shared/pipes/has-credit.pipe';

// ── Types ─────────────────────────────────────────────────────────
interface NormalisedItem {
  packTypeId: string; packName: string; weightKg: number;
  stockQty: number; threshold: number; unitCost: number; lastUpdatedAt: string;
}

interface LedgerRow {
  id: string;
  date: string;
  particulars: string;
  particularsDetail?: string;
  income: number;
  withdrawals: number;
  creditDue: number;
  balance: number;
  type: 'budget' | 'sale' | 'expenditure' | 'credit';
  color: string;
  iconPaths?: string[];
  originalId?: string;
  isEditable?: boolean;
}

interface ChartEntry {
  label: string; value: number; pct: number;
  color: string; iconPaths: string[]; iconColor: string;
}

interface ChartSlice extends ChartEntry { path: string; midAngle: number; }

interface BarSlice extends ChartEntry {
  shortName: string; x: number; y: number; w: number; h: number;
}

// ── Helpers ───────────────────────────────────────────────────────
function normalise(raw: any): NormalisedItem {
  return {
    packTypeId:    raw.packTypeId    ?? raw.pack_type_id  ?? '',
    packName:      raw.packName      ?? raw.pack_name     ?? '',
    weightKg:      raw.weightKg      ?? raw.weight_kg     ?? 0,
    stockQty:      raw.stockQty      ?? raw.stock_qty     ?? 0,
    threshold:     raw.threshold     ?? raw.threshold_qty ?? 0,
    unitCost:      raw.currentCost   ?? raw.unit_cost     ?? 0,
    lastUpdatedAt: raw.lastUpdatedAt ?? raw.last_updated_at ?? new Date().toISOString(),
  };
}

function arcPath(cx: number, cy: number, R: number, r: number,
  a0: number, a1: number): string {
  const lg = (a1 - a0) > Math.PI ? 1 : 0;
  const f = (n: number) => n.toFixed(3);
  const x1 = cx + R * Math.cos(a0), y1 = cy + R * Math.sin(a0);
  const x2 = cx + R * Math.cos(a1), y2 = cy + R * Math.sin(a1);
  if (r === 0) {
    return `M ${f(cx)} ${f(cy)} L ${f(x1)} ${f(y1)} A ${R} ${R} 0 ${lg} 1 ${f(x2)} ${f(y2)} Z`;
  }
  const ix1 = cx + r * Math.cos(a1), iy1 = cy + r * Math.sin(a1);
  const ix2 = cx + r * Math.cos(a0), iy2 = cy + r * Math.sin(a0);
  return `M ${f(x1)} ${f(y1)} A ${R} ${R} 0 ${lg} 1 ${f(x2)} ${f(y2)} ` +
    `L ${f(ix1)} ${f(iy1)} A ${r} ${r} 0 ${lg} 0 ${f(ix2)} ${f(iy2)} Z`;
}

const SALE_ICON_PATHS = [
  'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z',
  'M3 6h18', 'M16 10a4 4 0 0 1-8 0',
];
const BUDGET_ICON_PATHS = [
  'M12 2v20',
  'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
];

// ── Component ─────────────────────────────────────────────────────
@Component({
  selector: 'app-inventory-budget-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, LkrCurrencyPipe, DecimalPipe, HasCreditPipe],
  templateUrl: './inventory-budget-overview.component.html',
  styleUrl: './inventory-budget-overview.component.css',
})
export class InventoryBudgetOverviewComponent implements OnInit {

  private inventoryService   = inject(InventoryService);
  private expenditureService = inject(ExpenditureService);
  private budgetEntryService = inject(BudgetEntryService);
  private saleService        = inject(SaleService);

  // ── Signals ───────────────────────────────────────────────────────
  invItems      = signal<NormalisedItem[]>([]);
  expenditures  = signal<Expenditure[]>([]);
  budgetEntries = signal<BudgetEntry[]>([]);
  paidSales     = signal<Sale[]>([]);

  loading    = signal(true);
  saving     = signal(false);
  deleting   = signal<string | null>(null);
  successMsg = signal<string | null>(null);
  errorMsg   = signal<string | null>(null);

  // ── Form ──────────────────────────────────────────────────────────
  showForm   = false;
  formMode: 'budget' | 'expenditure' = 'expenditure';
  editingId: string | null = null;
  form       = { description: '', amount: null as number | null, date: '' };
  formError  = '';

  // ── Chart ─────────────────────────────────────────────────────────
  hoveredIncomeSlice: number | null = null;
  hoveredExpSlice:    number | null = null;
  expChartType: 'donut' | 'bar'    = 'donut';

  readonly expColors = [
    '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#10b981', '#f97316',
  ];

  get todayFormatted(): string {
    return new Date().toLocaleDateString('en-LK', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  }

  ngOnInit(): void { this.setTodayDate(); this.loadAll(); }

  // ── Load ──────────────────────────────────────────────────────────
  loadAll(): void {
    this.loading.set(true);
    let doneInv = false, doneBudget = false, doneExp = false, doneSales = false;
    const tryDone = () => {
      if (doneInv && doneBudget && doneExp && doneSales) this.loading.set(false);
    };

    this.inventoryService.getAll().subscribe({
      next: (res: any) => {
        const raw: any[] = Array.isArray(res) ? res : (res?.data ?? []);
        this.invItems.set(raw.map(normalise));
        doneInv = true; tryDone();
      },
      error: () => { doneInv = true; tryDone(); },
    });

    this.budgetEntryService.getAll().subscribe({
      next: res => { this.budgetEntries.set(res.data); doneBudget = true; tryDone(); },
      error: () => { doneBudget = true; tryDone(); },
    });

    this.expenditureService.getAll().subscribe({
      next: res => { this.expenditures.set(res.data); doneExp = true; tryDone(); },
      error: () => { doneExp = true; tryDone(); },
    });

    this.saleService.getSales({}, 0, 1000).subscribe({
      next: res => {
        const all: Sale[] = res?.data?.content ?? [];
        this.paidSales.set(
          all.filter(s =>
            s.status !== 'CANCELLED' &&
            (s.paymentStatus === 'PAID' ||
              (s.totalPaid ?? 0) > 0 ||
              s.paymentMethod === 'CREDIT')
          )
        );
        doneSales = true; tryDone();
      },
      error: () => { this.paidSales.set([]); doneSales = true; tryDone(); },
    });
  }

  // ── Form helpers ──────────────────────────────────────────────────
  private setTodayDate(): void {
    this.form.date = new Date().toISOString().split('T')[0];
  }

  openAddBudgetForm(): void {
    this.formMode = 'budget'; this.editingId = null;
    this.form = { description: '', amount: null, date: '' };
    this.formError = ''; this.setTodayDate(); this.showForm = true;
  }

  openEditBudgetForm(entry: BudgetEntry): void {
    this.formMode = 'budget'; this.editingId = entry._id;
    this.form = { description: entry.description, amount: entry.amount, date: entry.date.split('T')[0] };
    this.formError = ''; this.showForm = true;
  }

  openAddExpForm(): void {
    this.formMode = 'expenditure'; this.editingId = null;
    this.form = { description: '', amount: null, date: '' };
    this.formError = ''; this.setTodayDate(); this.showForm = true;
  }

  openEditExpForm(exp: Expenditure): void {
    this.formMode = 'expenditure'; this.editingId = exp._id;
    this.form = { description: exp.description, amount: exp.amount, date: exp.date.split('T')[0] };
    this.formError = ''; this.showForm = true;
  }

  openEditRowById(id: string, type: 'budget' | 'expenditure'): void {
    if (type === 'budget') {
      const e = this.budgetEntries().find(b => b._id === id);
      if (e) this.openEditBudgetForm(e);
    } else {
      const e = this.expenditures().find(x => x._id === id);
      if (e) this.openEditExpForm(e);
    }
  }

  cancelForm(): void { this.showForm = false; this.editingId = null; this.formError = ''; }

  saveForm(): void {
    if (!this.form.description?.trim()) { this.formError = 'Description is required.'; return; }
    if (!this.form.amount || this.form.amount <= 0) { this.formError = 'Amount must be > 0.'; return; }
    if (!this.form.date) { this.formError = 'Date is required.'; return; }

    this.formError = ''; this.saving.set(true);
    const isEdit = !!this.editingId;
    const dto = {
      description: this.form.description.trim(),
      amount: this.form.amount,
      date: new Date(this.form.date).toISOString(),
    };

    if (this.formMode === 'budget') {
      const req$ = isEdit
        ? this.budgetEntryService.update(this.editingId!, dto)
        : this.budgetEntryService.create(dto);
      req$.subscribe({
        next: () => {
          this.saving.set(false); this.showForm = false; this.editingId = null;
          this.showSuccess(isEdit ? 'Investment updated.' : 'Investment added.');
          this.budgetEntryService.getAll().subscribe(r => this.budgetEntries.set(r.data));
        },
        error: err => { this.saving.set(false); this.formError = err?.error?.message ?? 'Failed to save.'; },
      });
    } else {
      const req$ = isEdit
        ? this.expenditureService.update(this.editingId!, dto)
        : this.expenditureService.create(dto);
      req$.subscribe({
        next: () => {
          this.saving.set(false); this.showForm = false; this.editingId = null;
          this.showSuccess(isEdit ? 'Withdrawal updated.' : 'Withdrawal saved.');
          this.expenditureService.getAll().subscribe(r => this.expenditures.set(r.data));
        },
        error: err => { this.saving.set(false); this.formError = err?.error?.message ?? 'Failed to save.'; },
      });
    }
  }

  deleteBudgetEntry(id: string): void {
    if (!confirm('Remove this investment entry?')) return;
    this.deleting.set(id);
    this.budgetEntryService.delete(id).subscribe({
      next: () => {
        this.deleting.set(null);
        this.budgetEntries.set(this.budgetEntries().filter(e => e._id !== id));
        this.showSuccess('Investment removed.');
      },
      error: err => { this.deleting.set(null); this.showError(err?.error?.message ?? 'Failed.'); },
    });
  }

  deleteExpenditure(id: string): void {
    if (!confirm('Delete this withdrawal entry?')) return;
    this.deleting.set(id);
    this.expenditureService.delete(id).subscribe({
      next: () => {
        this.deleting.set(null);
        this.expenditures.set(this.expenditures().filter(e => e._id !== id));
        this.showSuccess('Entry deleted.');
      },
      error: err => { this.deleting.set(null); this.showError(err?.error?.message ?? 'Failed.'); },
    });
  }

  // ── Totals ────────────────────────────────────────────────────────
  get totalBudgetCapital(): number {
    return this.budgetEntries().reduce((s, e) => s + e.amount, 0);
  }

  private saleIncomeAmount(sale: Sale): number {
    const cost  = sale.totalCost;
    const rev   = sale.totalRevenue;
    const paid  = sale.totalPaid ?? 0;
    if (sale.paymentMethod !== 'CREDIT' || sale.paymentStatus === 'PAID') return cost;
    if (rev <= 0 || paid <= 0) return 0;
    return (paid / rev) * cost;
  }

  get totalSalesIncome(): number {
    return this.paidSales().reduce((s, sale) => s + this.saleIncomeAmount(sale), 0);
  }

  get totalExpSpent(): number {
    return this.expenditures().reduce((s, e) => s + e.amount, 0);
  }

  get totalIncome(): number   { return this.totalBudgetCapital + this.totalSalesIncome; }
  get balance(): number       { return this.totalIncome - this.totalExpSpent; }
  get spentPercent(): number  {
    return this.totalIncome > 0
      ? Math.min((this.totalExpSpent / this.totalIncome) * 100, 100) : 0;
  }

  get hasData(): boolean {
    return this.budgetEntries().length > 0
      || this.expenditures().length > 0
      || this.paidSales().length > 0;
  }

  // ── Ledger rows ───────────────────────────────────────────────────
  get ledgerRows(): LedgerRow[] {
    interface Sortable { dateMs: number; row: Omit<LedgerRow, 'balance'>; }
    const transactions: Sortable[] = [];
    let running = 0;
    const rows: LedgerRow[] = [];

    const CREDIT_ICON_PATHS = ['M1 4h22v16H1z', 'M1 10h22'];

    this.budgetEntries().forEach(entry => {
      transactions.push({
        dateMs: new Date(entry.date).getTime(),
        row: {
          id: `budget-${entry._id}`, date: entry.date,
          particulars: entry.description || 'Investment',
          particularsDetail: 'Capital investment',
          income: entry.amount, withdrawals: 0, creditDue: 0,
          type: 'budget', color: '#4f46e5',
          iconPaths: BUDGET_ICON_PATHS,
          originalId: entry._id, isEditable: true,
        },
      });
    });

    this.paidSales().forEach(sale => {
      const cashReceived = this.saleIncomeAmount(sale);
      const totalRev     = sale.totalRevenue;
      const totalPaid    = sale.totalPaid ?? 0;
      const isCredit     = sale.paymentMethod === 'CREDIT';
      const isUnpaid     = isCredit && sale.paymentStatus !== 'PAID' && totalRev > totalPaid;
      const creditDue    = isUnpaid ? totalRev - totalPaid : 0;

      if (cashReceived <= 0 && creditDue <= 0) return;

      const isPartial   = isCredit && sale.paymentStatus === 'PENDING' && totalPaid > 0;
      const itemSummary = sale.items?.length
        ? sale.items.map(i => `${i.qty}× ${i.packName}`).join(', ') : null;
      const detail = [
        sale.customerName || null,
        itemSummary,
        sale.paymentMethod?.replace(/_/g, ' ') ?? null,
        isPartial
          ? `Part paid ${this.fmtLkr(totalPaid)} of ${this.fmtLkr(totalRev)}`
          : isCredit && totalPaid === 0 ? `Unpaid — ${this.fmtLkr(totalRev)} outstanding` : null,
      ].filter(Boolean).join(' · ') || undefined;

      transactions.push({
        dateMs: new Date(sale.saleDatetime).getTime(),
        row: {
          id: `sale-${sale.saleId}`, date: sale.saleDatetime,
          particulars: `Sale #${sale.saleNo}${isPartial ? ' — partial' : isCredit && totalPaid === 0 ? ' — credit pending' : ''}`,
          particularsDetail: detail,
          income: cashReceived, withdrawals: 0, creditDue,
          type: isCredit && cashReceived === 0 ? 'credit' : 'sale',
          color: isCredit ? (totalPaid === 0 ? '#7c3aed' : '#d97706') : '#059669',
          iconPaths: isCredit ? CREDIT_ICON_PATHS : SALE_ICON_PATHS,
          isEditable: false,
        },
      });
    });

    this.expenditures().forEach((exp, i) => {
      const icon = getExpenditureIcon(exp.description);
      transactions.push({
        dateMs: new Date(exp.date).getTime(),
        row: {
          id: `exp-${exp._id}`, date: exp.date,
          particulars: exp.description,
          income: 0, withdrawals: exp.amount, creditDue: 0,
          type: 'expenditure',
          color: this.expColors[i % this.expColors.length],
          iconPaths: icon.paths,
          originalId: exp._id, isEditable: true,
        },
      });
    });

    transactions.sort((a, b) => a.dateMs - b.dateMs);
    for (const { row } of transactions) {
      running += row.income - row.withdrawals;
      rows.push({ ...row, balance: running });
    }
    return rows;
  }

  // ── Chart data ────────────────────────────────────────────────────
  get incomeChartEntries(): ChartEntry[] {
    const total = this.totalIncome || 1;
    const entries: ChartEntry[] = [];
    if (this.totalBudgetCapital > 0) entries.push({
      label: 'Capital Invested', value: this.totalBudgetCapital,
      pct: (this.totalBudgetCapital / total) * 100,
      color: '#4f46e5', iconPaths: BUDGET_ICON_PATHS, iconColor: '#4f46e5',
    });
    if (this.totalSalesIncome > 0) entries.push({
      label: 'Sales Income', value: this.totalSalesIncome,
      pct: (this.totalSalesIncome / total) * 100,
      color: '#059669', iconPaths: SALE_ICON_PATHS, iconColor: '#059669',
    });
    return entries;
  }

  get chartEntries(): ChartEntry[] {
    const total = this.totalExpSpent || 1;
    return this.expenditures().map((e, i) => {
      const icon = getExpenditureIcon(e.description);
      return {
        label: e.description, value: e.amount,
        pct: (e.amount / total) * 100,
        color: this.expColors[i % this.expColors.length],
        iconPaths: icon.paths,
        iconColor: this.expColors[i % this.expColors.length],
      };
    });
  }

  private buildDonut(entries: ChartEntry[]): ChartSlice[] {
    let a = -Math.PI / 2;
    return entries.map(e => {
      const sweep = Math.max((e.pct / 100) * 2 * Math.PI - 0.025, 0.001);
      const midAngle = a + sweep / 2;
      const path = arcPath(140, 140, 112, 68, a, a + sweep);
      a += (e.pct / 100) * 2 * Math.PI;
      return { ...e, path, midAngle };
    });
  }

  get incomeSlices(): ChartSlice[] { return this.buildDonut(this.incomeChartEntries); }
  get expSlices():    ChartSlice[] { return this.buildDonut(this.chartEntries); }

  get expBars(): BarSlice[] {
    const entries = this.chartEntries;
    if (!entries.length) return [];
    const maxV = Math.max(...entries.map(e => e.value)) || 1;
    const n = entries.length, W = 260, maxH = 140, baseY = 175;
    const barW = Math.min(38, (W / n) * 0.52), gap = W / n;
    return entries.map((e, i) => {
      const h = Math.max((e.value / maxV) * maxH, 4);
      const label = e.label.length > 11 ? e.label.slice(0, 11) + '…' : e.label;
      return { ...e, shortName: label, x: 20 + i * gap + (gap - barW) / 2, y: baseY - h, w: barW, h };
    });
  }

  // ── Credit receivables ────────────────────────────────────────────
  get pendingCreditSales(): Sale[] {
    return this.paidSales().filter(s =>
      s.paymentMethod === 'CREDIT' &&
      s.paymentStatus !== 'PAID' &&
      s.totalRevenue > (s.totalPaid ?? 0)
    );
  }

  get totalCreditPending(): number {
    return this.pendingCreditSales.reduce((sum, s) => {
      const due = s.totalRevenue - (s.totalPaid ?? 0);
      return sum + Math.max(due, 0);
    }, 0);
  }

  creditDaysAgo(sale: Sale): number {
    return Math.floor(
      (Date.now() - new Date(sale.saleDatetime).getTime()) / 86_400_000
    );
  }

  get oldestCreditDays(): number {
    if (!this.pendingCreditSales.length) return 0;
    return Math.max(...this.pendingCreditSales.map(s => this.creditDaysAgo(s)));
  }

  get creditPendingPercent(): number {
    const totalRev = this.paidSales().reduce((s, x) => s + x.totalRevenue, 0);
    return totalRev > 0 ? (this.totalCreditPending / totalRev) * 100 : 0;
  }

  // ── Util ──────────────────────────────────────────────────────────
  private showSuccess(msg: string): void {
    this.successMsg.set(msg); setTimeout(() => this.successMsg.set(null), 3500);
  }
  private showError(msg: string): void {
    this.errorMsg.set(msg); setTimeout(() => this.errorMsg.set(null), 4000);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-LK', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  private fmtLkr(v: number): string {
    return 'LKR ' + v.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  getIconForDesc = (desc: string) => getExpenditureIcon(desc);
}
