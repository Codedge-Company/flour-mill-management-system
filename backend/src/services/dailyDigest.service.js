// services/dailyDigest.service.js
// End-of-day digest for the admin: machine start/stop, production, sales and payments of
// one day, as a PDF sent through the approved `mill_document` template (always delivered,
// ~LKR 3.40) with the key numbers in the message text.
// A scheduler sends it automatically every day at DAILY_DIGEST_TIME (default 20:00, Colombo).
//
// Env (all optional):
//   DAILY_DIGEST=off              turn the automatic digest off
//   DAILY_DIGEST_TIME=20:00       Colombo time (HH:MM, 24h)
//   DAILY_DIGEST_SEND_EMPTY=true  also send on days with no activity at all
const TZ = 'Asia/Colombo';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const bad = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

// ── Small helpers ───────────────────────────────────────────────────────────
const colomboDate = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
const colomboHM = (d = new Date()) =>
  d.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString('en-LK', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: true }) : '-';
const money = (n) => Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n) => Number(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const sum = (arr, pick) => arr.reduce((s, x) => s + (Number(pick(x)) || 0), 0);

function dayRange(dateStr) {
  if (!DATE_RE.test(String(dateStr || ''))) throw bad('date must be YYYY-MM-DD');
  const start = new Date(`${dateStr}T00:00:00+05:30`);
  if (isNaN(start)) throw bad('Invalid date');
  return { start, end: new Date(start.getTime() + 24 * 3600 * 1000) };
}
const longDate = (dateStr) =>
  new Date(`${dateStr}T12:00:00+05:30`).toLocaleDateString('en-LK', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: TZ,
  });
const shortDate = (dateStr) =>
  new Date(`${dateStr}T12:00:00+05:30`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ,
  });

// ── Collect the day's data from the database ───────────────────────────────
async function collect(dateStr) {
  const { start, end } = dayRange(dateStr);
  const MachineLog = require('../models/MachineLog');
  const Sale = require('../models/Sale');
  const Payment = require('../models/Payment');
  const User = require('../models/User');
  const { getSheet } = require('./dailySheet.service');

  const [log, sheet, sales, payments] = await Promise.all([
    MachineLog.findOne({ date: { $gte: start, $lt: end } }).lean(),
    getSheet(dateStr),
    Sale.find({ sale_datetime: { $gte: start, $lt: end }, status: { $ne: 'CANCELLED' } })
      .populate('customer_id', 'name').sort({ sale_datetime: 1 }).lean(),
    Payment.find({ payment_date: { $gte: start, $lt: end } })
      .populate('customer_id', 'name').populate('sale_id', 'sale_no').sort({ payment_date: 1 }).lean(),
  ]);

  // names of operators / partners
  const ids = new Set();
  if (log?.operator) ids.add(String(log.operator));
  if (log?.partner) ids.add(String(log.partner));
  for (const b of sheet.batches || []) { if (b.operatorId) ids.add(b.operatorId); if (b.partnerId) ids.add(b.partnerId); }
  const users = ids.size ? await User.find({ _id: { $in: [...ids] } }).select('full_name username').lean() : [];
  const nameOf = Object.fromEntries(users.map((u) => [String(u._id), u.full_name || u.username]));
  const nm = (id) => (id ? nameOf[String(id)] || '-' : '-');

  const packName = Object.fromEntries((sheet.packTypes || []).map((p) => [p.packTypeId, p.packName]));
  const sysStock = Object.fromEntries((sheet.packTypes || []).map((p) => [p.packTypeId, p.riceStock]));
  const lines = (arr) => (arr || []).map((l) => ({ name: packName[l.packTypeId] || 'Pack', qty: l.qty }));

  const sessions = [...(log?.sessions || [])]
    .filter((s) => s.startTime || s.stopTime)
    .sort((a, b) => a.sessionNumber - b.sessionNumber)
    .map((s) => ({
      no: s.sessionNumber, start: s.startTime || null, stop: s.stopTime || null,
      minutes: s.startTime && s.stopTime ? Math.round((new Date(s.stopTime) - new Date(s.startTime)) / 60000) : null,
      operator: nm(log.operator), partner: nm(log.partner),
    }));

  const byMethod = {};
  for (const s of sales) byMethod[s.payment_method] = (byMethod[s.payment_method] || 0) + (s.total_revenue || 0);

  const data = {
    date: dateStr,
    sessions,
    production: {
      rawRiceReceived: sheet.rawRiceReceived,
      batches: (sheet.batches || []).map((b) => ({
        batchNo: b.batchNo, operator: nm(b.operatorId), partner: nm(b.partnerId), input: b.input, output: b.output,
      })),
      sifting: (sheet.sifting || []).map((r) => ({ batchNo: r.batchNo, input: r.input, output: r.output, rejection: r.rejection })),
      packing: lines(sheet.packing),
      emptyBags: lines(sheet.emptyBagsReceived),
      stock: (sheet.endOfDayStock || []).map((l) => ({
        name: packName[l.packTypeId] || 'Pack', counted: l.qty, system: sysStock[l.packTypeId] ?? 0,
      })),
    },
    sales: {
      list: sales.map((s) => ({
        no: s.sale_no, time: s.sale_datetime, customer: s.customer_id?.name || '-',
        method: s.payment_method, status: s.payment_status, total: s.total_revenue || 0,
      })),
      count: sales.length,
      total: sum(sales, (s) => s.total_revenue),
      byMethod,
      pendingCredit: sum(sales.filter((s) => s.payment_method === 'CREDIT' && s.payment_status !== 'PAID'), (s) => s.total_revenue),
    },
    payments: {
      list: payments.map((p) => ({
        no: p.payment_no, time: p.payment_date, customer: p.customer_id?.name || '-',
        saleNo: p.sale_id?.sale_no || '-', amount: p.amount || 0,
      })),
      count: payments.length,
      total: sum(payments, (p) => p.amount),
    },
  };
  data.hasActivity = !!(
    data.sessions.length || data.sales.count || data.payments.count ||
    data.production.batches.length || data.production.packing.length || data.production.stock.length
  );
  return data;
}

// ── Message text (shown above the PDF) ─────────────────────────────────────
// Goes into a template variable: kept short (limit 1000 chars) and on one line.
function buildCaption(d) {
  const parts = [];
  if (d.sessions.length) {
    const first = d.sessions.find((s) => s.start);
    const last = [...d.sessions].reverse().find((s) => s.stop);
    parts.push(`Machine: ${d.sessions.length} session(s)` + (first ? ` ${fmtTime(first.start)}${last ? ' - ' + fmtTime(last.stop) : ''}` : ''));
  }
  const ground = sum(d.production.batches, (b) => b.output);
  const packed = sum(d.production.packing, (p) => p.qty);
  if (ground || packed) parts.push(`Ground ${num(ground)} kg, packed ${num(packed)} bags`);
  parts.push(`Sales: ${d.sales.count}` + (d.sales.count ? ` (LKR ${money(d.sales.total)})` : ''));
  if (d.sales.pendingCredit > 0) parts.push(`Credit pending LKR ${money(d.sales.pendingCredit)}`);
  if (d.payments.count) parts.push(`Payments received: LKR ${money(d.payments.total)} (${d.payments.count})`);
  const diffs = d.production.stock.filter((s) => s.counted !== s.system).length;
  if (d.production.stock.length) parts.push(diffs ? `Stock count: ${diffs} difference(s)` : 'Stock count matches');
  return `Daily report ${shortDate(d.date)} - ${parts.join(' | ')}. Full details are in the PDF.`;
}

// ── PDF ─────────────────────────────────────────────────────────────────────
function renderPdf(d) {
  const PDFDocument = require('pdfkit');
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Daily Report ${d.date}`, Author: 'Matheesha Flour Mill' } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 515, L = 40, BOTTOM = 790;
    const INK = '#1f2937', MUTED = '#6b7280', LINE = '#e5e7eb', BRAND = '#b45309', HEAD_BG = '#f3f4f6';

    const ensure = (h) => { if (doc.y + h > BOTTOM) doc.addPage(); };

    const section = (title) => {
      ensure(60);
      doc.moveDown(0.8).font('Helvetica-Bold').fontSize(12).fillColor(BRAND).text(title, L, doc.y);
      doc.moveTo(L, doc.y + 2).lineTo(L + W, doc.y + 2).strokeColor(BRAND).lineWidth(1).stroke();
      doc.moveDown(0.5);
    };

    const empty = (text) => { doc.font('Helvetica-Oblique').fontSize(9.5).fillColor(MUTED).text(text, L, doc.y); doc.moveDown(0.3); };

    // cols: [{ label, w, align }]  rows: arrays of strings
    const table = (cols, rows, { bold = false } = {}) => {
      const rowH = 17;
      const header = () => {
        const y = doc.y;
        doc.rect(L, y, W, rowH).fill(HEAD_BG);
        let x = L;
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(MUTED);
        for (const c of cols) { doc.text(c.label, x + 4, y + 5, { width: c.w - 8, height: 11, align: c.align || 'left', ellipsis: true }); x += c.w; }
        doc.y = y + rowH;
      };
      ensure(rowH * 2);
      header();
      rows.forEach((r, i) => {
        if (doc.y + rowH > BOTTOM) { doc.addPage(); header(); }
        const y = doc.y;
        let x = L;
        const isTotal = bold && i === rows.length - 1;
        doc.font(isTotal ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(INK);
        cols.forEach((c, ci) => {
          doc.text(String(r[ci] ?? ''), x + 4, y + 4.5, { width: c.w - 8, height: 11, align: c.align || 'left', ellipsis: true });
          x += c.w;
        });
        doc.moveTo(L, y + rowH).lineTo(L + W, y + rowH).strokeColor(LINE).lineWidth(0.5).stroke();
        doc.y = y + rowH;
      });
      doc.moveDown(0.3);
    };

    // Title block
    doc.font('Helvetica-Bold').fontSize(18).fillColor(INK).text('Matheesha Flour Mill', L, 40);
    doc.font('Helvetica').fontSize(11).fillColor(MUTED).text('Daily Report', L, doc.y);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(longDate(d.date), L, doc.y + 2);
    doc.moveTo(L, doc.y + 6).lineTo(L + W, doc.y + 6).strokeColor(INK).lineWidth(1.5).stroke();
    doc.y += 10;

    // Machine
    section('Machine sessions');
    if (!d.sessions.length) empty('No machine start/stop recorded.');
    else table(
      [{ label: 'Session', w: 55 }, { label: 'Started', w: 85 }, { label: 'Stopped', w: 85 }, { label: 'Duration', w: 75 }, { label: 'Operator', w: 110 }, { label: 'Partner', w: 105 }],
      d.sessions.map((s) => [
        `#${s.no}`, fmtTime(s.start), s.start && !s.stop ? 'still running' : fmtTime(s.stop),
        s.minutes != null ? `${Math.floor(s.minutes / 60)}h ${String(s.minutes % 60).padStart(2, '0')}m` : '-', s.operator, s.partner,
      ]),
    );

    // Production
    section('Production');
    const p = d.production;
    if (p.rawRiceReceived != null) { doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(`Raw rice received: ${num(p.rawRiceReceived)} kg`, L, doc.y); doc.moveDown(0.4); }
    if (p.batches.length) {
      table(
        [{ label: 'Grinding batch', w: 105 }, { label: 'Operator', w: 120 }, { label: 'Partner', w: 120 }, { label: 'Input (kg)', w: 85, align: 'right' }, { label: 'Output (kg)', w: 85, align: 'right' }],
        [...p.batches.map((b) => [b.batchNo, b.operator, b.partner, num(b.input), num(b.output)]),
          ['Total', '', '', num(sum(p.batches, (b) => b.input)), num(sum(p.batches, (b) => b.output))]],
        { bold: true },
      );
    }
    if (p.sifting.length) {
      const byBatch = {};
      for (const r of p.sifting) {
        const t = (byBatch[r.batchNo] ||= { i: 0, o: 0, j: 0 });
        t.i += r.input || 0; t.o += r.output || 0; t.j += r.rejection || 0;
      }
      table(
        [{ label: 'Sifting batch', w: 155 }, { label: 'Input (kg)', w: 120, align: 'right' }, { label: 'Output (kg)', w: 120, align: 'right' }, { label: 'Rejection (kg)', w: 120, align: 'right' }],
        Object.entries(byBatch).map(([b, t]) => [b, num(t.i), num(t.o), num(t.j)]),
      );
    }
    if (p.packing.length) table([{ label: 'Packed', w: 355 }, { label: 'Quantity', w: 160, align: 'right' }], p.packing.map((x) => [x.name, num(x.qty)]));
    if (p.emptyBags.length) table([{ label: 'Empty bags received', w: 355 }, { label: 'Quantity', w: 160, align: 'right' }], p.emptyBags.map((x) => [x.name, num(x.qty)]));
    if (!p.batches.length && !p.sifting.length && !p.packing.length && !p.emptyBags.length && p.rawRiceReceived == null) empty('No production recorded.');
    if (p.stock.length) {
      table(
        [{ label: 'End-of-day stock', w: 235 }, { label: 'Counted', w: 90, align: 'right' }, { label: 'System', w: 90, align: 'right' }, { label: 'Difference', w: 100, align: 'right' }],
        p.stock.map((s) => { const diff = s.counted - s.system; return [s.name, num(s.counted), num(s.system), diff === 0 ? 'OK' : `${diff > 0 ? '+' : ''}${num(diff)}`]; }),
      );
    }

    // Sales
    section('Sales');
    if (!d.sales.count) empty('No sales today.');
    else {
      table(
        [{ label: 'Sale', w: 80 }, { label: 'Time', w: 65 }, { label: 'Customer', w: 160 }, { label: 'Payment', w: 60 }, { label: 'Status', w: 55 }, { label: 'Total (LKR)', w: 95, align: 'right' }],
        [...d.sales.list.map((s) => [s.no, fmtTime(s.time), s.customer, s.method, s.status, money(s.total)]),
          ['Total', '', `${d.sales.count} sale(s)`, '', '', money(d.sales.total)]],
        { bold: true },
      );
      const methods = Object.entries(d.sales.byMethod).map(([m, v]) => `${m}: LKR ${money(v)}`).join('    ');
      doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(methods, L, doc.y);
      if (d.sales.pendingCredit > 0) doc.fillColor('#b91c1c').text(`Credit sales still unpaid: LKR ${money(d.sales.pendingCredit)}`, L, doc.y + 2);
      doc.moveDown(0.3);
    }

    // Payments
    section('Payments received (credit sales)');
    if (!d.payments.count) empty('No payments recorded today.');
    else table(
      [{ label: 'Payment', w: 85 }, { label: 'Time', w: 65 }, { label: 'Customer', w: 170 }, { label: 'Sale', w: 80 }, { label: 'Amount (LKR)', w: 115, align: 'right' }],
      [...d.payments.list.map((x) => [x.no, fmtTime(x.time), x.customer, x.saleNo, money(x.amount)]),
        ['Total', '', `${d.payments.count} payment(s)`, '', money(d.payments.total)]],
      { bold: true },
    );

    doc.font('Helvetica').fontSize(8).fillColor(MUTED)
      .text(`Generated ${new Date().toLocaleString('en-LK', { timeZone: TZ })} - automated mill system report.`, L, Math.min(doc.y + 14, 810), { width: W, align: 'center' });
    doc.end();
  });
}

// ── Send ────────────────────────────────────────────────────────────────────
async function sendDigestNow(dateStr) {
  const { sendWhatsAppDocument } = require('./whatsapp.service');
  const data = await collect(dateStr);
  const pdf = await renderPdf(data);
  const to = process.env.NOTIFY_WHATSAPP_TO || '94779337369';
  const r = await sendWhatsAppDocument(to, pdf, `Daily-Report-${dateStr}.pdf`, buildCaption(data));
  if (!r.success) throw bad(`WhatsApp digest could not be sent: ${r.error}`, 502);
  return { date: dateStr, mode: r.mode, hasActivity: data.hasActivity };
}

// PDF only, no WhatsApp (for checking the report: GET /api/daily-digest/:date/preview)
async function previewPdf(dateStr) {
  return renderPdf(await collect(dateStr));
}

// ── Automatic daily send ────────────────────────────────────────────────────
async function claim(DigestLog, date) {
  try {
    await DigestLog.create({ date, status: 'sending', claimedAt: new Date() });
    return true;
  } catch (e) {
    if (e.code !== 11000) throw e;
    // someone else claimed it; take over only if that attempt died (> 10 min ago)
    const stale = await DigestLog.findOneAndUpdate(
      { date, status: 'sending', claimedAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) } },
      { $set: { claimedAt: new Date() } },
    );
    return !!stale;
  }
}

const attempts = {}; // date -> tries in this process
let timer = null;

async function tick() {
  const today = colomboDate();
  const at = /^\d{2}:\d{2}$/.test(process.env.DAILY_DIGEST_TIME || '') ? process.env.DAILY_DIGEST_TIME : '20:00';
  if (colomboHM() < at) return;
  if ((attempts[today] || 0) >= 5) return;

  const DigestLog = require('../models/DigestLog');
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1) return; // not connected yet

  if (!(await claim(DigestLog, today))) return;
  attempts[today] = (attempts[today] || 0) + 1;
  try {
    const data = await collect(today);
    if (!data.hasActivity && process.env.DAILY_DIGEST_SEND_EMPTY !== 'true') {
      await DigestLog.updateOne({ date: today }, { $set: { status: 'skipped', note: 'no activity' } });
      console.log(`[Digest] ${today}: nothing happened today - not sent.`);
      return;
    }
    const pdf = await renderPdf(data);
    const { sendWhatsAppDocument } = require('./whatsapp.service');
    const to = process.env.NOTIFY_WHATSAPP_TO || '94779337369';
    const r = await sendWhatsAppDocument(to, pdf, `Daily-Report-${today}.pdf`, buildCaption(data));
    if (!r.success) throw new Error(r.error || 'send failed');
    await DigestLog.updateOne({ date: today }, { $set: { status: 'sent', sentAt: new Date() } });
    console.log(`[Digest] ${today}: daily report sent to ${to}.`);
  } catch (err) {
    console.error(`[Digest] ${today}: failed (try ${attempts[today]}/5): ${err.message}`);
    await DigestLog.deleteOne({ date: today, status: 'sending' }).catch(() => {}); // retry next minute
  }
}

function startDigestScheduler() {
  if (process.env.DAILY_DIGEST === 'off') { console.log('[Digest] automatic daily report is off.'); return; }
  if (timer) return;
  timer = setInterval(() => tick().catch((e) => console.error('[Digest] tick error:', e.message)), 60 * 1000);
  if (timer.unref) timer.unref();
  setTimeout(() => tick().catch(() => {}), 20 * 1000); // catch up if the app starts after the send time
  console.log(`[Digest] daily report scheduled for ${process.env.DAILY_DIGEST_TIME || '20:00'} (Colombo time).`);
}

module.exports = { startDigestScheduler, sendDigestNow, previewPdf, _internal: { collect, buildCaption, renderPdf, dayRange } };
