// src/services/invoicePrinter.service.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const logger = require('../utils/logger');

const SUMATRA_PATH = process.env.SUMATRA_PATH
  ? path.resolve(__dirname, '../..', process.env.SUMATRA_PATH)
  : path.join(__dirname, '../../bin/SumatraPDF.exe');
const INVOICE_PRINTER_NAME = process.env.INVOICE_PRINTER_NAME || 'A4 Printer';

// ── Shared formatting helpers ────────────────────────────────────────────────
const fmt = (value) =>
  Number(value ?? 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtQty = (value) =>
  Number(value ?? 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

// ── Palette (matches the Angular/jsPDF invoice styling) ─────────────────────
const INK = '#141414';
const INK_SOFT = '#3C3C3C';
const GRAY = '#6E6E6E';
const GRAY_LIGHT = '#828282';
const LINE = '#D2D2D2';
const HEADER_FILL = '#1A1A1A';
const HEADER_TEXT = '#FFFFFF';
const TOTAL_FILL = '#EEEEEE';

function buildInvoicePdf(sale, customer) {
  return new Promise((resolve, reject) => {
    const tempDir = path.join(__dirname, '../../tmp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const filePath = path.join(tempDir, `invoice_${sale.sale_no}_${Date.now()}.pdf`);

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const mL = 40;
    const pageW = doc.page.width;
    const rEdge = pageW - 40;

    // ── Payment status: CASH/CARD/BANK are always paid immediately.
    // CREDIT depends on payment_status ('PENDING' until settled).
    const isImmediateMethod = ['CASH', 'CARD', 'BANK'].includes(sale.payment_method);
    const isPaid = isImmediateMethod || sale.payment_status === 'PAID';
    const balanceDue = isPaid ? 0 : Number(sale.total_revenue ?? 0);

    const methodLabel = sale.payment_method === 'CREDIT'
      ? (isPaid ? 'CREDIT (Paid)' : 'CREDIT (Payment Pending)')
      : `${sale.payment_method} (Paid)`;

    const PAID_COLOR = '#16A34A';
    const DUE_COLOR = '#B41414';
    const PAID_FILL = '#F0FDF4';
    const DUE_FILL = '#FEF2F2';

    // ── Header ──────────────────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(13.5).fillColor(INK);
    doc.text('Matheesha Flour Mill', mL, 40);

    doc.fontSize(28);
    doc.text('INVOICE', mL, 34, { width: rEdge - mL, align: 'right' });

    doc.font('Helvetica').fontSize(9).fillColor(GRAY);
    doc.text('North Central Province', mL, 55);
    doc.text('Sri Lanka', mL, 67);
    doc.text('matheeshaflourmill@gmail.com', mL, 79);

    doc.fillColor(INK_SOFT);
    doc.text(`# ${sale.sale_no}`, mL, 58, { width: rEdge - mL, align: 'right' });

    doc.font('Helvetica-Bold').fontSize(9);
    doc.text(isPaid ? 'Amount Paid' : 'Balance Due', mL, 76, { width: rEdge - mL, align: 'right' });
    doc.fontSize(13).fillColor(isPaid ? PAID_COLOR : DUE_COLOR);
    doc.text(`LKR ${fmt(isPaid ? sale.total_revenue : balanceDue)}`, mL, 90, { width: rEdge - mL, align: 'right' });

    // divider
    doc.moveTo(mL, 102).lineTo(rEdge, 102).lineWidth(0.5).strokeColor(LINE).stroke();

    // ── Bill To + Meta ───────────────────────────────────────────────────────
    const b2Y = 118;
    doc.font('Helvetica').fontSize(8.5).fillColor(GRAY_LIGHT);
    doc.text('Bill To', mL, b2Y);

    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK);
    doc.text(customer?.name || 'N/A', mL, b2Y + 13);

    let addrEndY = b2Y + 13;
    const rawAddress = (customer?.address || '').trim();
    if (rawAddress) {
      doc.font('Helvetica').fontSize(9).fillColor(INK_SOFT);
      const addrLines = doc.heightOfString(rawAddress, { width: 260 });
      doc.text(rawAddress, mL, b2Y + 27, { width: 260 });
      addrEndY = b2Y + 27 + addrLines;
    }

    const invoiceDate = formatDate(sale.sale_datetime);
    const metaRows = [
      ['Invoice Date :', invoiceDate],
      ['Payment Method :', methodLabel],
      ['Status :', isPaid ? 'PAID' : 'PAYMENT DUE'],
    ];
    doc.font('Helvetica').fontSize(9);
    metaRows.forEach(([label, value], i) => {
      const ry = b2Y + i * 16;
      doc.fillColor(GRAY).text(label, mL, ry, { width: 260, align: 'right' });
      doc.fillColor(i === 2 ? (isPaid ? PAID_COLOR : DUE_COLOR) : INK_SOFT)
        .font(i === 2 ? 'Helvetica-Bold' : 'Helvetica')
        .text(value, mL, ry, { width: rEdge - mL, align: 'right' });
      doc.font('Helvetica'); // reset for next row's label
    });

    // ── Items table ──────────────────────────────────────────────────────────
    let y = Math.max(addrEndY, b2Y + 3 * 16) + 20;
    const tableW = rEdge - mL;
    const cNo = 26, cQty = 54, cRate = 82, cAmt = 88;
    const cDesc = tableW - cNo - cQty - cRate - cAmt;
    const colX = { no: mL, desc: mL + cNo, qty: mL + cNo + cDesc, rate: mL + cNo + cDesc + cQty, amt: mL + cNo + cDesc + cQty + cRate };
    const rowH = 22;

    doc.rect(mL, y, tableW, rowH).fill(HEADER_FILL);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(HEADER_TEXT);
    doc.text('#', colX.no, y + 6, { width: cNo, align: 'center' });
    doc.text('Item & Description', colX.desc + 6, y + 6, { width: cDesc - 6 });
    doc.text('Qty', colX.qty, y + 6, { width: cQty, align: 'center' });
    doc.text('Rate', colX.rate, y + 6, { width: cRate - 6, align: 'right' });
    doc.text('Amount', colX.amt, y + 6, { width: cAmt - 6, align: 'right' });
    y += rowH;

    doc.font('Helvetica').fontSize(9).fillColor(INK_SOFT);
    (sale.items || []).forEach((item, i) => {
      const pack = item.pack_type_id;
      const label = typeof pack === 'object'
        ? `${pack.pack_name}${pack.weight_kg != null ? ' - ' + pack.weight_kg + 'kg' : ''}`
        : 'Item';

      doc.rect(mL, y, tableW, rowH).strokeColor(LINE).lineWidth(0.4).stroke();
      doc.text(`${i + 1}`, colX.no, y + 6, { width: cNo, align: 'center' });
      doc.text(label, colX.desc + 6, y + 6, { width: cDesc - 6 });
      doc.text(`${fmtQty(item.qty)} pcs`, colX.qty, y + 6, { width: cQty, align: 'center' });
      doc.text(`LKR ${fmt(item.unit_price_sold)}`, colX.rate, y + 6, { width: cRate - 6, align: 'right' });
      doc.text(`LKR ${fmt(item.line_revenue)}`, colX.amt, y + 6, { width: cAmt - 6, align: 'right' });
      y += rowH;
    });

    // ── Totals block ─────────────────────────────────────────────────────────
    y += 8;
    const totLblW = 110, totValW = 110;
    const totLeft = rEdge - totLblW - totValW;
    const totRowH = 20;

    const totalsRows = isPaid
      ? [
          { label: 'Sub Total', value: `LKR ${fmt(sale.total_revenue)}`, fill: '#FFFFFF', color: INK_SOFT, bold: false },
          { label: 'Total', value: `LKR ${fmt(sale.total_revenue)}`, fill: '#FFFFFF', color: INK, bold: true },
          { label: 'Amount Paid', value: `LKR ${fmt(sale.total_revenue)}`, fill: PAID_FILL, color: PAID_COLOR, bold: true },
        ]
      : [
          { label: 'Sub Total', value: `LKR ${fmt(sale.total_revenue)}`, fill: '#FFFFFF', color: INK_SOFT, bold: false },
          { label: 'Total', value: `LKR ${fmt(sale.total_revenue)}`, fill: '#FFFFFF', color: INK, bold: true },
          { label: 'Balance Due', value: `LKR ${fmt(balanceDue)}`, fill: DUE_FILL, color: DUE_COLOR, bold: true },
        ];

    totalsRows.forEach((row) => {
      doc.rect(totLeft, y, totLblW + totValW, totRowH).fill(row.fill);
      doc.font(row.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(row.color);
      doc.text(row.label, totLeft, y + 5, { width: totLblW, align: 'right' });
      doc.text(row.value, totLeft + totLblW, y + 5, { width: totValW, align: 'right' });
      y += totRowH;
    });

    // ── Notes ────────────────────────────────────────────────────────────────
    y += 20;
    doc.moveTo(mL, y).lineTo(rEdge, y).strokeColor(LINE).lineWidth(0.5).stroke();
    doc.font('Helvetica-Bold').fontSize(9).fillColor(GRAY);
    doc.text('Notes', mL, y + 14);
    doc.font('Helvetica').fontSize(9).fillColor(INK_SOFT);
    doc.text(
      isPaid
        ? 'Thanks for your business.'
        : 'Thanks for your business. Please settle the outstanding balance at your earliest convenience.',
      mL, y + 27
    );

    doc.end();
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

async function printInvoiceSilently(sale, customer, options = {}) {
  if (!fs.existsSync(SUMATRA_PATH)) {
    throw new Error(`SumatraPDF.exe not found at ${SUMATRA_PATH}`);
  }
  const filePath = await buildInvoicePdf(sale, customer);
  const printerName = options.printerName || INVOICE_PRINTER_NAME;

  return new Promise((resolve, reject) => {
    const cmd = `"${SUMATRA_PATH}" -print-to "${printerName}" -silent "${filePath}"`;
    exec(cmd, { timeout: 20000 }, (error) => {
      setTimeout(() => { try { fs.unlinkSync(filePath); } catch (_) {} }, 5000);
      if (error) {
        logger.error(`Invoice print failed: ${error.message}`);
        reject(error);
        return;
      }
      logger.info(`Invoice printed silently: ${sale.sale_no}`);
      resolve({ success: true });
    });
  });
}

async function generateInvoicePdfBuffer(sale, customer) {
  const filePath = await buildInvoicePdf(sale, customer);
  try {
    return fs.readFileSync(filePath);
  } finally {
    try { fs.unlinkSync(filePath); } catch (_) {}
  }
}

module.exports = { buildInvoicePdf, printInvoiceSilently, generateInvoicePdfBuffer };