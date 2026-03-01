import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale } from '../models/sale';
import { Customer } from '../models/customer';

@Injectable({ providedIn: 'root' })
export class InvoicePdfService {

  generate(sale: Sale, customer: Customer): void {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth();
    const marginL = 14;
    const marginR = 14;
    const contentW = pageW - marginL - marginR;

    // ─── DARK HEADER BAR ─────────────────────────────────────────────────────
    autoTable(doc, {
      body: [
        [
          {
            // Placeholder — overdrawn in didDrawCell with correct bold/size
            content: '\n\n\n\n',
            styles: {
              halign: 'left',
              cellPadding: { top: 10, left: 12, right: 4, bottom: 10 },
              lineWidth: 0,
            },
          },
          {
            // Placeholder — overdrawn in didDrawCell for INVOICE big text
            content: '\n\n\n\n',
            styles: {
              halign: 'right',
              cellPadding: { top: 10, left: 4, right: 12, bottom: 10 },
              lineWidth: 0,
            },
          },
        ],
      ],
      theme: 'plain',
      startY: 0,
      tableWidth: pageW,
      styles: { fillColor: [0, 0, 0], minCellHeight: 36 },
      columnStyles: {
        0: { cellWidth: pageW * 0.55 },
        1: { cellWidth: pageW * 0.45 },
      },
      margin: { left: 0, right: 0, top: 0 },
      didDrawCell: (data) => {
        if (data.section !== 'body' || data.row.index !== 0) return;

        const cx = data.cell.x;
        const cy = data.cell.y;
        const cw = data.cell.width;

        if (data.column.index === 0) {
          // ── LEFT: Company info ──────────────────────────────────────────
          // "Matheesha Flour Mill" — BOLD, bigger
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(255, 255, 255);
          doc.text('Matheesha Flour Mill', cx + 12, cy + 13);

          // Rest of company info — normal weight
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(210, 210, 210);
          doc.text('North Central Province', cx + 12, cy + 19);
          doc.text('SriLanka', cx + 12, cy + 24);
          doc.text('matheeshaflourmill@gmail.com', cx + 12, cy + 29);
        }

        if (data.column.index === 1) {
          // ── RIGHT: INVOICE label, sale no, Balance Due ──────────────────
          const rx = cx + cw - 12; // right edge with padding

          // "INVOICE" — large bold white
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(18);
          doc.setTextColor(255, 255, 255);
          doc.text('INVOICE', rx, cy + 13, { align: 'right' });

          // Sale number — normal, smaller, light gray
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(200, 200, 200);
          doc.text(`# ${sale.saleNo}`, rx, cy + 20, { align: 'right' });

          // "Balance Due" label
          doc.setFontSize(8);
          doc.setTextColor(180, 180, 180);
          doc.text('Balance Due', rx, cy + 27, { align: 'right' });

          // Balance Due value — bold white
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(255, 255, 255);
          doc.text(`LKR${this.fmt(sale.totalRevenue)}`, rx, cy + 33, { align: 'right' });
        }
      },
    });

    let y = (doc as any).lastAutoTable.finalY + 6;

    // ─── BILL TO  |  INVOICE META ─────────────────────────────────────────────
    const addressLines = (customer.address ?? '').split(',').map(s => s.trim()).filter(Boolean);
    const invoiceDate = this.formatDate(sale.saleDatetime);
    const metaLines = `Invoice Date :  ${invoiceDate}\nTerms :  Due on Receipt\nDue Date :  ${invoiceDate}`;

    // Estimate cell height: "Bill To" + name + address lines
    const billToRowCount = 2 + addressLines.length; // "Bill To" + name + address lines
    const estimatedCellH = billToRowCount * 5 + 12;

    autoTable(doc, {
      body: [
        [
          {
            // Placeholder — overdrawn in didDrawCell for bold customer name
            content: Array(billToRowCount + 1).fill('\n').join(''),
            styles: {
              halign: 'left',
              cellPadding: { top: 4, left: 12, right: 4, bottom: 4 },
              lineWidth: 0,
              minCellHeight: estimatedCellH,
            },
          },
          {
            content: metaLines,
            styles: {
              halign: 'right',
              fontSize: 9,
              cellPadding: { top: 4, left: 4, right: 12, bottom: 4 },
              textColor: [60, 60, 60],
              lineWidth: 0,
            },
          },
        ],
      ],
      theme: 'plain',
      startY: y,
      tableWidth: pageW,
      styles: { fillColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: pageW * 0.55 },
        1: { cellWidth: pageW * 0.45 },
      },
      margin: { left: 0, right: 0 },
      didDrawCell: (data) => {
        if (data.section !== 'body' || data.row.index !== 0 || data.column.index !== 0) return;

        const cx = data.cell.x + 12;
        const cy = data.cell.y;

        // "Bill To" — small gray label
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(130, 130, 130);
        doc.text('Bill To', cx, cy + 8);

        // customer.name — BOLD, dark
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(20, 20, 20);
        doc.text(customer.name, cx, cy + 15);

        // Address lines — normal
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        addressLines.forEach((line, i) => {
          doc.text(line, cx, cy + 21 + i * 5);
        });
      },
    });

    y = (doc as any).lastAutoTable.finalY + 4;

    // ─── ITEMS TABLE ──────────────────────────────────────────────────────────
    const itemRows = sale.items.map((item, i) => [
      `${i + 1}`,
      `  ${item.packName}`,
      `${item.qty.toFixed(2)}`,
      'pcs',
      this.fmt(item.unitPriceSold),
      this.fmt(item.lineRevenue),
    ]);

    autoTable(doc, {
      head: [['#', 'Item & Description', 'Qty', '', 'Rate', 'Amount']],
      body: itemRows,
      startY: y,
      theme: 'striped',
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'right',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'left', cellWidth: contentW * 0.38 },
        2: { halign: 'right', cellWidth: contentW * 0.12 },
        3: { halign: 'left', cellWidth: contentW * 0.1 },
        4: { halign: 'right', cellWidth: contentW * 0.18 },
        5: { halign: 'right', cellWidth: contentW * 0.18 },
      },
      bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      styles: { lineColor: [220, 220, 220], lineWidth: 0.1 },
      margin: { left: marginL, right: marginR },
    });

    y = (doc as any).lastAutoTable.finalY;

    // ─── TOTALS BLOCK ─────────────────────────────────────────────────────────
    const totalsX = pageW * 0.5;
    const totalsW = pageW * 0.5;

    autoTable(doc, {
      body: [
        [
          { content: 'Sub Total', styles: { halign: 'left' } },
          { content: this.fmt(sale.totalRevenue), styles: { halign: 'right' } },
        ],
        [
          { content: 'Total', styles: { halign: 'left', fontStyle: 'bold' } },
          {
            content: `LKR${this.fmt(sale.totalRevenue)}`,
            styles: { halign: 'right', fontStyle: 'bold' },
          },
        ],
        [
          {
            content: 'Balance Due',
            styles: { halign: 'left', fontStyle: 'bold', fontSize: 10 },
          },
          {
            // FIX: Balance Due value → black [0,0,0], not green
            content: `LKR${this.fmt(sale.totalRevenue)}`,
            styles: {
              halign: 'right',
              fontStyle: 'bold',
              fontSize: 10,
              textColor: [0, 0, 0],
            },
          },
        ],
      ],
      startY: y + 2,
      theme: 'plain',
      styles: { fillColor: [255, 255, 255], fontSize: 9, lineWidth: 0 },
      columnStyles: {
        0: { cellWidth: totalsW * 0.5 },
        1: { cellWidth: totalsW * 0.42 },
      },
      margin: { left: totalsX, right: marginR },
    });

    // ─── NOTES FOOTER ─────────────────────────────────────────────────────────
    const afterTotals = (doc as any).lastAutoTable.finalY + 8;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(marginL, afterTotals, pageW - marginR, afterTotals);

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('Notes', marginL, afterTotals + 6);
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    doc.text('Thanks for your business.', marginL, afterTotals + 12);

    doc.save(`Invoice-${sale.saleNo}.pdf`);
  }

  private fmt(value: number): string {
    return value.toLocaleString('en-LK', {
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
