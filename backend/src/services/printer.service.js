// src/services/printer.service.js
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const logger = require('../utils/logger');
const PDFDocument = require('pdfkit');

const ESC = 0x1B;
const GS = 0x1D;

const COMMANDS = {
  INIT: Buffer.from([ESC, 0x40]),
  FEED: (n = 1) => Buffer.from([ESC, 0x64, n]),
  CUT: Buffer.from([GS, 0x56, 0x00]),
  ALIGN: (a = 0) => Buffer.from([ESC, 0x61, a]),
  BARCODE_HEIGHT: (h = 70) => Buffer.from([GS, 0x68, h]),
  BARCODE_WIDTH: (w = 2) => Buffer.from([GS, 0x77, w]),
  BARCODE_HRI: (pos = 2) => Buffer.from([GS, 0x48, pos]),
};

const WIDTH = 42;

// ── Shared header (used on every printed slip/receipt) ──────────────────────
const COMPANY_NAME = 'Matheesha Flour Mill';
const COMPANY_ADDRESS = 'North Central Province';
const COMPANY_EMAIL = 'matheeshaflourmill@gmail.com';

const safeToFixed = (num, d = 2) =>
  (num === undefined || num === null || isNaN(num)) ? '0.00' : Number(num).toFixed(d);

const center = (text, w = WIDTH) => {
  const t = String(text).substring(0, w);
  const pad = Math.floor((w - t.length) / 2);
  return ' '.repeat(Math.max(0, pad)) + t;
};

const leftRight = (left, right, w = WIDTH) => {
  const l = String(left);
  const r = String(right);
  const gap = w - l.length - r.length;
  return gap > 0 ? l + ' '.repeat(gap) + r : (l + ' ' + r).substring(0, w);
};

const divider = (w = WIDTH, ch = '-') => ch.repeat(w);

const printHeaderLines = () => [
  center(COMPANY_NAME),
  center(COMPANY_ADDRESS),
  center(COMPANY_EMAIL),
];

// CODE39 Function B: GS k 69 <len> <data>
const buildBarcodeCode39 = (data) => {
  const safeData = String(data).toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, '');
  const dataBuf = Buffer.from(safeData, 'latin1');
  return Buffer.concat([
    COMMANDS.ALIGN(1),
    COMMANDS.BARCODE_HEIGHT(70),
    COMMANDS.BARCODE_WIDTH(2),
    COMMANDS.BARCODE_HRI(2),
    Buffer.from([GS, 0x6B, 0x45, dataBuf.length]),
    dataBuf,
    COMMANDS.FEED(1),
    COMMANDS.ALIGN(0),
  ]);
};

const packLabel = (item) => {
  const p = item.pack_type_id;
  return typeof p === 'object' ? `${p.pack_name} (${p.weight_kg}kg)` : 'Item';
};

// ── 1. SALE RECEIPT (existing, header updated) ──────────────────────────────
const formatSaleReceipt = (sale, options = {}) => {
  const date = new Date(sale.sale_datetime || sale.createdAt || Date.now());
  const L = [];
  const nl = (t = '') => L.push(t);

  printHeaderLines().forEach(nl);
  nl(divider(WIDTH, '='));
  nl(center('SALES RECEIPT'));
  nl(divider(WIDTH, '='));
  nl(leftRight('SALE NO:', sale.sale_no || 'N/A'));
  nl(leftRight('DATE:', date.toLocaleDateString('en-LK')));
  nl(leftRight('TIME:', date.toLocaleTimeString('en-LK')));
  nl(leftRight('CUSTOMER:', sale.customer_id?.name || 'N/A'));
  nl(leftRight('CASHIER:', sale.created_by_user_id?.full_name || 'POS User'));
  nl(divider());

  (sale.items || []).forEach((item) => {
    nl(packLabel(item).substring(0, WIDTH));
    nl(leftRight(`  x${item.qty}`, 'LKR ' + safeToFixed(item.line_revenue)));
  });

  nl(divider());
  nl(leftRight('TOTAL:', 'LKR ' + safeToFixed(sale.total_revenue)));
  nl(divider(WIDTH, '='));

  const payLine = sale.payment_method === 'CREDIT'
    ? 'CREDIT - PAYMENT PENDING'
    : `PAID (${sale.payment_method})`;
  nl(center(payLine));
  nl(divider());
  nl(center('Thank You! Visit Again!'));
  nl('');
  nl('');

  return L.join('\r\n');
};

const printSale = async (sale, printerType = 'thermal', options = {}) => {
  logger.info(`printSale: ${sale?.sale_no || 'N/A'}`);
  try {
    if (!sale) throw new Error('Missing sale data');
    if (printerType !== 'thermal') return { success: false, error: 'unsupported printerType' };

    const printerName = options.printerName || '80 Printer Series';
    const text = formatSaleReceipt(sale, options);
    const shortId = (sale.sale_no || sale._id?.toString() || '').slice(-10).toUpperCase();
    const barcodeBuffer = shortId ? buildBarcodeCode39(shortId) : Buffer.alloc(0);

    const buffer = Buffer.concat([
      COMMANDS.INIT, COMMANDS.ALIGN(0),
      Buffer.from(text, 'binary'), Buffer.from('\r\n', 'binary'),
      barcodeBuffer, COMMANDS.FEED(4), COMMANDS.CUT,
    ]);

    const result = await printToWindowsPrinterUSB(buffer, printerName);
    if (result.success) logger.info(`Sale receipt printed: ${sale.sale_no}`);
    return result;
  } catch (err) {
    logger.error(`printSale error: ${err.message}`);
    return { success: false, error: err.message };
  }
};

// ── 2. STORE ROOM RECEIPT — items + qty only, no prices ─────────────────────
const formatStoreRoomReceipt = (sale) => {
  const date = new Date(sale.sale_datetime || sale.createdAt || Date.now());
  const L = [];
  const nl = (t = '') => L.push(t);

  printHeaderLines().forEach(nl);
  nl(divider(WIDTH, '='));
  nl(center('STORE ROOM RECEIPT'));
  nl(divider(WIDTH, '='));
  nl(leftRight('SALE NO:', sale.sale_no || 'N/A'));
  nl(leftRight('DATE:', date.toLocaleDateString('en-LK')));
  nl(leftRight('CUSTOMER:', sale.customer_id?.name || 'N/A'));
  nl(divider());
  nl(center('ITEMS TO RELEASE'));
  nl(divider());

  (sale.items || []).forEach((item) => {
    nl(leftRight(packLabel(item), `Qty: ${item.qty}`));
  });

  nl(divider(WIDTH, '='));
  nl(center('Prepared By: ______________'));
  nl(center('Checked By:  ______________'));
  nl('');
  nl('');

  return L.join('\r\n');
};

const printStoreRoomReceipt = async (sale, options = {}) => {
  logger.info(`printStoreRoomReceipt: ${sale?.sale_no || 'N/A'}`);
  try {
    const printerName = options.printerName || '80 Printer Series';
    const text = formatStoreRoomReceipt(sale);
    const buffer = Buffer.concat([
      COMMANDS.INIT, COMMANDS.ALIGN(0),
      Buffer.from(text, 'binary'), Buffer.from('\r\n', 'binary'),
      COMMANDS.FEED(4), COMMANDS.CUT,
    ]);
    return await printToWindowsPrinterUSB(buffer, printerName);
  } catch (err) {
    logger.error(`printStoreRoomReceipt error: ${err.message}`);
    return { success: false, error: err.message };
  }
};

// ── 3. DELIVERY NOTE — vehicle no + items + qty ──────────────────────────────
const formatDeliveryNote = (sale, vehicleNo) => {
  const date = new Date(sale.sale_datetime || sale.createdAt || Date.now());
  const L = [];
  const nl = (t = '') => L.push(t);

  printHeaderLines().forEach(nl);
  nl(divider(WIDTH, '='));
  nl(center('DELIVERY NOTE'));
  nl(divider(WIDTH, '='));
  nl(leftRight('SALE NO:', sale.sale_no || 'N/A'));
  nl(leftRight('DATE:', date.toLocaleDateString('en-LK')));
  nl(leftRight('CUSTOMER:', sale.customer_id?.name || 'N/A'));
  nl(leftRight('VEHICLE NO:', vehicleNo || 'N/A'));
  nl(divider());
  nl(center('ITEMS'));
  nl(divider());

  (sale.items || []).forEach((item) => {
    nl(leftRight(packLabel(item), `Qty: ${item.qty}`));
  });

  nl(divider(WIDTH, '='));
  nl(center('Driver Signature: __________'));
  nl(center('Received By:      __________'));
  nl('');
  nl('');

  return L.join('\r\n');
};

const printDeliveryNote = async (sale, vehicleNo, options = {}) => {
  logger.info(`printDeliveryNote: ${sale?.sale_no || 'N/A'} vehicle=${vehicleNo}`);
  try {
    const printerName = options.printerName || '80 Printer Series';
    const text = formatDeliveryNote(sale, vehicleNo);
    const buffer = Buffer.concat([
      COMMANDS.INIT, COMMANDS.ALIGN(0),
      Buffer.from(text, 'binary'), Buffer.from('\r\n', 'binary'),
      COMMANDS.FEED(4), COMMANDS.CUT,
    ]);
    return await printToWindowsPrinterUSB(buffer, printerName);
  } catch (err) {
    logger.error(`printDeliveryNote error: ${err.message}`);
    return { success: false, error: err.message };
  }
};

// ── 4. DUE PAYMENT SLIP (Credit Payments page) ───────────────────────────────
const formatDueSlip = ({ sale, customer, totalPaid, balanceDue }) => {
  const L = [];
  const nl = (t = '') => L.push(t);

  printHeaderLines().forEach(nl);
  nl(divider(WIDTH, '='));
  nl(center('DUE PAYMENT SLIP'));
  nl(divider(WIDTH, '='));
  nl(leftRight('SALE NO:', sale.sale_no || 'N/A'));
  nl(leftRight('DATE:', new Date(sale.sale_datetime).toLocaleDateString('en-LK')));
  nl(leftRight('CUSTOMER:', customer?.name || 'N/A'));
  nl(leftRight('CODE:', customer?.customer_code || 'N/A'));
  nl(divider());
  nl(leftRight('INVOICE TOTAL:', 'LKR ' + safeToFixed(sale.total_revenue)));
  nl(leftRight('PAID SO FAR:', 'LKR ' + safeToFixed(totalPaid)));
  nl(divider(WIDTH, '='));
  nl(leftRight('BALANCE DUE:', 'LKR ' + safeToFixed(balanceDue)));
  nl(divider(WIDTH, '='));
  nl(center('Please settle at your earliest'));
  nl(center('convenience. Thank you!'));
  nl('');
  nl('');

  return L.join('\r\n');
};
// ── DUE SLIP AS A REAL PDF (for WhatsApp) ────────────────────────────────
// The existing printDueSlip()/formatDueSlip() above produce raw ESC/POS
// text for the physical thermal printer - that's not a usable document for
// WhatsApp. This builds an actual A4 PDF with the same figures, styled like
// invoicePrinter.service.js's invoice, and returns it as a Buffer.
function buildDueSlipPdf({ sale, customer, totalPaid, balanceDue }) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(COMPANY_NAME.toUpperCase(), { align: 'center' });
    doc.fontSize(10).text(COMPANY_ADDRESS, { align: 'center' });
    doc.text(COMPANY_EMAIL, { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text('Due Payment Slip', { align: 'center' });
    doc.moveDown();

    doc.fontSize(10);
    doc.text(`Sale No: ${sale.sale_no || 'N/A'}`);
    doc.text(`Date: ${new Date(sale.sale_datetime).toLocaleDateString('en-LK')}`);
    doc.text(`Customer: ${customer?.name || 'N/A'} (${customer?.customer_code || ''})`);
    doc.moveDown();

    doc.moveTo(50, doc.y).lineTo(530, doc.y).stroke();
    doc.moveDown(0.5);

    doc.font('Helvetica').fontSize(11);
    doc.text(`Invoice Total:`, 50, doc.y, { continued: true, width: 300 });
    doc.text(`LKR ${safeToFixed(sale.total_revenue)}`, { align: 'right' });
    doc.text(`Paid So Far:`, 50, doc.y, { continued: true, width: 300 });
    doc.text(`LKR ${safeToFixed(totalPaid)}`, { align: 'right' });

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(530, doc.y).stroke();
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').fontSize(13);
    doc.text(`Balance Due:`, 50, doc.y, { continued: true, width: 300 });
    doc.text(`LKR ${safeToFixed(balanceDue)}`, { align: 'right' });

    doc.moveDown(1.5);
    doc.font('Helvetica').fontSize(10).text('Please settle at your earliest convenience. Thank you!', { align: 'center' });

    doc.end();
  });
}

async function generateDueSlipPdfBuffer({ sale, customer, payment, balanceDue }) {
  const totalPaid = payment
    ? balanceDue + Number(payment.amount) // reconstruct running total from this payment + remaining balance
    : (sale.total_revenue - balanceDue);
  return buildDueSlipPdf({ sale, customer, totalPaid, balanceDue });
}
const printDueSlip = async (data, options = {}) => {
  logger.info(`printDueSlip: ${data?.sale?.sale_no || 'N/A'}`);
  try {
    const printerName = options.printerName || '80 Printer Series';
    const text = formatDueSlip(data);
    const buffer = Buffer.concat([
      COMMANDS.INIT, COMMANDS.ALIGN(0),
      Buffer.from(text, 'binary'), Buffer.from('\r\n', 'binary'),
      COMMANDS.FEED(4), COMMANDS.CUT,
    ]);
    return await printToWindowsPrinterUSB(buffer, printerName);
  } catch (err) {
    logger.error(`printDueSlip error: ${err.message}`);
    return { success: false, error: err.message };
  }
};

// ── RAW PRINT via inline C# (silent, no dialog) ─────────────────────────────
const printRawWithCSharp = (textOrBuffer, printerName) => {
  return new Promise((resolve, reject) => {
    const tempDir = path.join(__dirname, '../../tmp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const dataFile = path.join(tempDir, `receipt_${Date.now()}.bin`);
    const buf = Buffer.isBuffer(textOrBuffer) ? textOrBuffer : Buffer.from(textOrBuffer, 'binary');
    fs.writeFileSync(dataFile, buf);

    const safePrinter = printerName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const safeDataFile = dataFile.replace(/\\/g, '\\\\');

    const psScript = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class RawPrinterHelper {
    [DllImport("winspool.drv", CharSet=CharSet.Auto, SetLastError=true)]
    static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.drv", SetLastError=true)]
    static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError=true)]
    static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError=true)]
    static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError=true)]
    static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError=true)]
    static extern bool WritePrinter(IntPtr hPrinter, byte[] buf, int len, out int written);

    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    struct DOCINFO {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDatatype;
    }

    [DllImport("winspool.drv", EntryPoint="StartDocPrinterW", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern int StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFO di);

    public static string Send(string printer, byte[] data) {
        IntPtr h = IntPtr.Zero;
        if (!OpenPrinter(printer, out h, IntPtr.Zero)) {
            int err = Marshal.GetLastWin32Error();
            return "OPEN_FAILED:" + err;
        }
        try {
            var di = new DOCINFO { pDocName="Receipt", pOutputFile=null, pDatatype="RAW" };
            int jobId = StartDocPrinter(h, 1, ref di);
            if (jobId == 0) {
                int err = Marshal.GetLastWin32Error();
                return "STARTDOC_FAILED:" + err;
            }
            StartPagePrinter(h);
            int w = 0;
            bool wrote = WritePrinter(h, data, data.Length, out w);
            EndPagePrinter(h);
            EndDocPrinter(h);
            if (!wrote || w != data.Length) return "WRITE_FAILED";
            return "OK";
        } finally { ClosePrinter(h); }
    }
}
'@

$bytes  = [System.IO.File]::ReadAllBytes('${safeDataFile}')
$result = [RawPrinterHelper]::Send('${safePrinter}', $bytes)
if ($result -eq 'OK') { Write-Output 'PRINT_OK' } else { Write-Error "PRINT_FAILED: $result"; exit 1 }
`;

    const psFile = path.join(tempDir, `ps_${Date.now()}.ps1`);
    fs.writeFileSync(psFile, psScript, 'utf8');
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`;

    exec(cmd, { timeout: 25000 }, (error, stdout, stderr) => {
      setTimeout(() => {
        try { fs.unlinkSync(dataFile); } catch (_) {}
        try { fs.unlinkSync(psFile); } catch (_) {}
      }, 3000);

      if (error) {
        logger.error(`RAW C# error: ${error.message}`);
        reject(new Error(error.message));
        return;
      }
      if (stderr && stderr.trim()) logger.warn(`PS stderr: ${stderr.trim()}`);
      if (stdout.includes('PRINT_OK')) {
        resolve({ success: true, method: 'raw_csharp_winspool' });
      } else {
        reject(new Error('No PRINT_OK: ' + stdout.trim()));
      }
    });
  });
};

const printToWindowsPrinterUSB = async (data, printerName) => {
  try {
    return await printRawWithCSharp(data, printerName);
  } catch (err) {
    logger.warn(`USB raw print failed: ${err.message}`);
    return { success: false, error: err.message };
  }
};

const testPrinter = async (options = {}) => {
  const printerName = options.printerName || '80 Printer Series';
  const text = center('PRINTER TEST') + '\r\n' + center(new Date().toLocaleString('en-LK'));
  const buffer = Buffer.concat([COMMANDS.INIT, Buffer.from(text, 'binary'), COMMANDS.FEED(4), COMMANDS.CUT]);
  return printToWindowsPrinterUSB(buffer, printerName);
};
// ── CUSTOMER-LEVEL DUE SLIP (all pending sales) ──────────────────────────────
const formatCustomerDueSlip = ({ customer, summaries }) => {
  const L = [];
  const nl = (t = '') => L.push(t);

  printHeaderLines().forEach(nl);
  nl(divider(WIDTH, '='));
  nl(center('OVERALL DUE SLIP'));
  nl(divider(WIDTH, '='));
  nl(leftRight('CUSTOMER:', customer?.name || 'N/A'));
  nl(leftRight('CODE:', customer?.customer_code || 'N/A'));
  nl(leftRight('DATE:', new Date().toLocaleDateString('en-LK')));
  nl(divider());
  nl(center('PENDING SALES'));
  nl(divider());

  let totalInvoice = 0;
  let totalPaid = 0;
  let totalBalance = 0;

  summaries.forEach((s) => {
    nl(leftRight(s.sale.sale_no, new Date(s.sale.sale_datetime).toLocaleDateString('en-LK')));
    nl(leftRight('  Invoice:', 'LKR ' + safeToFixed(s.sale.total_revenue)));
    nl(leftRight('  Paid:', 'LKR ' + safeToFixed(s.totalPaid)));
    nl(leftRight('  Balance:', 'LKR ' + safeToFixed(s.balanceDue)));
    nl(divider(WIDTH, '.'));
    totalInvoice += s.sale.total_revenue;
    totalPaid += s.totalPaid;
    totalBalance += s.balanceDue;
  });

  nl(divider(WIDTH, '='));
  nl(leftRight('TOTAL INVOICED:', 'LKR ' + safeToFixed(totalInvoice)));
  nl(leftRight('TOTAL PAID:', 'LKR ' + safeToFixed(totalPaid)));
  nl(divider(WIDTH, '='));
  nl(leftRight('TOTAL DUE:', 'LKR ' + safeToFixed(totalBalance)));
  nl(divider(WIDTH, '='));
  nl(center('Please settle at your earliest'));
  nl(center('convenience. Thank you!'));
  nl('');
  nl('');

  return L.join('\r\n');
};

const printCustomerDueSlip = async (data, options = {}) => {
  logger.info(`printCustomerDueSlip: ${data?.customer?.name || 'N/A'}`);
  try {
    const printerName = options.printerName || '80 Printer Series';
    const text = formatCustomerDueSlip(data);
    const buffer = Buffer.concat([
      COMMANDS.INIT, COMMANDS.ALIGN(0),
      Buffer.from(text, 'binary'), Buffer.from('\r\n', 'binary'),
      COMMANDS.FEED(4), COMMANDS.CUT,
    ]);
    return await printToWindowsPrinterUSB(buffer, printerName);
  } catch (err) {
    logger.error(`printCustomerDueSlip error: ${err.message}`);
    return { success: false, error: err.message };
  }
};
const INK = '#141414';
const INK_SOFT = '#3C3C3C';
const GRAY = '#6E6E6E';
const GRAY_LIGHT = '#828282';
const LINE = '#D2D2D2';
const PAID_COLOR = '#16A34A';
const DUE_COLOR = '#B41414';
const PAID_FILL = '#F0FDF4';
const DUE_FILL = '#FEF2F2';

const fmt = (value) =>
  Number(value ?? 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDateTime = (d) =>
  new Date(d).toLocaleString('en-LK', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

const formatDateOnly = (d) =>
  new Date(d).toLocaleDateString('en-LK', { day: '2-digit', month: 'short', year: 'numeric' });

function buildDueSlipPdfFile({ sale, customer, payment, totalPaid, balanceDue, isFullyPaid }) {
  return new Promise((resolve, reject) => {
    const tempDir = path.join(__dirname, '../../tmp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const filePath = path.join(tempDir, `payment_${payment?.payment_no || sale.sale_no}_${Date.now()}.pdf`);

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const mL = 40;
    const pageW = doc.page.width;
    const rEdge = pageW - 40;

    // ── Header ──────────────────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(13.5).fillColor(INK);
    doc.text(COMPANY_NAME, mL, 40);

    doc.fontSize(24);
    doc.text(isFullyPaid ? 'PAYMENT RECEIPT' : 'PAYMENT SLIP', mL, 36, { width: rEdge - mL, align: 'right' });

    doc.font('Helvetica').fontSize(9).fillColor(GRAY);
    doc.text(COMPANY_ADDRESS, mL, 55);
    doc.text(COMPANY_EMAIL, mL, 67);

    doc.fillColor(INK_SOFT);
    doc.text(`# ${sale.sale_no}`, mL, 58, { width: rEdge - mL, align: 'right' });

    doc.font('Helvetica-Bold').fontSize(9);
    doc.text(isFullyPaid ? 'Status' : 'Balance Due', mL, 74, { width: rEdge - mL, align: 'right' });
    doc.fontSize(13).fillColor(isFullyPaid ? PAID_COLOR : DUE_COLOR);
    doc.text(
      isFullyPaid ? 'FULLY PAID' : `LKR ${fmt(balanceDue)}`,
      mL, 88, { width: rEdge - mL, align: 'right' }
    );

    doc.moveTo(mL, 100).lineTo(rEdge, 100).lineWidth(0.5).strokeColor(LINE).stroke();

    // ── Bill To + Meta ───────────────────────────────────────────────────────
    const b2Y = 116;
    doc.font('Helvetica').fontSize(8.5).fillColor(GRAY_LIGHT);
    doc.text('Customer', mL, b2Y);

    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK);
    doc.text(customer?.name || 'N/A', mL, b2Y + 13);

    let leftEndY = b2Y + 13;
    if (customer?.customer_code) {
      doc.font('Helvetica').fontSize(9).fillColor(INK_SOFT);
      doc.text(customer.customer_code, mL, b2Y + 27);
      leftEndY = b2Y + 27;
    }

    const metaRows = [
      ['Sale Date :', formatDateOnly(sale.sale_datetime)],
      ['Payment No :', payment?.payment_no || 'N/A'],
      // ── Payment date AND time ──
      ['Payment Date/Time :', payment ? formatDateTime(payment.payment_date) : 'N/A'],
    ];
    doc.font('Helvetica').fontSize(9);
    metaRows.forEach(([label, value], i) => {
      const ry = b2Y + i * 16;
      doc.fillColor(GRAY).text(label, mL, ry, { width: 300, align: 'right' });
      doc.fillColor(INK_SOFT).text(value, mL, ry, { width: rEdge - mL, align: 'right' });
    });

    // ── Payment amount highlight box ────────────────────────────────────────
    let y = Math.max(leftEndY, b2Y + 3 * 16) + 22;
    const boxW = rEdge - mL;
    const boxH = 40;

    doc.rect(mL, y, boxW, boxH).fill(payment ? PAID_FILL : '#F5F5F5');
    doc.font('Helvetica').fontSize(9).fillColor(GRAY);
    doc.text('Amount Received', mL + 16, y + 8);
    doc.font('Helvetica-Bold').fontSize(16).fillColor(PAID_COLOR);
    doc.text(`LKR ${fmt(payment?.amount)}`, mL + 16, y + 19);

    doc.font('Helvetica').fontSize(9).fillColor(GRAY);
    doc.text('Received', mL, y + 8, { width: boxW - 16, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(INK_SOFT);
    doc.text(payment ? formatDateTime(payment.payment_date) : '—', mL, y + 21, { width: boxW - 16, align: 'right' });

    y += boxH + 18;

    // ── Totals block ─────────────────────────────────────────────────────────
    const totLblW = 130, totValW = 110;
    const totLeft = rEdge - totLblW - totValW;
    const totRowH = 20;

    const totalsRows = [
      { label: 'Invoice Total', value: `LKR ${fmt(sale.total_revenue)}`, fill: '#FFFFFF', color: INK_SOFT, bold: false },
      { label: 'Total Paid So Far', value: `LKR ${fmt(totalPaid)}`, fill: PAID_FILL, color: PAID_COLOR, bold: false },
      {
        label: isFullyPaid ? 'Status' : 'Balance Due',
        value: isFullyPaid ? 'FULLY PAID' : `LKR ${fmt(balanceDue)}`,
        fill: isFullyPaid ? PAID_FILL : DUE_FILL,
        color: isFullyPaid ? PAID_COLOR : DUE_COLOR,
        bold: true,
      },
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
      isFullyPaid
        ? 'Thank you for settling this order in full!'
        : 'Please settle the remaining balance at your earliest convenience. Thank you!',
      mL, y + 27
    );

    doc.end();
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}
module.exports = {
  formatSaleReceipt, printSale,
  formatStoreRoomReceipt, printStoreRoomReceipt,
  formatDeliveryNote, printDeliveryNote,
  formatDueSlip, printDueSlip,
  formatCustomerDueSlip, printCustomerDueSlip,   
  testPrinter, printToWindowsPrinterUSB,
  buildBarcodeCode39, COMMANDS, safeToFixed,
  buildDueSlipPdf, generateDueSlipPdfBuffer, 
  buildDueSlipPdfFile,
};