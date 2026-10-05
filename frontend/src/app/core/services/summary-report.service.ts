import { Injectable } from '@angular/core';
import { firstValueFrom, forkJoin, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { SaleService } from './sale.service';
import { PaymentApiService } from './payment-api.service';
import { FlowMoneyService } from './flow-money.service';
import { ExpenditureService } from './expenditure.service';
import { BudgetEntryService } from './budget-entry.service';
import { MachineLogService, MachineLog } from './machine-log.service';
import { SievingLogService, SievingLog } from './sieving-log.service';
import { InventoryService } from './inventory.service';
import { AuthService } from './auth.service';
import { Sale, SaleFilters } from '../models/sale';
import { InventoryItem } from '../models/inventory';
import { DateRange } from '../models/dashboard';

type RGB = [number, number, number];

const INK: RGB = [20, 24, 36];
const INK_SOFT: RGB = [51, 65, 85];
const GRAY: RGB = [100, 116, 139];
const LINE: RGB = [226, 232, 240];
const NAVY: RGB = [30, 41, 59];
const BLUE: RGB = [37, 99, 235];
const GREEN: RGB = [22, 163, 74];
const AMBER: RGB = [217, 119, 6];
const RED: RGB = [185, 28, 28];
const VIOLET: RGB = [124, 58, 237];
const TEAL: RGB = [13, 148, 136];
const SLATE_BG: RGB = [248, 250, 252];

const TZ = 'Asia/Colombo';
const COMPANY = {
  name: 'Matheesha Flour Mill',
  address: 'North Central Province, Sri Lanka',
  email: 'matheeshaflourmill@gmail.com',
  phone1: '+94-779337369',
  phone2: '+94-729997369',
};

interface ReportData {
  sales: Sale[];
  payments: any[];
  capitals: any[];
  expenditures: any[];
  budgetEntries: any[];
  machineLogs: MachineLog[];
  siftingLogs: SievingLog[];
  inventory: InventoryItem[];
  missing: string[];
}

interface Bucket { label: string; sort: string; count: number; revenue: number; cost: number; profit: number; }

@Injectable({ providedIn: 'root' })
export class SummaryReportService {

  constructor(
    private saleSvc: SaleService,
    private paymentApi: PaymentApiService,
    private flowSvc: FlowMoneyService,
    private expSvc: ExpenditureService,
    private budgetSvc: BudgetEntryService,
    private machineSvc: MachineLogService,
    private sievingSvc: SievingLogService,
    private inventorySvc: InventoryService,
    private auth: AuthService,
  ) { }

  // ════════════════════════════════════════════════════════════════════════
  // PUBLIC
  // ════════════════════════════════════════════════════════════════════════
  async generate(range: DateRange): Promise<void> {
    const data = await this.fetchData(range);
    const logo = await this.loadLogo();
    const user: any = this.auth.currentUser();
    const preparedBy = ((user?.fullName ?? user?.full_name ?? user?.username ?? '') as string).trim() || '-';
    const isAdmin = this.auth.isAdmin();

    const doc = this.buildPdf(data, range, isAdmin, preparedBy, logo);

    const from = range.dateFrom || null;
    const to = range.dateTo || null;
    const name = !from && !to ? 'All-Time' : `${from ?? 'start'}_to_${to ?? 'today'}`;
    doc.save(`Business-Summary_${name}.pdf`);
  }

  // ════════════════════════════════════════════════════════════════════════
  // DATA
  // ════════════════════════════════════════════════════════════════════════
  private ymd(iso: any): string {
    return iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ }) : '';
  }

  private async fetchData(range: DateRange): Promise<ReportData> {
    const from = range.dateFrom || undefined;
    const to = range.dateTo || undefined;
    const missing: string[] = [];

    const safe = <T>(obs: Observable<T>, fallback: T, name: string): Observable<T> =>
      obs.pipe(catchError(() => { missing.push(name); return of(fallback); }));

    const within = (iso: any): boolean => {
      const d = this.ymd(iso);
      if (!d) return false;
      return (!from || d >= from) && (!to || d <= to);
    };

    const filters: SaleFilters = { status: 'SAVED' };
    if (from) filters.dateFrom = from;
    if (to) filters.dateTo = to;

    const r = await firstValueFrom(forkJoin({
      // Sales are essential - if this fails the whole report fails (handled by the caller)
      sales: this.saleSvc.getSales(filters, 0, 10000).pipe(map(res => res.data.content as Sale[])),
      payments: safe(this.paymentApi.getPaymentsInRange(from, to), [] as any[], 'Payments'),
      capitals: safe(this.flowSvc.getCapitals().pipe(map(res => (res.data ?? []) as any[])), [] as any[], 'Capital'),
      expenditures: safe(this.expSvc.getAll().pipe(map(res => (res.data ?? []) as any[])), [] as any[], 'Expenditures'),
      budgetEntries: safe(this.budgetSvc.getAll().pipe(map(res => (res.data ?? []) as any[])), [] as any[], 'Budget entries'),
      machineLogs: safe(this.machineSvc.getAllLogs({ from, to, limit: 1000 }).pipe(map(res => res.logs)), [] as MachineLog[], 'Milling logs'),
      siftingLogs: safe(this.sievingSvc.getAllLogs({ from, to, limit: 1000 }), [] as SievingLog[], 'Sifting logs'),
      inventory: safe(this.inventorySvc.getAll().pipe(map(res => res.data)), [] as InventoryItem[], 'Inventory'),
    }));

    return {
      sales: r.sales,
      payments: r.payments,
      capitals: r.capitals.filter(c => within(c.capital_date ?? c.date ?? c.createdAt)),
      // NOTE: expenditure field names are mapped defensively - adjust here if your model differs
      expenditures: r.expenditures.filter(e => within(e.date ?? e.expenditure_date ?? e.expenditureDate ?? e.createdAt)),
      budgetEntries: r.budgetEntries.filter(b => within(b.date)),
      machineLogs: r.machineLogs,
      siftingLogs: r.siftingLogs,
      inventory: r.inventory,
      missing,
    };
  }

  private async loadLogo(): Promise<string | null> {
    try {
      const res = await fetch('/assets/icons/flour-mill.png');
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as string);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // FORMAT HELPERS
  // ════════════════════════════════════════════════════════════════════════
  private fmt(n: number): string {
    return Number(n ?? 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  private num(n: number): string {
    return Number(n ?? 0).toLocaleString('en-LK', { maximumFractionDigits: 2 });
  }
  private money(n: number): string { return `LKR ${this.fmt(n)}`; }
  private compact(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
    return n.toFixed(0);
  }
  private dateStr(iso: any): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ });
  }
  private ymdLabel(ymd: string): string {
    return new Date(`${ymd}T00:00:00+05:30`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ });
  }

  // ════════════════════════════════════════════════════════════════════════
  // PDF
  // ════════════════════════════════════════════════════════════════════════
  private buildPdf(d: ReportData, range: DateRange, isAdmin: boolean, preparedBy: string, logo: string | null): jsPDF {
    const doc = new jsPDF('p', 'pt', 'a4');
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const mL = 40, mR = 40, rEdge = W - mR, cw = rEdge - mL;
    const TOP = 104, BOTTOM = 56;
    let y = TOP;
    let secNo = 0;

    // ── tiny drawing helpers ────────────────────────────────────────────────
    const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
    const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
    const font = (style: 'normal' | 'bold', size: number, c: RGB) => {
      doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(c[0], c[1], c[2]);
    };
    const ensure = (need: number) => { if (y + need > H - BOTTOM) { doc.addPage(); y = TOP; } };
    const note = (t: string) => { ensure(26); font('normal', 9, GRAY); doc.text(t, mL + 4, y + 10); y += 24; };
    const subhead = (t: string) => { ensure(48); font('bold', 9.5, NAVY); doc.text(t, mL, y + 8); y += 14; };

    const section = (title: string, sub?: string) => {
      secNo++;
      ensure(78);
      fill(BLUE); doc.rect(mL, y, 4, 18, 'F');
      font('bold', 12.5, INK); doc.text(`${secNo}. ${title}`, mL + 12, y + 13);
      if (sub) { font('normal', 8.5, GRAY); doc.text(sub, rEdge, y + 13, { align: 'right' }); }
      y += 24;
      stroke(LINE); doc.setLineWidth(0.5); doc.line(mL, y, rEdge, y);
      y += 10;
    };

    const tbl = (opts: any) => {
      autoTable(doc, {
        margin: { top: TOP, bottom: BOTTOM, left: mL, right: mR },
        theme: 'grid',
        headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5, cellPadding: { top: 6, bottom: 6, left: 6, right: 6 } },
        bodyStyles: { fontSize: 8.5, textColor: INK_SOFT, cellPadding: { top: 5, bottom: 5, left: 6, right: 6 } },
        footStyles: { fillColor: [241, 245, 249], textColor: INK, fontStyle: 'bold', fontSize: 8.5, cellPadding: { top: 6, bottom: 6, left: 6, right: 6 } },
        alternateRowStyles: { fillColor: SLATE_BG },
        styles: { lineColor: LINE, lineWidth: 0.3, overflow: 'linebreak' },
        ...opts,
        startY: y,
      });
      y = (doc as any).lastAutoTable.finalY + 18;
    };

    const cols = (right: number[] = [], center: number[] = []) => {
      const o: any = {};
      right.forEach(i => (o[i] = { halign: 'right' }));
      center.forEach(i => (o[i] = { halign: 'center' }));
      return o;
    };

    // ── period + meta ───────────────────────────────────────────────────────
    const from = range.dateFrom || null;
    const to = range.dateTo || null;
    const periodLabel = !from && !to ? 'All Time (complete records)'
      : from && to ? (from === to ? this.ymdLabel(from) : `${this.ymdLabel(from)} to ${this.ymdLabel(to)}`)
        : from ? `From ${this.ymdLabel(from)}` : `Up to ${this.ymdLabel(to!)}`;
    const generatedStr = new Date().toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: TZ,
    });

    const has = (name: string) => !d.missing.includes(name);
    const val = (name: string, n: number) => (has(name) ? this.money(n) : 'Not available');

    // ── numbers ─────────────────────────────────────────────────────────────
    const sum = (arr: any[], f: (x: any) => number) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
    const sales = d.sales;
    const revenue = sum(sales, s => s.totalRevenue);
    const cost = sum(sales, s => s.totalCost);
    const profit = sum(sales, s => s.totalProfit);
    const margin = revenue ? (profit / revenue) * 100 : 0;
    const creditSales = sales.filter(s => s.paymentMethod === 'CREDIT');
    const immediateSales = sales.filter(s => s.paymentMethod !== 'CREDIT');
    const creditInvoiced = sum(creditSales, s => s.totalRevenue);
    const creditPaid = sum(creditSales, s => s.totalPaid ?? 0);
    const creditOutstanding = Math.max(0, creditInvoiced - creditPaid);
    const immediateRevenue = sum(immediateSales, s => s.totalRevenue);
    const paymentsReceived = sum(d.payments, p => p.amount);
    const cashCollected = immediateRevenue + paymentsReceived;
    const expAmt = (e: any) => Number(e.amount ?? e.total ?? e.cost ?? 0);
    const expTotal = sum(d.expenditures, expAmt);
    const budgetTotal = sum(d.budgetEntries, b => b.amount);
    const capitalTotal = sum(d.capitals, c => c.amount);

    // ════════════════════════════════════════════════════════════════════════
    // TITLE BLOCK + KPI CARDS
    // ════════════════════════════════════════════════════════════════════════
    font('bold', 21, INK); doc.text('Business Summary Report', mL, y + 18);
    font('normal', 9.5, GRAY);
    doc.text('Sales, collections, expenses and operations overview for the selected period', mL, y + 34);
    y += 50;

    fill(SLATE_BG); stroke(LINE); doc.setLineWidth(0.5);
    doc.roundedRect(mL, y, cw, 46, 4, 4, 'FD');
    const info: [string, string][] = [
      ['REPORTING PERIOD', periodLabel],
      ['GENERATED', generatedStr],
      ['PREPARED BY', preparedBy],
    ];
    const colW = cw / 3;
    info.forEach(([l, v], i) => {
      font('bold', 7.5, GRAY); doc.text(l, mL + 14 + colW * i, y + 16);
      font('bold', 10, INK);
      doc.text(doc.splitTextToSize(v, colW - 24)[0], mL + 14 + colW * i, y + 32);
    });
    y += 62;

    const cardsRow = (items: { label: string; value: string; color: RGB; sub?: string }[]) => {
      const gap = 10;
      const w = (cw - gap * (items.length - 1)) / items.length;
      items.forEach((it, i) => {
        const x = mL + i * (w + gap);
        fill(SLATE_BG); stroke(LINE); doc.setLineWidth(0.5);
        doc.roundedRect(x, y, w, 54, 4, 4, 'FD');
        fill(it.color); doc.rect(x, y + 6, 3, 42, 'F');
        font('normal', 8, GRAY); doc.text(it.label, x + 12, y + 16);
        let fs = 12.5;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(fs);
        while (doc.getTextWidth(it.value) > w - 20 && fs > 7) { fs -= 0.5; doc.setFontSize(fs); }
        doc.setTextColor(it.color[0], it.color[1], it.color[2]);
        doc.text(it.value, x + 12, y + 35);
        if (it.sub) { font('normal', 7.5, GRAY); doc.text(it.sub, x + 12, y + 47); }
      });
      y += 66;
    };

    if (isAdmin) {
      cardsRow([
        { label: 'TOTAL SALES', value: this.money(revenue), color: BLUE },
        { label: 'TOTAL COST', value: this.money(cost), color: AMBER },
        { label: 'NET PROFIT', value: this.money(profit), color: profit >= 0 ? GREEN : RED },
        { label: 'PROFIT MARGIN', value: `${margin.toFixed(1)}%`, color: VIOLET },
      ]);
    }
    cardsRow([
      ...(isAdmin ? [] : [{ label: 'TOTAL SALES', value: this.money(revenue), color: BLUE }]),
      { label: 'TRANSACTIONS', value: this.num(sales.length), color: TEAL },
      { label: 'CASH COLLECTED', value: has('Payments') ? this.money(cashCollected) : this.money(immediateRevenue), color: GREEN },
      { label: 'CREDIT PAYMENTS RECEIVED', value: has('Payments') ? this.money(paymentsReceived) : 'N/A', color: BLUE },
      { label: 'OUTSTANDING CREDIT', value: this.money(creditOutstanding), color: creditOutstanding > 0 ? RED : GREEN },
    ].slice(0, 4));

    font('normal', 8, GRAY);
    doc.text('Figures are based on saved sales. Cancelled sales are excluded. All amounts in Sri Lankan Rupees (LKR).', mL, y);
    y += 22;

    // ════════════════════════════════════════════════════════════════════════
    // 1. FINANCIAL SUMMARY
    // ════════════════════════════════════════════════════════════════════════
    section('Financial Summary', 'Sales, collections, credit and expenses');
    const subRow = (t: string): any[] => [{ content: t, colSpan: 2, styles: { fillColor: [241, 245, 249], textColor: NAVY, fontStyle: 'bold', fontSize: 8 } }];
    const kv = (a: string, b: string, bold = false, color: RGB = INK_SOFT): any[] => [
      { content: a, styles: { fontStyle: bold ? 'bold' : 'normal' } },
      { content: b, styles: { halign: 'right', fontStyle: bold ? 'bold' : 'normal', textColor: color } },
    ];
    tbl({
      head: [['Description', 'Amount']],
      alternateRowStyles: { fillColor: [255, 255, 255] },
      columnStyles: cols([1]),
      body: [
        subRow('SALES'),
        kv('Total sales invoiced', this.money(revenue), true),
        ...(isAdmin ? [
          kv('Cost of goods sold', this.money(cost)),
          kv('Gross profit', this.money(profit), true, profit >= 0 ? GREEN : RED),
          kv('Profit margin', `${margin.toFixed(1)}%`),
        ] : []),
        kv('Number of transactions', this.num(sales.length)),
        kv('Average sale value', this.money(sales.length ? revenue / sales.length : 0)),
        subRow('COLLECTIONS'),
        kv('Cash / card / bank sales received', this.money(immediateRevenue)),
        kv('Credit payments received in period', val('Payments', paymentsReceived)),
        kv('Total cash collected', has('Payments') ? this.money(cashCollected) : 'Not available', true, GREEN),
        subRow('CREDIT POSITION (CREDIT SALES MADE IN THIS PERIOD)'),
        kv('Credit sales invoiced', this.money(creditInvoiced)),
        kv('Paid to date', this.money(creditPaid)),
        kv('Outstanding balance', this.money(creditOutstanding), true, creditOutstanding > 0 ? RED : GREEN),
        subRow('EXPENSES & CAPITAL'),
        kv('Expenditures recorded', val('Expenditures', expTotal)),
        kv('Budget entries recorded', val('Budget entries', budgetTotal)),
        kv('Capital injections', val('Capital', capitalTotal)),
      ],
    });

    // ════════════════════════════════════════════════════════════════════════
    // 2. SALES BY PAYMENT METHOD
    // ════════════════════════════════════════════════════════════════════════
    section('Sales by Payment Method');
    const methods: [string, string][] = [['CASH', 'Cash'], ['CARD', 'Card'], ['BANK', 'Bank Transfer'], ['CREDIT', 'Credit']];
    const methodRows = methods.map(([k, label]) => {
      const list = sales.filter(s => s.paymentMethod === k);
      const rev = sum(list, s => s.totalRevenue);
      const collected = k === 'CREDIT' ? sum(list, s => s.totalPaid ?? 0) : rev;
      return [label, this.num(list.length), this.fmt(rev), revenue ? ((rev / revenue) * 100).toFixed(1) + '%' : '0.0%', this.fmt(collected), this.fmt(Math.max(0, rev - collected))];
    });
    tbl({
      head: [['Method', 'Transactions', 'Sales (LKR)', 'Share', 'Collected (LKR)', 'Pending (LKR)']],
      body: methodRows,
      foot: [['Total', this.num(sales.length), this.fmt(revenue), '100%', this.fmt(immediateRevenue + creditPaid), this.fmt(creditOutstanding)]],
      columnStyles: cols([1, 2, 3, 4, 5]),
    });

    // ════════════════════════════════════════════════════════════════════════
    // 3. SALES TREND
    // ════════════════════════════════════════════════════════════════════════
    const dayMap = new Map<string, Bucket>();
    sales.forEach(s => {
      const key = this.ymd(s.saleDatetime);
      const b = dayMap.get(key) ?? { label: '', sort: key, count: 0, revenue: 0, cost: 0, profit: 0 };
      b.count++; b.revenue += s.totalRevenue; b.cost += s.totalCost; b.profit += s.totalProfit;
      dayMap.set(key, b);
    });
    let buckets = Array.from(dayMap.values()).sort((a, b) => a.sort.localeCompare(b.sort));
    let monthly = false;
    if (buckets.length > 31) {
      monthly = true;
      const monthMap = new Map<string, Bucket>();
      buckets.forEach(b => {
        const k = b.sort.slice(0, 7);
        const m = monthMap.get(k) ?? { label: '', sort: k, count: 0, revenue: 0, cost: 0, profit: 0 };
        m.count += b.count; m.revenue += b.revenue; m.cost += b.cost; m.profit += b.profit;
        monthMap.set(k, m);
      });
      buckets = Array.from(monthMap.values()).sort((a, b) => a.sort.localeCompare(b.sort));
    }
    buckets.forEach(b => {
      b.label = monthly
        ? new Date(`${b.sort}-01T00:00:00+05:30`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: TZ })
        : new Date(`${b.sort}T00:00:00+05:30`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: TZ });
    });

    section('Sales Trend', monthly ? 'Monthly breakdown' : 'Daily breakdown');
    if (!buckets.length) {
      note('No sales were recorded in this period.');
    } else {
      ensure(190);
      const ch = 120, top = y + 6, left = mL + 38, wArea = cw - 38;
      const maxV = Math.max(1, ...buckets.map(b => Math.max(b.revenue, isAdmin ? b.profit : 0)));
      font('normal', 7, GRAY);
      for (let i = 0; i <= 4; i++) {
        const gy = top + ch - (ch * i) / 4;
        stroke(LINE); doc.setLineWidth(0.3); doc.line(left, gy, rEdge, gy);
        doc.text(this.compact((maxV * i) / 4), left - 4, gy + 2, { align: 'right' });
      }
      const slot = wArea / buckets.length;
      const groups = isAdmin ? 2 : 1;
      const bw = Math.min(18, (slot * 0.7) / groups);
      const step = Math.ceil(buckets.length / 16);
      buckets.forEach((b, i) => {
        const cx = left + slot * i + slot / 2;
        const x0 = cx - (bw * groups) / 2;
        const rh = (b.revenue / maxV) * ch;
        fill(BLUE); doc.rect(x0, top + ch - rh, bw, rh, 'F');
        if (isAdmin) {
          const ph = (Math.max(0, b.profit) / maxV) * ch;
          fill(GREEN); doc.rect(x0 + bw, top + ch - ph, bw, ph, 'F');
        }
        if (i % step === 0) { font('normal', 7, GRAY); doc.text(b.label, cx, top + ch + 11, { align: 'center' }); }
      });
      y = top + ch + 24;
      const lx = rEdge - (isAdmin ? 130 : 60);
      fill(BLUE); doc.rect(lx, y, 8, 8, 'F'); font('normal', 7.5, GRAY); doc.text('Sales', lx + 12, y + 7);
      if (isAdmin) { fill(GREEN); doc.rect(lx + 60, y, 8, 8, 'F'); doc.text('Profit', lx + 72, y + 7); }
      y += 20;

      const best = buckets.reduce((a, b) => (b.revenue > a.revenue ? b : a), buckets[0]);
      font('normal', 9, INK_SOFT);
      doc.text(`Highest sales ${monthly ? 'month' : 'day'}: ${best.label} with ${this.money(best.revenue)} from ${best.count} transaction(s).`, mL, y);
      y += 18;

      tbl({
        head: [[monthly ? 'Month' : 'Date', 'Transactions', 'Sales (LKR)', ...(isAdmin ? ['Cost (LKR)', 'Profit (LKR)'] : [])]],
        body: buckets.map(b => [b.label, this.num(b.count), this.fmt(b.revenue), ...(isAdmin ? [this.fmt(b.cost), this.fmt(b.profit)] : [])]),
        foot: [['Total', this.num(sales.length), this.fmt(revenue), ...(isAdmin ? [this.fmt(cost), this.fmt(profit)] : [])]],
        columnStyles: cols(isAdmin ? [1, 2, 3, 4] : [1, 2]),
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // 4. PRODUCT SALES
    // ════════════════════════════════════════════════════════════════════════
    section('Product Sales', 'By pack size');
    const packMap = new Map<string, { name: string; kg: number; qty: number; revenue: number; profit: number }>();
    sales.forEach(s => (s.items ?? []).forEach(it => {
      const key = it.packTypeId || it.packName;
      const p = packMap.get(key) ?? { name: it.packName, kg: it.weightKg ?? 0, qty: 0, revenue: 0, profit: 0 };
      p.qty += it.qty; p.revenue += it.lineRevenue; p.profit += it.lineProfit;
      packMap.set(key, p);
    }));
    const packs = Array.from(packMap.values()).sort((a, b) => b.revenue - a.revenue);
    if (!packs.length) {
      note('No product sales in this period.');
    } else {
      tbl({
        head: [['Product', 'Unit (kg)', 'Qty Sold', 'Total Weight (kg)', 'Sales (LKR)', ...(isAdmin ? ['Profit (LKR)'] : [])]],
        body: packs.map(p => [p.name, this.num(p.kg), this.num(p.qty), this.num(p.kg * p.qty), this.fmt(p.revenue), ...(isAdmin ? [this.fmt(p.profit)] : [])]),
        foot: [['Total', '', this.num(sum(packs, p => p.qty)), this.num(sum(packs, p => p.kg * p.qty)), this.fmt(sum(packs, p => p.revenue)), ...(isAdmin ? [this.fmt(sum(packs, p => p.profit))] : [])]],
        columnStyles: cols(isAdmin ? [1, 2, 3, 4, 5] : [1, 2, 3, 4]),
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // 5. CUSTOMER PERFORMANCE
    // ════════════════════════════════════════════════════════════════════════
    const custMap = new Map<string, { name: string; code: string; count: number; revenue: number; profit: number; cInv: number; cPaid: number }>();
    sales.forEach(s => {
      const key = s.customerId || s.customerName;
      const c = custMap.get(key) ?? { name: s.customerName, code: s.customerCode, count: 0, revenue: 0, profit: 0, cInv: 0, cPaid: 0 };
      c.count++; c.revenue += s.totalRevenue; c.profit += s.totalProfit;
      if (s.paymentMethod === 'CREDIT') { c.cInv += s.totalRevenue; c.cPaid += s.totalPaid ?? 0; }
      custMap.set(key, c);
    });
    const customers = Array.from(custMap.values()).sort((a, b) => b.revenue - a.revenue);
    section('Customer Performance', customers.length > 10 ? `Top 10 of ${customers.length} customers` : `${customers.length} customer(s)`);
    if (!customers.length) {
      note('No customer activity in this period.');
    } else {
      tbl({
        head: [['#', 'Customer', 'Code', 'Sales', 'Revenue (LKR)', 'Share', ...(isAdmin ? ['Profit (LKR)'] : []), 'Outstanding (LKR)']],
        body: customers.slice(0, 10).map((c, i) => [
          String(i + 1), c.name, c.code, this.num(c.count), this.fmt(c.revenue),
          revenue ? ((c.revenue / revenue) * 100).toFixed(1) + '%' : '0.0%',
          ...(isAdmin ? [this.fmt(c.profit)] : []),
          this.fmt(Math.max(0, c.cInv - c.cPaid)),
        ]),
        columnStyles: cols(isAdmin ? [3, 4, 5, 6, 7] : [3, 4, 5, 6], [0]),
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // 6. CREDIT & COLLECTIONS
    // ════════════════════════════════════════════════════════════════════════
    section('Credit & Collections');
    subhead('Outstanding balances (credit sales made in this period)');
    const owing = customers
      .map(c => ({ ...c, out: Math.max(0, c.cInv - c.cPaid) }))
      .filter(c => c.out > 0.001)
      .sort((a, b) => b.out - a.out);
    if (!owing.length) {
      note('No outstanding credit balances for sales in this period.');
    } else {
      tbl({
        head: [['Customer', 'Code', 'Credit Invoiced (LKR)', 'Paid (LKR)', 'Outstanding (LKR)']],
        body: owing.slice(0, 20).map(c => [c.name, c.code, this.fmt(c.cInv), this.fmt(c.cPaid), this.fmt(c.out)]),
        foot: [['Total', '', this.fmt(creditInvoiced), this.fmt(creditPaid), this.fmt(creditOutstanding)]],
        columnStyles: cols([2, 3, 4]),
      });
    }

    subhead('Credit payments received in this period');
    if (!has('Payments')) {
      note('Payment records are not available.');
    } else if (!d.payments.length) {
      note('No credit payments were received in this period.');
    } else {
      tbl({
        head: [['Payment No', 'Date', 'Sale No', 'Customer', 'Amount (LKR)', 'Recorded By']],
        body: d.payments.map(p => [p.paymentNo, this.dateStr(p.paymentDate), p.saleNo, p.customerName, this.fmt(p.amount), p.recordedBy || '-']),
        foot: [['Total', '', '', '', this.fmt(paymentsReceived), '']],
        columnStyles: cols([4]),
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // 7. CAPITAL, BUDGET & EXPENDITURE
    // ════════════════════════════════════════════════════════════════════════
    section('Capital, Budget & Expenditure');
    const sortByDate = (arr: any[], f: (x: any) => any) => [...arr].sort((a, b) => new Date(f(a)).getTime() - new Date(f(b)).getTime());

    subhead('Capital injections');
    if (!has('Capital')) note('Capital records are not available.');
    else if (!d.capitals.length) note('No capital injections in this period.');
    else tbl({
      head: [['Date', 'Label', 'Note', 'Amount (LKR)']],
      body: sortByDate(d.capitals, c => c.capital_date ?? c.date ?? c.createdAt)
        .map(c => [this.dateStr(c.capital_date ?? c.date ?? c.createdAt), c.label ?? '-', c.note ?? '-', this.fmt(c.amount)]),
      foot: [['Total', '', '', this.fmt(capitalTotal)]],
      columnStyles: cols([3]),
    });

    subhead('Budget entries');
    if (!has('Budget entries')) note('Budget records are not available.');
    else if (!d.budgetEntries.length) note('No budget entries in this period.');
    else tbl({
      head: [['Date', 'Description', 'Amount (LKR)']],
      body: sortByDate(d.budgetEntries, b => b.date).map(b => [this.dateStr(b.date), b.description || '-', this.fmt(b.amount)]),
      foot: [['Total', '', this.fmt(budgetTotal)]],
      columnStyles: cols([2]),
    });

    subhead('Expenditures');
    if (!has('Expenditures')) note('Expenditure records are not available.');
    else if (!d.expenditures.length) note('No expenditures in this period.');
    else tbl({
      head: [['Date', 'Description', 'Amount (LKR)']],
      body: sortByDate(d.expenditures, e => e.date ?? e.expenditure_date ?? e.expenditureDate ?? e.createdAt)
        .map(e => [
          this.dateStr(e.date ?? e.expenditure_date ?? e.expenditureDate ?? e.createdAt),
          e.description ?? e.title ?? e.name ?? e.category ?? '-',
          this.fmt(expAmt(e)),
        ]),
      foot: [['Total', '', this.fmt(expTotal)]],
      columnStyles: cols([2]),
    });

    // ════════════════════════════════════════════════════════════════════════
    // 8. PRODUCTION
    // ════════════════════════════════════════════════════════════════════════
    section('Production', 'Milling and sifting activity');
    subhead('Milling logs');
    if (!has('Milling logs')) note('Milling records are not available.');
    else if (!d.machineLogs.length) note('No milling logs in this period.');
    else {
      const ml = [...d.machineLogs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const tIn = sum(ml, l => l.input ?? 0), tOut = sum(ml, l => l.output ?? 0);
      tbl({
        head: [['Date', 'Operator', 'Partner', 'Sessions', 'Raw Rice (kg)', 'Input (kg)', 'Output (kg)', 'Rejection (kg)', 'Eff.']],
        body: ml.map(l => [
          this.dateStr(l.date), l.operator?.name ?? '-', l.partner?.name ?? '-',
          String((l.sessions ?? []).filter(s => s.startTime).length),
          this.num(l.rawRiceReceived ?? 0), this.num(l.input ?? 0), this.num(l.output ?? 0), this.num(l.rejection ?? 0),
          l.input ? (((l.output ?? 0) / l.input) * 100).toFixed(1) + '%' : '-',
        ]),
        foot: [['Total', '', '', '', this.num(sum(ml, l => l.rawRiceReceived ?? 0)), this.num(tIn), this.num(tOut), this.num(sum(ml, l => l.rejection ?? 0)), tIn ? ((tOut / tIn) * 100).toFixed(1) + '%' : '-']],
        columnStyles: cols([4, 5, 6, 7, 8], [3]),
        styles: { fontSize: 8, lineColor: LINE, lineWidth: 0.3, overflow: 'linebreak' },
      });
    }

    subhead('Sifting logs');
    if (!has('Sifting logs')) note('Sifting records are not available.');
    else if (!d.siftingLogs.length) note('No sifting logs in this period.');
    else {
      const sl = [...d.siftingLogs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      tbl({
        head: [['Date', 'Batch', 'Operator', 'Input (kg)', 'Output (kg)', 'Rejection (kg)', 'Status']],
        body: sl.map(l => [
          this.dateStr(l.date), l.batchNo, l.operator?.username ?? '-',
          this.num(l.totalInput), this.num(l.totalOutput), this.num(l.totalRejection),
          l.isCompleted ? 'Completed' : 'In progress',
        ]),
        foot: [['Total', '', '', this.num(sum(sl, l => l.totalInput)), this.num(sum(sl, l => l.totalOutput)), this.num(sum(sl, l => l.totalRejection)), '']],
        columnStyles: cols([3, 4, 5]),
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // 9. INVENTORY SNAPSHOT
    // ════════════════════════════════════════════════════════════════════════
    section('Inventory Snapshot', `Current stock as at ${generatedStr}`);
    if (!has('Inventory')) note('Inventory records are not available.');
    else if (!d.inventory.length) note('No inventory records.');
    else {
      const inv = [...d.inventory].sort((a, b) => a.weightKg - b.weightKg);
      tbl({
        head: [['Product', 'Unit (kg)', 'In Stock', 'Total Weight (kg)', ...(isAdmin ? ['Unit Cost (LKR)', 'Stock Value (LKR)'] : []), 'Status']],
        body: inv.map(i => [
          i.packName, this.num(i.weightKg), this.num(i.stockQty), this.num(i.weightKg * i.stockQty),
          ...(isAdmin ? [this.fmt(i.currentCost), this.fmt(i.currentCost * i.stockQty)] : []),
          i.stockQty <= 0 ? 'Out of stock' : i.isLowStock ? 'Low stock' : 'OK',
        ]),
        foot: [['Total', '', this.num(sum(inv, i => i.stockQty)), this.num(sum(inv, i => i.weightKg * i.stockQty)), ...(isAdmin ? ['', this.fmt(sum(inv, i => i.currentCost * i.stockQty))] : []), '']],
        columnStyles: cols(isAdmin ? [1, 2, 3, 4, 5] : [1, 2, 3]),
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // APPENDIX: SALES REGISTER
    // ════════════════════════════════════════════════════════════════════════
    section('Appendix - Sales Register', `${sales.length} transaction(s)`);
    if (!sales.length) {
      note('No sales in this period.');
    } else {
      const reg = [...sales].sort((a, b) => new Date(a.saleDatetime).getTime() - new Date(b.saleDatetime).getTime());
      const payStatus = (s: Sale) =>
        s.paymentMethod !== 'CREDIT' || s.paymentStatus === 'PAID' ? 'Paid'
          : (s.totalPaid ?? 0) > 0 ? 'Partial' : 'Pending';
      tbl({
        head: [['Sale No', 'Date', 'Customer', 'Method', 'Status', 'Amount (LKR)', ...(isAdmin ? ['Profit (LKR)'] : [])]],
        body: reg.map(s => [s.saleNo, this.dateStr(s.saleDatetime), s.customerName, s.paymentMethod, payStatus(s), this.fmt(s.totalRevenue), ...(isAdmin ? [this.fmt(s.totalProfit)] : [])]),
        foot: [['Total', '', '', '', '', this.fmt(revenue), ...(isAdmin ? [this.fmt(profit)] : [])]],
        columnStyles: cols(isAdmin ? [5, 6] : [5]),
        styles: { fontSize: 8, lineColor: LINE, lineWidth: 0.3, overflow: 'linebreak' },
      });
    }

    // ── closing notes ───────────────────────────────────────────────────────
    ensure(60);
    stroke(LINE); doc.setLineWidth(0.5); doc.line(mL, y, rEdge, y);
    font('bold', 9, GRAY); doc.text('Notes', mL, y + 15);
    font('normal', 8.5, INK_SOFT);
    doc.text('This report summarises records held in the Matheesha Flour Mill system at the time of generation.', mL, y + 28);
    if (d.missing.length) {
      font('normal', 8.5, RED);
      doc.text(`Sections not available in this report: ${d.missing.join(', ')}.`, mL, y + 41);
    }

    // ════════════════════════════════════════════════════════════════════════
    // LETTERHEAD + FOOTER ON EVERY PAGE
    // ════════════════════════════════════════════════════════════════════════
    const total = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);

      let tx = mL;
      if (logo) {
        try { doc.addImage(logo, 'PNG', mL, 26, 40, 40); tx = mL + 50; } catch { tx = mL; }
      }
      font('bold', 16, INK); doc.text(COMPANY.name, tx, 43);
      font('normal', 8, GRAY);
      doc.text(COMPANY.address, tx, 55);
      doc.text(`${COMPANY.email}  |  ${COMPANY.phone1} / ${COMPANY.phone2}`, tx, 66);

      font('bold', 9, BLUE); doc.text('BUSINESS SUMMARY REPORT', rEdge, 40, { align: 'right' });
      font('normal', 8, GRAY); doc.text(periodLabel, rEdge, 52, { align: 'right' });
      fill(BLUE); doc.rect(mL, 78, cw, 2, 'F');

      stroke(LINE); doc.setLineWidth(0.5); doc.line(mL, H - 44, rEdge, H - 44);
      font('normal', 7.5, GRAY);
      doc.text(`${COMPANY.name}  |  Confidential - for internal and authorised use only`, mL, H - 32);
      doc.text(`Generated ${generatedStr}  |  Prepared by ${preparedBy}`, mL, H - 22);
      font('bold', 8, INK_SOFT);
      doc.text(`Page ${p} of ${total}`, rEdge, H - 28, { align: 'right' });
    }

    return doc;
  }
}