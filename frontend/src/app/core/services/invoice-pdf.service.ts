// src/app/core/services/invoice-pdf.service.ts
import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale } from '../models/sale';
import { Customer } from '../models/customer';
import { SaleCreditSummary } from '../models/payment.model';

@Injectable({ providedIn: 'root' })
export class InvoicePdfService {

  // ════════════════════════════════════════════════════════════════════════════
  // STANDARD INVOICE  (sale-list download)
  // ════════════════════════════════════════════════════════════════════════════
  generate(sale: Sale, customer: Customer): void {
    const doc = new jsPDF('p', 'pt', 'a4');
    const pageW = doc.internal.pageSize.getWidth();
    const mL = 40, mR = 40, rEdge = pageW - mR;
    const invoiceDate = this.formatDate(sale.saleDatetime);

    // ── Header ──────────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5); doc.setTextColor(20, 20, 20);
    doc.text('Matheesha Flour Mill', mL, 55);

    doc.setFontSize(30);
    doc.text('INVOICE', rEdge, 55, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9); doc.setTextColor(110, 110, 110);
    doc.text('North Central Province', mL, 69);
    doc.text('SriLanka', mL, 81);
    doc.text('matheeshaflourmill@gmail.com', mL, 93);

    doc.setTextColor(60, 60, 60);
    doc.text(`# ${sale.saleNo}`, rEdge, 71, { align: 'right' });

    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('Balance Due', rEdge, 89, { align: 'right' });
    doc.setFontSize(13); doc.setTextColor(20, 20, 20);
    doc.text(`LKR${this.fmt(sale.totalRevenue)}`, rEdge, 104, { align: 'right' });

    this.drawDivider(doc, mL, rEdge, 116);

    // ── Bill To + Meta ───────────────────────────────────────────────────────
    const b2Y = 134;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(130, 130, 130);
    doc.text('Bill To', mL, b2Y);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(20, 20, 20);
    doc.text(customer.name, mL, b2Y + 14);

    let addrEndY = b2Y + 14;
    const rawAddress = (customer.address as string | undefined | null) ?? '';
    if (rawAddress.trim()) {
      const wrapped = doc.splitTextToSize(rawAddress.trim(), 260);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
      wrapped.forEach((line: string, i: number) => {
        addrEndY = b2Y + 14 + 13 * (i + 1);
        doc.text(line, mL, addrEndY);
      });
    }

    const metaRows = [
      { label: 'Invoice Date :', value: invoiceDate },
      { label: 'Terms :', value: 'Due on Receipt' },
      { label: 'Due Date :', value: invoiceDate },
    ];
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    metaRows.forEach((row, i) => {
      const ry = b2Y + i * 18;
      doc.setTextColor(100, 100, 100); doc.text(row.label, 460, ry, { align: 'right' });
      doc.setTextColor(30, 30, 30);   doc.text(row.value,  rEdge, ry, { align: 'right' });
    });

    // ── Items table ──────────────────────────────────────────────────────────
    const tableStartY = Math.max(addrEndY, b2Y + 2 * 18) + 22;
    const tableW = rEdge - mL;
    const cNo = 26, cRate = 82, cAmt = 88, cQty = 54;
    const cDesc = tableW - cNo - cQty - cRate - cAmt;

    autoTable(doc, {
      head: [['#', 'Item & Description', 'Qty', 'Rate', 'Amount']],
      body: sale.items.map((item: any, i: number) => [
        `${i + 1}`,
        `${item.packName ?? ''}${item.weightKg != null ? ' - ' + item.weightKg + 'kg' : ''}`,
        `${this.fmtQty(item.qty ?? 0)}\npcs`,
        this.fmt(item.unitPriceSold ?? 0),
        this.fmt(item.lineRevenue ?? 0),
      ]),
      startY: tableStartY,
      theme: 'grid',
      headStyles: {
        fillColor: [26, 26, 26], textColor: [255, 255, 255],
        fontStyle: 'bold', fontSize: 9,
        cellPadding: { top: 7, bottom: 7, left: 6, right: 6 },
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: cNo,   fontSize: 9.5 },
        1: { halign: 'left',   cellWidth: cDesc,  fontSize: 9.5 },
        2: { halign: 'center', cellWidth: cQty,   fontSize: 9.5 },
        3: { halign: 'right',  cellWidth: cRate,  fontSize: 9.5 },
        4: { halign: 'right',  cellWidth: cAmt,   fontSize: 9.5 },
      },
      bodyStyles: {
        textColor: [40, 40, 40], fillColor: [255, 255, 255],
        cellPadding: { top: 6, bottom: 6, left: 6, right: 6 },
      },
      styles: { lineColor: [200, 200, 200], lineWidth: 0.4, overflow: 'linebreak' },
      margin: { left: mL, right: mR },
    });

    const afterTable = (doc as any).lastAutoTable.finalY;

    // ── Totals ───────────────────────────────────────────────────────────────
    const totLblW = 110, totValW = 110;
    const totLeft = rEdge - totLblW - totValW;

    autoTable(doc, {
      body: [
        [
          { content: 'Sub Total', styles: { halign: 'right', fontStyle: 'normal', textColor: [80, 80, 80],  fillColor: [255, 255, 255] } },
          { content: this.fmt(sale.totalRevenue), styles: { halign: 'right', textColor: [40, 40, 40], fillColor: [255, 255, 255] } },
        ],
        [
          { content: 'Total', styles: { halign: 'right', fontStyle: 'bold', textColor: [20, 20, 20], fillColor: [255, 255, 255] } },
          { content: `LKR${this.fmt(sale.totalRevenue)}`, styles: { halign: 'right', fontStyle: 'bold', textColor: [20, 20, 20], fillColor: [255, 255, 255] } },
        ],
        [
          { content: 'Balance Due', styles: { halign: 'right', fontStyle: 'bold', textColor: [20, 20, 20], fillColor: [238, 238, 238] } },
          { content: `LKR${this.fmt(sale.totalRevenue)}`, styles: { halign: 'right', fontStyle: 'bold', textColor: [20, 20, 20], fillColor: [238, 238, 238] } },
        ],
      ],
      startY: afterTable + 2,
      theme: 'plain',
      styles: { fontSize: 9.5, lineWidth: 0, cellPadding: { top: 5, bottom: 5, left: 8, right: 8 } },
      columnStyles: { 0: { cellWidth: totLblW }, 1: { cellWidth: totValW } },
      margin: { left: totLeft, right: mR },
    });

    const afterTotals = (doc as any).lastAutoTable.finalY;

    // ── Notes ────────────────────────────────────────────────────────────────
    const notesY = afterTotals + 22;
    this.drawDivider(doc, mL, rEdge, notesY);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(70, 70, 70);
    doc.text('Notes', mL, notesY + 15);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
    doc.text('Thanks for your business.', mL, notesY + 28);

    doc.save(`Invoice-${sale.saleNo}.pdf`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DUE INVOICE  (single sale — shows outstanding balance + payment history)
  // ════════════════════════════════════════════════════════════════════════════
  generateDueInvoice(summary: SaleCreditSummary): void {
    const doc = new jsPDF('p', 'pt', 'a4');
    const pageW = doc.internal.pageSize.getWidth();
    const mL = 40, mR = 40, rEdge = pageW - mR;
    const { sale } = summary;
    const invoiceDate = this.formatDate(sale.saleDatetime);

    // ── Header ───────────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13.5); doc.setTextColor(20, 20, 20);
    doc.text('Matheesha Flour Mill', mL, 55);
    doc.setFontSize(30);
    doc.text('DUE INVOICE', rEdge, 55, { align: 'right' });

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110, 110, 110);
    doc.text('North Central Province', mL, 69);
    doc.text('SriLanka', mL, 81);
    doc.text('matheeshaflourmill@gmail.com', mL, 93);

    doc.setTextColor(60, 60, 60);
    doc.text(`# ${sale.saleNo}`, rEdge, 71, { align: 'right' });

    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('Balance Due', rEdge, 89, { align: 'right' });
    doc.setFontSize(13); doc.setTextColor(180, 20, 20);
    doc.text(`LKR${this.fmt(summary.balanceDue)}`, rEdge, 104, { align: 'right' });

    this.drawDivider(doc, mL, rEdge, 116);

    // ── Bill To + Meta ───────────────────────────────────────────────────────
    const b2Y = 134;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(130, 130, 130);
    doc.text('Bill To', mL, b2Y);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(20, 20, 20);
    doc.text(sale.customerName, mL, b2Y + 14);

    let addrEndY = b2Y + 14;
    if (sale.customerAddress?.trim()) {
      const wrapped = doc.splitTextToSize(sale.customerAddress.trim(), 260);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
      wrapped.forEach((line: string, i: number) => {
        addrEndY = b2Y + 14 + 13 * (i + 1);
        doc.text(line, mL, addrEndY);
      });
    }
    if (sale.customerPhone) {
      addrEndY += 13;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
      doc.text(sale.customerPhone, mL, addrEndY);
    }

    const metaRows = [
      { label: 'Invoice Date :', value: invoiceDate },
      { label: 'Sale No :',      value: sale.saleNo },
      { label: 'Customer Code :', value: sale.customerCode },
      { label: 'Status :', value: summary.isPaid ? 'PAID' : 'PAYMENT DUE' },
    ];
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    metaRows.forEach((row, i) => {
      const ry = b2Y + i * 18;
      doc.setTextColor(100, 100, 100); doc.text(row.label, 460, ry, { align: 'right' });
      doc.setTextColor(30,  30,  30);  doc.text(row.value,  rEdge, ry, { align: 'right' });
    });

    // ── Items table ──────────────────────────────────────────────────────────
    const tableStartY = Math.max(addrEndY, b2Y + 3 * 18) + 22;
    const tableW = rEdge - mL;
    const cNo = 26, cRate = 82, cAmt = 88, cQty = 54;
    const cDesc = tableW - cNo - cQty - cRate - cAmt;

    autoTable(doc, {
      head: [['#', 'Item & Description', 'Qty', 'Rate', 'Amount']],
      body: sale.items.map((item, i) => [
        `${i + 1}`,
        `${item.packName}${item.weightKg != null ? ' - ' + item.weightKg + 'kg' : ''}`,
        `${this.fmtQty(item.qty)}\npcs`,
        this.fmt(item.unitPriceSold),
        this.fmt(item.lineRevenue),
      ]),
      startY: tableStartY,
      theme: 'grid',
      headStyles: {
        fillColor: [26, 26, 26], textColor: [255, 255, 255],
        fontStyle: 'bold', fontSize: 9,
        cellPadding: { top: 7, bottom: 7, left: 6, right: 6 },
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: cNo },
        1: { halign: 'left',   cellWidth: cDesc },
        2: { halign: 'center', cellWidth: cQty },
        3: { halign: 'right',  cellWidth: cRate },
        4: { halign: 'right',  cellWidth: cAmt },
      },
      bodyStyles: {
        textColor: [40, 40, 40], fillColor: [255, 255, 255],
        cellPadding: { top: 6, bottom: 6, left: 6, right: 6 },
      },
      styles: { lineColor: [200, 200, 200], lineWidth: 0.4, overflow: 'linebreak', fontSize: 9.5 },
      margin: { left: mL, right: mR },
    });

    let y = (doc as any).lastAutoTable.finalY;

    // ── Totals ───────────────────────────────────────────────────────────────
    const totLblW = 110, totValW = 110;
    const totLeft = rEdge - totLblW - totValW;

    autoTable(doc, {
      body: [
        [
          { content: 'Invoice Total',
            styles: { halign: 'right', fontStyle: 'normal', textColor: [80, 80, 80],  fillColor: [255, 255, 255] } },
          { content: `LKR${this.fmt(sale.totalRevenue)}`,
            styles: { halign: 'right', textColor: [40, 40, 40], fillColor: [255, 255, 255] } },
        ],
        [
          { content: 'Amount Paid',
            styles: { halign: 'right', textColor: [22, 163, 74], fillColor: [240, 253, 244] } },
          { content: `LKR${this.fmt(summary.totalPaid)}`,
            styles: { halign: 'right', textColor: [22, 163, 74], fillColor: [240, 253, 244] } },
        ],
        [
          { content: 'Balance Due',
            styles: { halign: 'right', fontStyle: 'bold', textColor: [180, 20, 20], fillColor: [254, 242, 242] } },
          { content: `LKR${this.fmt(summary.balanceDue)}`,
            styles: { halign: 'right', fontStyle: 'bold', textColor: [180, 20, 20], fillColor: [254, 242, 242] } },
        ],
      ],
      startY: y + 2,
      theme: 'plain',
      styles: { fontSize: 9.5, lineWidth: 0, cellPadding: { top: 5, bottom: 5, left: 8, right: 8 } },
      columnStyles: { 0: { cellWidth: totLblW }, 1: { cellWidth: totValW } },
      margin: { left: totLeft, right: mR },
    });

    y = (doc as any).lastAutoTable.finalY;

    // ── Payment History (separate table — only if payments exist) ────────────
    if (summary.payments.length > 0) {
      y += 18;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(50, 50, 50);
      doc.text('Payment History', mL, y);
      y += 6;

      autoTable(doc, {
        head: [['Payment No', 'Date', 'Amount', 'Notes']],
        body: summary.payments.map(p => [
          p.paymentNo,
          this.formatDate(p.paymentDate),
          `LKR${this.fmt(p.amount)}`,
          p.notes ?? '—',
        ]),
        startY: y,
        theme: 'grid',
        headStyles: {
          fillColor: [50, 50, 50], textColor: [255, 255, 255],
          fontStyle: 'bold', fontSize: 8.5,
          cellPadding: { top: 6, bottom: 6, left: 6, right: 6 },
        },
        columnStyles: {
          0: { halign: 'left',  fontSize: 8.5 },
          1: { halign: 'left',  fontSize: 8.5 },
          2: { halign: 'right', fontSize: 8.5, textColor: [22, 163, 74] },
          3: { halign: 'left',  fontSize: 8.5, textColor: [100, 100, 100] },
        },
        bodyStyles: {
          textColor: [40, 40, 40], fillColor: [255, 255, 255],
          cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
        },
        styles: { lineColor: [220, 220, 220], lineWidth: 0.3 },
        margin: { left: mL, right: mR },
      });

      y = (doc as any).lastAutoTable.finalY;
    }

    // ── Notes footer ─────────────────────────────────────────────────────────
    y += 22;
    this.drawDivider(doc, mL, rEdge, y);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(70, 70, 70);
    doc.text('Notes', mL, y + 15);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
    doc.text(
      'Thanks for your business. Please settle the outstanding balance at your earliest convenience.',
      mL, y + 28,
    );

    doc.save(`DueInvoice-${sale.saleNo}.pdf`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PROFORMA  (single sale — invoice + separate payment history table)
  // ════════════════════════════════════════════════════════════════════════════
  generateProforma(summary: SaleCreditSummary): void {
    const doc = new jsPDF('p', 'pt', 'a4');
    const pageW = doc.internal.pageSize.getWidth();
    const mL = 40, mR = 40, rEdge = pageW - mR;
    const { sale } = summary;

    // ── Header ───────────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13.5); doc.setTextColor(20, 20, 20);
    doc.text('Matheesha Flour Mill', mL, 55);
    doc.setFontSize(24);
    doc.text('PROFORMA', rEdge, 55, { align: 'right' });

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110, 110, 110);
    doc.text('North Central Province', mL, 69);
    doc.text('SriLanka', mL, 81);
    doc.text('matheeshaflourmill@gmail.com', mL, 93);

    doc.setTextColor(60, 60, 60);
    doc.text('Ref: ' + sale.saleNo, rEdge, 71, { align: 'right' });
    doc.text('Date: ' + this.formatDate(new Date().toISOString()), rEdge, 85, { align: 'right' });

    this.drawDivider(doc, mL, rEdge, 104);

    // ── Customer Information ─────────────────────────────────────────────────
    let y = 120;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20, 20, 20);
    doc.text('Customer Information', mL, y);
    y += 4;
    doc.setDrawColor(26, 26, 26); doc.setLineWidth(1);
    doc.line(mL, y, mL + 150, y);
    y += 14;

    const custFields: [string, string][] = [
      ['Name',    sale.customerName],
      ['Code',    sale.customerCode],
      ['Address', sale.customerAddress || '—'],
      ['Phone',   sale.customerPhone   || '—'],
    ];
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    custFields.forEach(([label, val]) => {
      doc.setTextColor(100, 100, 100); doc.text(label + ':', mL, y);
      doc.setTextColor(20,  20,  20);  doc.text(val, mL + 70, y);
      y += 14;
    });

    y += 6;
    this.drawDivider(doc, mL, rEdge, y);
    y += 16;

    // ── Sale Details heading ─────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20, 20, 20);
    doc.text('Sale Details — ' + sale.saleNo, mL, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100, 100, 100);
    doc.text('Date: ' + this.formatDate(sale.saleDatetime), rEdge, y, { align: 'right' });
    y += 14;

    // ── Items table ──────────────────────────────────────────────────────────
    const tableW = rEdge - mL;
    const cNo = 26, cRate = 82, cAmt = 88, cQty = 54;
    const cDesc = tableW - cNo - cQty - cRate - cAmt;

    autoTable(doc, {
      head: [['#', 'Item & Description', 'Qty', 'Unit Price', 'Amount']],
      body: sale.items.map((item, i) => [
        `${i + 1}`,
        `${item.packName}${item.weightKg != null ? ' - ' + item.weightKg + 'kg' : ''}`,
        `${this.fmtQty(item.qty)}\npcs`,
        this.fmt(item.unitPriceSold),
        this.fmt(item.lineRevenue),
      ]),
      startY: y,
      theme: 'grid',
      headStyles: {
        fillColor: [26, 26, 26], textColor: [255, 255, 255],
        fontStyle: 'bold', fontSize: 8.5,
        cellPadding: { top: 6, bottom: 6, left: 5, right: 5 },
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: cNo },
        1: { halign: 'left',   cellWidth: cDesc },
        2: { halign: 'center', cellWidth: cQty },
        3: { halign: 'right',  cellWidth: cRate },
        4: { halign: 'right',  cellWidth: cAmt },
      },
      bodyStyles: {
        textColor: [40, 40, 40], fontSize: 8.5,
        cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
      },
      styles: { lineColor: [200, 200, 200], lineWidth: 0.4 },
      margin: { left: mL, right: mR },
    });

    y = (doc as any).lastAutoTable.finalY + 4;

    // ── Invoice Totals ───────────────────────────────────────────────────────
    const totLblW = 120, totValW = 110;
    const totLeft = rEdge - totLblW - totValW;

    autoTable(doc, {
      body: [
        [
          { content: 'Invoice Total',
            styles: { halign: 'right', textColor: [60, 60, 60], fillColor: [255, 255, 255] } },
          { content: `LKR${this.fmt(sale.totalRevenue)}`,
            styles: { halign: 'right', fontStyle: 'bold', textColor: [20, 20, 20], fillColor: [255, 255, 255] } },
        ],
        [
          { content: 'Amount Paid',
            styles: { halign: 'right', textColor: [22, 163, 74], fillColor: [240, 253, 244] } },
          { content: `(LKR${this.fmt(summary.totalPaid)})`,
            styles: { halign: 'right', textColor: [22, 163, 74], fillColor: [240, 253, 244] } },
        ],
        [
          { content: 'Balance Due',
            styles: { halign: 'right', fontStyle: 'bold', textColor: [180, 20, 20], fillColor: [254, 242, 242] } },
          { content: `LKR${this.fmt(summary.balanceDue)}`,
            styles: { halign: 'right', fontStyle: 'bold', textColor: [180, 20, 20], fillColor: [254, 242, 242] } },
        ],
      ],
      startY: y,
      theme: 'plain',
      styles: { fontSize: 9.5, lineWidth: 0, cellPadding: { top: 5, bottom: 5, left: 8, right: 8 } },
      columnStyles: { 0: { cellWidth: totLblW }, 1: { cellWidth: totValW } },
      margin: { left: totLeft, right: mR },
    });

    y = (doc as any).lastAutoTable.finalY + 20;

    // ── Payment History (separate section) ───────────────────────────────────
    if (summary.payments.length > 0) {
      this.drawDivider(doc, mL, rEdge, y);
      y += 14;

      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20, 20, 20);
      doc.text('Payment History', mL, y);
      y += 4;
      doc.setDrawColor(26, 26, 26); doc.setLineWidth(1);
      doc.line(mL, y, mL + 130, y);
      y += 12;

      autoTable(doc, {
        head: [['Payment No', 'Payment Date', 'Amount Paid', 'Notes', 'Recorded By']],
        body: summary.payments.map(p => [
          p.paymentNo,
          this.formatDate(p.paymentDate),
          `LKR${this.fmt(p.amount)}`,
          p.notes    || '—',
          p.recordedBy || '—',
        ]),
        startY: y,
        theme: 'grid',
        headStyles: {
          fillColor: [50, 50, 50], textColor: [255, 255, 255],
          fontStyle: 'bold', fontSize: 8.5,
          cellPadding: { top: 6, bottom: 6, left: 6, right: 6 },
        },
        columnStyles: {
          0: { halign: 'left',  fontSize: 8.5 },
          1: { halign: 'left',  fontSize: 8.5 },
          2: { halign: 'right', fontSize: 8.5, textColor: [22, 163, 74] },
          3: { halign: 'left',  fontSize: 8.5, textColor: [100, 100, 100] },
          4: { halign: 'left',  fontSize: 8.5, textColor: [100, 100, 100] },
        },
        bodyStyles: {
          textColor: [40, 40, 40], fillColor: [255, 255, 255],
          cellPadding: { top: 6, bottom: 6, left: 6, right: 6 },
        },
        styles: { lineColor: [220, 220, 220], lineWidth: 0.3 },
        margin: { left: mL, right: mR },
      });

      y = (doc as any).lastAutoTable.finalY + 16;

      // ── Running balance mini-table ──────────────────────────────────────────
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
      doc.text('Running Balance', mL, y);
      y += 6;

      const runBody: any[][] = [];
      let remaining = sale.totalRevenue;
      summary.payments.forEach(p => {
        remaining -= p.amount;
        runBody.push([
          p.paymentNo,
          this.formatDate(p.paymentDate),
          `LKR${this.fmt(p.amount)}`,
          `LKR${this.fmt(remaining < 0 ? 0 : remaining)}`,
        ]);
      });

      autoTable(doc, {
        head: [['Payment', 'Date', 'Amount Paid', 'Remaining Balance']],
        body: runBody,
        startY: y,
        theme: 'striped',
        headStyles: {
          fillColor: [245, 245, 245], textColor: [60, 60, 60],
          fontStyle: 'bold', fontSize: 8,
        },
        columnStyles: {
          0: { halign: 'left',  fontSize: 8 },
          1: { halign: 'left',  fontSize: 8 },
          2: { halign: 'right', fontSize: 8, textColor: [22, 163, 74] },
          3: { halign: 'right', fontSize: 8, fontStyle: 'bold', textColor: [180, 20, 20] },
        },
        bodyStyles: { fontSize: 8, cellPadding: { top: 4, bottom: 4, left: 6, right: 6 } },
        styles: { lineColor: [220, 220, 220], lineWidth: 0.3 },
        margin: { left: mL, right: mR },
      });

      y = (doc as any).lastAutoTable.finalY + 16;
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    this.drawDivider(doc, mL, rEdge, y);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(70, 70, 70);
    doc.text('Notes', mL, y + 15);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
    doc.text('This is a proforma document. All amounts are in Sri Lankan Rupees (LKR).', mL, y + 28);
    doc.text('For queries contact: matheeshaflourmill@gmail.com', mL, y + 40);

    doc.save(`Proforma-${sale.saleNo}.pdf`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CUSTOMER DUE INVOICE  (all pending sales — no payment sub-rows)
  //   Each row shows: Invoice Total | Paid So Far | Balance Due
  //   e.g.  Invoice 3,000  →  Paid: 1,500 / 3,000  →  Balance: 1,500
  // ════════════════════════════════════════════════════════════════════════════
  generateCustomerDueInvoice(summaries: SaleCreditSummary[]): void {
    const pending = summaries.filter(s => !s.isPaid);
    if (pending.length === 0) return;

    const doc = new jsPDF('p', 'pt', 'a4');
    const pageW = doc.internal.pageSize.getWidth();
    const mL = 40, mR = 40, rEdge = pageW - mR;

    const first       = pending[0].sale;
    const grandTotal  = pending.reduce((a, s) => a + s.sale.totalRevenue, 0);
    const grandPaid   = pending.reduce((a, s) => a + s.totalPaid, 0);
    const grandBalance = pending.reduce((a, s) => a + s.balanceDue, 0);

    // ── Header ───────────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13.5); doc.setTextColor(20, 20, 20);
    doc.text('Matheesha Flour Mill', mL, 55);
    doc.setFontSize(22);
    doc.text('CUSTOMER DUE INVOICE', rEdge, 55, { align: 'right' });

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110, 110, 110);
    doc.text('North Central Province', mL, 69);
    doc.text('SriLanka', mL, 81);
    doc.text('matheeshaflourmill@gmail.com', mL, 93);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
    doc.text(`Date: ${this.formatDate(new Date().toISOString())}`, rEdge, 71, { align: 'right' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('Total Balance Due', rEdge, 89, { align: 'right' });
    doc.setFontSize(13); doc.setTextColor(180, 20, 20);
    doc.text(`LKR${this.fmt(grandBalance)}`, rEdge, 104, { align: 'right' });

    this.drawDivider(doc, mL, rEdge, 116);

    // ── Bill To + Meta ───────────────────────────────────────────────────────
    const b2Y = 134;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(130, 130, 130);
    doc.text('Bill To', mL, b2Y);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(20, 20, 20);
    doc.text(first.customerName, mL, b2Y + 14);

    let addrEndY = b2Y + 14;
    if (first.customerAddress?.trim()) {
      const wrapped = doc.splitTextToSize(first.customerAddress.trim(), 260);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
      wrapped.forEach((line: string, i: number) => {
        addrEndY = b2Y + 14 + 13 * (i + 1);
        doc.text(line, mL, addrEndY);
      });
    }
    if (first.customerPhone) {
      addrEndY += 13;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
      doc.text(first.customerPhone, mL, addrEndY);
    }

    const metaRows = [
      { label: 'Customer Code :', value: first.customerCode },
      { label: 'Pending Sales :',  value: `${pending.length}` },
      { label: 'Status :',         value: 'PAYMENT DUE' },
    ];
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    metaRows.forEach((row, i) => {
      const ry = b2Y + i * 18;
      doc.setTextColor(100, 100, 100); doc.text(row.label, 460, ry, { align: 'right' });
      doc.setTextColor(30,  30,  30);  doc.text(row.value,  rEdge, ry, { align: 'right' });
    });

    // ── Pending Sales Table ──────────────────────────────────────────────────
    //  Columns: # | Sale No | Date | Items | Invoice Total | Paid / Total | Balance Due
    //  NO payment sub-rows — balance reminder shown inline in "Paid / Total" column
    const tableStartY = Math.max(addrEndY, b2Y + 2 * 18) + 28;

    const bodyRows: any[] = pending.map((summary, idx) => {
      const { sale, totalPaid, balanceDue } = summary;

      // Compact item description
      const itemDesc = sale.items
        .map(it => `${it.packName}${it.weightKg != null ? ' ' + it.weightKg + 'kg' : ''} ×${it.qty}`)
        .join(', ');

      // "Paid / Total" cell — e.g.  "1,500 / 3,000"  or  "—"
      const paidOfTotal = totalPaid > 0
        ? `${this.fmt(totalPaid)} / ${this.fmt(sale.totalRevenue)}`
        : `— / ${this.fmt(sale.totalRevenue)}`;

      return [
        { content: `${idx + 1}`,       styles: { halign: 'center', textColor: [80, 80, 80] } },
        { content: sale.saleNo,         styles: { fontStyle: 'bold', textColor: [20, 20, 20] } },
        { content: this.formatDate(sale.saleDatetime), styles: { textColor: [60, 60, 60] } },
        { content: itemDesc,            styles: { textColor: [60, 60, 60], fontSize: 7.5 } },
        { content: this.fmt(sale.totalRevenue), styles: { halign: 'right', textColor: [40, 40, 40] } },
        // ── "Paid / Total" reminder — green if any paid, gray if none
        { content: paidOfTotal,         styles: { halign: 'right', fontSize: 8, textColor: totalPaid > 0 ? [22, 163, 74] : [160, 160, 160] } },
        // ── Balance Due — always red/bold
        { content: `LKR${this.fmt(balanceDue)}`, styles: { halign: 'right', fontStyle: 'bold', textColor: [180, 20, 20] } },
      ];
    });

    const tableW = rEdge - mL;
    const cIdx = 22, cSaleNo = 66, cDate = 66, cInvTotal = 78, cPaid = 90, cBal = 88;
    const cItems = tableW - cIdx - cSaleNo - cDate - cInvTotal - cPaid - cBal;

    autoTable(doc, {
      head: [['#', 'Sale No', 'Date', 'Items', 'Invoice Total', 'Paid / Total', 'Balance Due']],
      body: bodyRows,
      startY: tableStartY,
      theme: 'grid',
      headStyles: {
        fillColor: [26, 26, 26], textColor: [255, 255, 255],
        fontStyle: 'bold', fontSize: 8.5,
        cellPadding: { top: 7, bottom: 7, left: 5, right: 5 },
      },
      columnStyles: {
        0: { cellWidth: cIdx,      halign: 'center' },
        1: { cellWidth: cSaleNo,   halign: 'left' },
        2: { cellWidth: cDate,     halign: 'left' },
        3: { cellWidth: cItems,    halign: 'left' },
        4: { cellWidth: cInvTotal, halign: 'right' },
        5: { cellWidth: cPaid,     halign: 'right' },
        6: { cellWidth: cBal,      halign: 'right' },
      },
      bodyStyles: {
        fontSize: 8.5, textColor: [40, 40, 40],
        fillColor: [255, 255, 255],
        cellPadding: { top: 6, bottom: 6, left: 5, right: 5 },
      },
      styles: { lineColor: [200, 200, 200], lineWidth: 0.4, overflow: 'linebreak' },
      margin: { left: mL, right: mR },
    });

    let y = (doc as any).lastAutoTable.finalY;

    // ── Grand Totals ─────────────────────────────────────────────────────────
    const totLblW = 120, totValW = 110;
    const totLeft = rEdge - totLblW - totValW;

    autoTable(doc, {
      body: [
        [
          { content: 'Total Invoiced',
            styles: { halign: 'right', textColor: [80, 80, 80], fillColor: [255, 255, 255] } },
          { content: `LKR${this.fmt(grandTotal)}`,
            styles: { halign: 'right', textColor: [40, 40, 40], fillColor: [255, 255, 255] } },
        ],
        [
          { content: 'Total Paid',
            styles: { halign: 'right', textColor: [22, 163, 74], fillColor: [240, 253, 244] } },
          { content: `LKR${this.fmt(grandPaid)}`,
            styles: { halign: 'right', textColor: [22, 163, 74], fillColor: [240, 253, 244] } },
        ],
        [
          { content: 'Total Balance Due',
            styles: { halign: 'right', fontStyle: 'bold', textColor: [180, 20, 20], fillColor: [254, 242, 242] } },
          { content: `LKR${this.fmt(grandBalance)}`,
            styles: { halign: 'right', fontStyle: 'bold', textColor: [180, 20, 20], fillColor: [254, 242, 242] } },
        ],
      ],
      startY: y + 4,
      theme: 'plain',
      styles: { fontSize: 9.5, lineWidth: 0, cellPadding: { top: 5, bottom: 5, left: 8, right: 8 } },
      columnStyles: { 0: { cellWidth: totLblW }, 1: { cellWidth: totValW } },
      margin: { left: totLeft, right: mR },
    });

    y = (doc as any).lastAutoTable.finalY;

    // ── Footer ────────────────────────────────────────────────────────────────
    y += 22;
    this.drawDivider(doc, mL, rEdge, y);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(70, 70, 70);
    doc.text('Notes', mL, y + 15);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
    doc.text('Please settle all outstanding balances at your earliest convenience.', mL, y + 28);
    doc.text('For queries contact: matheeshaflourmill@gmail.com', mL, y + 40);

    doc.save(`DueInvoice-${first.customerCode || first.customerName}.pdf`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CUSTOMER PROFORMA  (all sales — pending + paid, with separate payment tables)
  // ════════════════════════════════════════════════════════════════════════════
 generateCustomerProforma(summaries: SaleCreditSummary[]): void {
  if (summaries.length === 0) return;

  const doc   = new jsPDF('p', 'pt', 'a4');
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mL = 40, mR = 40, rEdge = pageW - mR;
  const BOTTOM_MARGIN = 55;
  let y = 40;

  const first        = summaries[0].sale;
  const pending      = summaries.filter(s => !s.isPaid);
  const paid         = summaries.filter(s =>  s.isPaid);
  const grandTotal   = summaries.reduce((a, s) => a + s.sale.totalRevenue, 0);
  const grandPaid    = summaries.reduce((a, s) => a + s.totalPaid, 0);
  const grandBalance = summaries.reduce((a, s) => a + s.balanceDue, 0);

  // ── Page-break guard ────────────────────────────────────────────────────────
  const checkPageBreak = (needed = 40) => {
    if (y + needed > pageH - BOTTOM_MARGIN) {
      doc.addPage();
      y = 40;
    }
  };

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13.5); doc.setTextColor(20, 20, 20);
  doc.text('Matheesha Flour Mill', mL, y + 15);
  doc.setFontSize(24);
  doc.text('ACCOUNT STATEMENT', rEdge, y + 15, { align: 'right' });

  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110, 110, 110);
  doc.text('North Central Province',          mL, y + 29);
  doc.text('SriLanka',                        mL, y + 41);
  doc.text('matheeshaflourmill@gmail.com',    mL, y + 53);

  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
  doc.text(`Date: ${this.formatDate(new Date().toISOString())}`, rEdge, y + 31, { align: 'right' });

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
  doc.text('Outstanding Balance', rEdge, y + 49, { align: 'right' });

  doc.setFontSize(13);
  doc.setTextColor(
    grandBalance > 0 ? 180 : 22,
    grandBalance > 0 ?  20 : 163,
    grandBalance > 0 ?  20 :  74,
  );
  doc.text(`LKR${this.fmt(grandBalance)}`, rEdge, y + 64, { align: 'right' });

  y += 76;
  this.drawDivider(doc, mL, rEdge, y);
  y += 18;

  // ── Customer Info ────────────────────────────────────────────────────────────
  const infoStartY = y;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(130, 130, 130);
  doc.text('Customer', mL, y);
  y += 14;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(20, 20, 20);
  doc.text(first.customerName, mL, y);

  if (first.customerAddress?.trim()) {
    const wrapped = doc.splitTextToSize(first.customerAddress.trim(), 260);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
    wrapped.forEach((line: string) => {
      y += 13;
      doc.text(line, mL, y);
    });
  }
  if (first.customerPhone) {
    y += 13;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
    doc.text(first.customerPhone, mL, y);
  }
  const leftColEndY = y;

  const metaRows = [
    { label: 'Customer Code :', value: first.customerCode    },
    { label: 'Total Sales :',   value: `${summaries.length}` },
    { label: 'Pending :',       value: `${pending.length}`   },
    { label: 'Completed :',     value: `${paid.length}`      },
  ];
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  metaRows.forEach((row, i) => {
    const ry = infoStartY + i * 18;
    doc.setTextColor(100, 100, 100); doc.text(row.label, 460,   ry, { align: 'right' });
    doc.setTextColor(30,   30,  30); doc.text(row.value, rEdge, ry, { align: 'right' });
  });
  const rightColEndY = infoStartY + (metaRows.length - 1) * 18;

  y = Math.max(leftColEndY, rightColEndY) + 22;

  // ── Summary stats bar ────────────────────────────────────────────────────────
  autoTable(doc, {
    body: [[
      { content: `Total Invoiced\nLKR${this.fmt(grandTotal)}`,
        styles: { halign: 'center', fillColor: [245,245,245], textColor: [40,40,40],
                  fontSize: 8.5, cellPadding: { top:8, bottom:8, left:6, right:6 } } },
      { content: `Total Paid\nLKR${this.fmt(grandPaid)}`,
        styles: { halign: 'center', fillColor: [240,253,244], textColor: [22,163,74],
                  fontSize: 8.5, cellPadding: { top:8, bottom:8, left:6, right:6 } } },
      { content: `Outstanding\nLKR${this.fmt(grandBalance)}`,
        styles: { halign: 'center', fillColor: [254,242,242], textColor: [180,20,20],
                  fontSize: 8.5, cellPadding: { top:8, bottom:8, left:6, right:6 } } },
    ]],
    startY: y, theme: 'plain',
    styles: { fontSize: 8.5, lineWidth: 0.4, lineColor: [210,210,210] },
    columnStyles: {
      0: { cellWidth: (rEdge - mL) / 3 },
      1: { cellWidth: (rEdge - mL) / 3 },
      2: { cellWidth: (rEdge - mL) / 3 },
    },
    margin: { left: mL, right: mR },
  });
  y = (doc as any).lastAutoTable.finalY + 20;

  // ── Helper: render one section ───────────────────────────────────────────────
  const renderSection = (
    sectionSummaries: SaleCreditSummary[],
    title: string,
    headerFill: [number, number, number],
  ) => {
    if (sectionSummaries.length === 0) return;

    checkPageBreak(60);

    // ✅ FIX: set bold/11pt FIRST, draw title, capture width, THEN switch font for count
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20, 20, 20);
    doc.text(title, mL, y);

    // Measure title width while the font is still bold 11pt — correct position
    const titleWidth = doc.getTextWidth(title);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100, 100, 100);
    doc.text(
      `(${sectionSummaries.length} sale${sectionSummaries.length > 1 ? 's' : ''})`,
      mL + titleWidth + 6, y,
    );

    y += 16;

    sectionSummaries.forEach((summary, sIdx) => {
      const { sale, payments, totalPaid, balanceDue, isPaid } = summary;

      const tableW = rEdge - mL;
      const cNo = 26, cRate = 82, cAmt = 88, cQty = 54;
      const cDesc = tableW - cNo - cQty - cRate - cAmt;

      checkPageBreak(60);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(40, 40, 40);
      doc.text(`${sIdx + 1}.  ${sale.saleNo}`, mL, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(110, 110, 110);
      doc.text(this.formatDate(sale.saleDatetime), rEdge, y, { align: 'right' });
      y += 10;

      autoTable(doc, {
        head: [['#', 'Item & Description', 'Qty', 'Unit Price', 'Amount']],
        body: sale.items.map((item, i) => [
          `${i + 1}`,
          `${item.packName}${item.weightKg != null ? ' - ' + item.weightKg + 'kg' : ''}`,
          `${this.fmtQty(item.qty)}\npcs`,
          this.fmt(item.unitPriceSold),
          this.fmt(item.lineRevenue),
        ]),
        startY: y,
        theme: 'grid',
        headStyles: {
          fillColor: headerFill, textColor: [255,255,255],
          fontStyle: 'bold', fontSize: 8,
          cellPadding: { top:5, bottom:5, left:5, right:5 },
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: cNo   },
          1: { halign: 'left',   cellWidth: cDesc },
          2: { halign: 'center', cellWidth: cQty  },
          3: { halign: 'right',  cellWidth: cRate },
          4: { halign: 'right',  cellWidth: cAmt  },
        },
        bodyStyles: {
          textColor: [40,40,40], fontSize: 8,
          cellPadding: { top:4, bottom:4, left:5, right:5 },
        },
        styles: { lineColor: [200,200,200], lineWidth: 0.4 },
        margin: { left: mL, right: mR },
      });
      y = (doc as any).lastAutoTable.finalY + 4;

      const tLbl = 110, tVal = 100;
      const tLeft = rEdge - tLbl - tVal;
      autoTable(doc, {
        body: [
          [
            { content: 'Invoice Total',
              styles: { halign: 'right', textColor: [60,60,60], fillColor: [255,255,255] } },
            { content: `LKR${this.fmt(sale.totalRevenue)}`,
              styles: { halign: 'right', fontStyle: 'bold', textColor: [20,20,20], fillColor: [255,255,255] } },
          ],
          [
            { content: 'Amount Paid',
              styles: { halign: 'right', textColor: [22,163,74], fillColor: [240,253,244] } },
            { content: `(LKR${this.fmt(totalPaid)})`,
              styles: { halign: 'right', textColor: [22,163,74], fillColor: [240,253,244] } },
          ],
          [
            { content: 'Balance Due',
              styles: { halign: 'right', fontStyle: 'bold',
                textColor: isPaid ? [22,163,74] : [180,20,20],
                fillColor: isPaid ? [240,253,244] : [254,242,242] } },
            { content: isPaid ? 'PAID' : `LKR${this.fmt(balanceDue)}`,
              styles: { halign: 'right', fontStyle: 'bold',
                textColor: isPaid ? [22,163,74] : [180,20,20],
                fillColor: isPaid ? [240,253,244] : [254,242,242] } },
          ],
        ],
        startY: y, theme: 'plain',
        styles: { fontSize: 8.5, lineWidth: 0, cellPadding: { top:3, bottom:3, left:7, right:7 } },
        columnStyles: { 0: { cellWidth: tLbl }, 1: { cellWidth: tVal } },
        margin: { left: tLeft, right: mR },
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      if (payments.length > 0) {
        checkPageBreak(40);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(60, 60, 60);
        doc.text('Payment History', mL + 8, y);
        y += 8;

        autoTable(doc, {
          head: [['Payment No', 'Date', 'Amount', 'Notes', 'Recorded By']],
          body: payments.map(p => [
            p.paymentNo,
            this.formatDate(p.paymentDate),
            `LKR${this.fmt(p.amount)}`,
            p.notes      || '—',
            p.recordedBy || '—',
          ]),
          startY: y,
          theme: 'striped',
          headStyles: {
            fillColor: [235,235,235], textColor: [50,50,50],
            fontStyle: 'bold', fontSize: 7.5,
            cellPadding: { top:4, bottom:4, left:5, right:5 },
          },
          columnStyles: {
            0: { halign: 'left',  fontSize: 7.5 },
            1: { halign: 'left',  fontSize: 7.5 },
            2: { halign: 'right', fontSize: 7.5, textColor: [22,163,74] },
            3: { halign: 'left',  fontSize: 7.5, textColor: [100,100,100] },
            4: { halign: 'left',  fontSize: 7.5, textColor: [100,100,100] },
          },
          bodyStyles: {
            fontSize: 7.5, fillColor: [255,255,255],
            cellPadding: { top:4, bottom:4, left:5, right:5 },
          },
          alternateRowStyles: { fillColor: [249,250,251] },
          styles: { lineColor: [220,220,220], lineWidth: 0.25 },
          margin: { left: mL + 8, right: mR },
        });
        y = (doc as any).lastAutoTable.finalY + 4;
      }

      y += 12;

      if (sIdx < sectionSummaries.length - 1) {
        checkPageBreak(30);
        doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.3);
        doc.line(mL, y, rEdge, y);
        y += 14;
      }
    });

    y += 10;
  };

  // ── Render sections ──────────────────────────────────────────────────────────
  renderSection(pending, 'Pending Sales',   [180, 40,  40]);
  renderSection(paid,    'Completed Sales', [ 26, 26,  26]);

  // ── Grand Totals ─────────────────────────────────────────────────────────────
  checkPageBreak(100);
  this.drawDivider(doc, mL, rEdge, y);
  y += 14;

  const totLblW = 130, totValW = 110;
  const totLeft = rEdge - totLblW - totValW;

  autoTable(doc, {
    body: [
      [
        { content: 'Total Invoiced (All)',
          styles: { halign: 'right', textColor: [80,80,80], fillColor: [255,255,255] } },
        { content: `LKR${this.fmt(grandTotal)}`,
          styles: { halign: 'right', fillColor: [255,255,255] } },
      ],
      [
        { content: 'Total Paid',
          styles: { halign: 'right', textColor: [22,163,74], fillColor: [240,253,244] } },
        { content: `LKR${this.fmt(grandPaid)}`,
          styles: { halign: 'right', textColor: [22,163,74], fillColor: [240,253,244] } },
      ],
      [
        { content: 'Outstanding Balance',
          styles: { halign: 'right', fontStyle: 'bold', textColor: [180,20,20], fillColor: [254,242,242] } },
        { content: `LKR${this.fmt(grandBalance)}`,
          styles: { halign: 'right', fontStyle: 'bold', textColor: [180,20,20], fillColor: [254,242,242] } },
      ],
    ],
    startY: y, theme: 'plain',
    styles: { fontSize: 9.5, lineWidth: 0, cellPadding: { top:5, bottom:5, left:8, right:8 } },
    columnStyles: { 0: { cellWidth: totLblW }, 1: { cellWidth: totValW } },
    margin: { left: totLeft, right: mR },
  });
  y = (doc as any).lastAutoTable.finalY;

  // ── Footer ────────────────────────────────────────────────────────────────────
  checkPageBreak(70);
  y += 22;
  this.drawDivider(doc, mL, rEdge, y);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(70, 70, 70);
  doc.text('Notes', mL, y + 15);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
  doc.text('This is a proforma account statement. All amounts are in Sri Lankan Rupees (LKR).', mL, y + 28);
  doc.text('For queries contact: matheeshaflourmill@gmail.com', mL, y + 40);

  doc.save(`AccountStatement-${first.customerCode || first.customerName}.pdf`);
}


  // ════════════════════════════════════════════════════════════════════════════
  // SHARED HELPERS
  // ════════════════════════════════════════════════════════════════════════════
  private drawDivider(doc: jsPDF, x1: number, x2: number, y: number): void {
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.5);
    doc.line(x1, y, x2, y);
  }

  private fmt(value: number): string {
    return (value ?? 0).toLocaleString('en-LK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private fmtQty(value: number): string {
    return (value ?? 0).toLocaleString('en-LK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}