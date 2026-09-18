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

function buildInvoicePdf(sale, customer) {
  return new Promise((resolve, reject) => {
    const tempDir = path.join(__dirname, '../../tmp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const filePath = path.join(tempDir, `invoice_${sale.sale_no}_${Date.now()}.pdf`);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(18).text('MATHEESHA FLOUR MILL', { align: 'center' });
    doc.fontSize(10).text('Kurunegala District, Sri Lanka', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Invoice - ${sale.sale_no}`, { align: 'center' });
    doc.moveDown();

    doc.fontSize(10);
    doc.text(`Date: ${new Date(sale.sale_datetime).toLocaleString('en-LK')}`);
    doc.text(`Customer: ${customer?.name || 'N/A'} (${customer?.customer_code || ''})`);
    doc.text(`Payment: ${sale.payment_method}`);
    doc.moveDown();

    const startY = doc.y;
    doc.font('Helvetica-Bold');
    doc.text('Item', 50, startY, { width: 220 });
    doc.text('Qty', 280, startY, { width: 60, align: 'right' });
    doc.text('Unit Price', 340, startY, { width: 90, align: 'right' });
    doc.text('Total', 440, startY, { width: 90, align: 'right' });
    doc.font('Helvetica');
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(530, doc.y).stroke();
    doc.moveDown(0.3);

    (sale.items || []).forEach(item => {
      const pack = item.pack_type_id;
      const label = typeof pack === 'object' ? `${pack.pack_name} (${pack.weight_kg}kg)` : 'Item';
      const y = doc.y;
      doc.text(label, 50, y, { width: 220 });
      doc.text(String(item.qty), 280, y, { width: 60, align: 'right' });
      doc.text(`LKR ${Number(item.unit_price_sold).toFixed(2)}`, 340, y, { width: 90, align: 'right' });
      doc.text(`LKR ${Number(item.line_revenue).toFixed(2)}`, 440, y, { width: 90, align: 'right' });
      doc.moveDown(0.6);
    });

    doc.moveTo(50, doc.y).lineTo(530, doc.y).stroke();
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(12)
      .text(`TOTAL: LKR ${Number(sale.total_revenue).toFixed(2)}`, { align: 'right' });

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

module.exports = { buildInvoicePdf, printInvoiceSilently };