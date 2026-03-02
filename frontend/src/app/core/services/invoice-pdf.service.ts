// src/app/core/services/invoice-pdf.service.ts
import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale } from '../models/sale';
import { Customer } from '../models/customer';

// ─────────────────────────────────────────────────────────────────────────────
// TARGET LAYOUT (Image 1 — pixel-perfect)
//
//  Matheesha Flour Mill (bold 13.5)              INVOICE (bold 30)
//  North Central Province (9 gray)               # INV-000006   (9 right)
//  SriLanka (9 gray)
//  matheeshaflourmill@gmail.com (9 gray)         Balance Due    (9 bold right)
//                                                LKR10,800.00   (13 bold right)
//  ─────────────────────── divider ───────────────────────────────────────────
//  Bill To (8.5 gray)          Invoice Date :        20 Feb 2026
//  New Jayawardhana Stores      Terms :               Due on Receipt
//  411 Nagasena... (9)          Due Date :            20 Feb 2026
//  Anuradhapura    (9)
//
//  ┌────┬──────────────────────────────────┬────────┬──────────┬──────────┐
//  │  # │ Item & Description               │    Qty │     Rate │   Amount │
//  ├────┼──────────────────────────────────┼────────┼──────────┼──────────┤
//  │  1 │ 5kg                              │   8.00 │ 1,350.00 │10,800.00 │
//  │    │                                  │   pcs  │          │          │
//  └────┴──────────────────────────────────┴────────┴──────────┴──────────┘
//                                           Sub Total       10,800.00
//                                           Total      LKR10,800.00
//  ┌────────────────────────────── gray bg ─────────────────────────────────┐
//  │                          Balance Due      LKR10,800.00                 │
//  └─────────────────────────────────────────────────────────────────────────┘
//  ─────────────────────── divider ───────────────────────────────────────────
//  Notes
//  Thanks for your business.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class InvoicePdfService {

  generate(sale: Sale, customer: Customer): void {
    const doc = new jsPDF('p', 'pt', 'a4');
    const pageW = doc.internal.pageSize.getWidth();  // 595.28 pt
    const mL = 40;
    const mR = 40;
    const rEdge = pageW - mR;  // 555.28 pt

    const invoiceDate = this.formatDate(sale.saleDatetime);

    // ══════════════════════════════════════════════════════════════
    // BLOCK 1 — TOP HEADER
    // ══════════════════════════════════════════════════════════════

    // Company name — bold 13.5, dark
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.setTextColor(20, 20, 20);
    doc.text('Matheesha Flour Mill', mL, 55);

    // "INVOICE" — bold 30, dark, right-aligned, same baseline
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(30);
    doc.setTextColor(20, 20, 20);
    doc.text('INVOICE', rEdge, 55, { align: 'right' });

    // Company address lines — normal 9, gray
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text('North Central Province', mL, 69);
    doc.text('SriLanka', mL, 81);
    doc.text('matheeshaflourmill@gmail.com', mL, 93);

    // Right: sale number — normal 9, below INVOICE
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`# ${sale.saleNo}`, rEdge, 71, { align: 'right' });

    // Right: "Balance Due" label — bold 9, aligns ~3rd address line
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text('Balance Due', rEdge, 89, { align: 'right' });

    // Right: amount — bold 13, one line below label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text(`LKR${this.fmt(sale.totalRevenue)}`, rEdge, 104, { align: 'right' });

    // ── Divider ───────────────────────────────────────────────────
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.5);
    doc.line(mL, 116, rEdge, 116);

    // ══════════════════════════════════════════════════════════════
    // BLOCK 2 — BILL TO (left) + INVOICE META (right)
    // ══════════════════════════════════════════════════════════════
    const b2Y = 134;  // top of this section

    // LEFT: "Bill To" gray label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(130, 130, 130);
    doc.text('Bill To', mL, b2Y);

    // LEFT: Customer name — bold 10.5
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(20, 20, 20);
    doc.text(customer.name, mL, b2Y + 14);

    // LEFT: Customer address — normal 9, wrapped
    let addrEndY = b2Y + 14;
    const rawAddress = (customer.address as string | undefined | null) ?? '';
    if (rawAddress.trim()) {
      const wrapped = doc.splitTextToSize(rawAddress.trim(), 260);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      wrapped.forEach((line: string, i: number) => {
        const lineY = b2Y + 14 + 13 * (i + 1);
        doc.text(line, mL, lineY);
        addrEndY = lineY;
      });
    }

    // RIGHT: Invoice meta — label right-aligned at 460, value at rEdge
    const metaRows = [
      { label: 'Invoice Date :', value: invoiceDate },
      { label: 'Terms :', value: 'Due on Receipt' },
      { label: 'Due Date :', value: invoiceDate },
    ];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    metaRows.forEach((row, i) => {
      const ry = b2Y + i * 18;
      doc.setTextColor(100, 100, 100);
      doc.text(row.label, 460, ry, { align: 'right' });
      doc.setTextColor(30, 30, 30);
      doc.text(row.value, rEdge, ry, { align: 'right' });
    });

    // ══════════════════════════════════════════════════════════════
    // BLOCK 3 — ITEMS TABLE
    // 5 columns: # | Item & Description | Qty | Rate | Amount
    // Qty cell: number on line 1, "pcs" on line 2 (same cell)
    // ══════════════════════════════════════════════════════════════
    const tableStartY = Math.max(addrEndY, b2Y + 2 * 18) + 22;

    // Build rows — qty value is "8.00\npcs" so jsPDF-autotable wraps it
    const itemRows = sale.items.map((item: any, i: number) => {
      const qty = this.fmtQty(item.qty ?? item.quantityKg ?? 0);
      return [
        `${i + 1}`,
        `${item.packName ?? item.productName ?? ''}${item.weightKg != null ? ' - ' + item.weightKg + 'kg' : ''}`,
        `${qty}\npcs`,   // ← stacked: number + newline + "pcs"
        this.fmt(item.unitPriceSold ?? item.unitPrice ?? 0),
        this.fmt(item.lineRevenue ?? item.lineTotal ?? 0),
      ];
    });

    // Column widths — must sum to tableW = 515.28
    const tableW = rEdge - mL;   // 515.28
    const cNo = 26;
    const cRate = 82;
    const cAmt = 88;
    const cQty = 54;           // wide enough for "8.00" and "pcs"
    const cDesc = tableW - cNo - cQty - cRate - cAmt;  // remainder

    autoTable(doc, {
      head: [['#', 'Item & Description', 'Qty', 'Rate', 'Amount']],
      body: itemRows,
      startY: tableStartY,
      theme: 'grid',
      headStyles: {
        fillColor: [26, 26, 26],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: { top: 7, bottom: 7, left: 6, right: 6 },
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: cNo, fontSize: 9.5 },
        1: { halign: 'left', cellWidth: cDesc, fontSize: 9.5 },
        2: { halign: 'center', cellWidth: cQty, fontSize: 9.5 },  // center for stacked qty+pcs
        3: { halign: 'right', cellWidth: cRate, fontSize: 9.5 },
        4: { halign: 'right', cellWidth: cAmt, fontSize: 9.5 },
      },
      bodyStyles: {
        textColor: [40, 40, 40],
        fillColor: [255, 255, 255],
        cellPadding: { top: 6, bottom: 6, left: 6, right: 6 },
      },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      styles: {
        lineColor: [200, 200, 200],
        lineWidth: 0.4,
        overflow: 'linebreak',
      },
      didParseCell: (data) => {
        if (data.section === 'head') {
          if (data.column.index === 0) data.cell.styles.halign = 'center';
          if (data.column.index === 1) data.cell.styles.halign = 'left';
          if (data.column.index === 2) data.cell.styles.halign = 'center';
          if (data.column.index === 3) data.cell.styles.halign = 'right';
          if (data.column.index === 4) data.cell.styles.halign = 'right';
        }
      },
      margin: { left: mL, right: mR },
    });

    const afterTable = (doc as any).lastAutoTable.finalY;

    // ══════════════════════════════════════════════════════════════
    // BLOCK 4 — TOTALS (right-aligned block)
    //
    //   Sub Total      10,800.00       normal, white bg
    //   Total     LKR10,800.00         bold,   white bg
    //   Balance Due LKR10,800.00       bold,   gray  bg
    // ══════════════════════════════════════════════════════════════
    const totLblW = 110;
    const totValW = 110;
    const totLeft = rEdge - totLblW - totValW;

    autoTable(doc, {
      body: [
        [
          {
            content: 'Sub Total',
            styles: {
              halign: 'right', fontStyle: 'normal',
              textColor: [80, 80, 80], fillColor: [255, 255, 255]
            }
          },
          {
            content: this.fmt(sale.totalRevenue),
            styles: {
              halign: 'right', fontStyle: 'normal',
              textColor: [40, 40, 40], fillColor: [255, 255, 255]
            }
          },
        ],
        [
          {
            content: 'Total',
            styles: {
              halign: 'right', fontStyle: 'bold',
              textColor: [20, 20, 20], fillColor: [255, 255, 255]
            }
          },
          {
            content: `LKR${this.fmt(sale.totalRevenue)}`,
            styles: {
              halign: 'right', fontStyle: 'bold',
              textColor: [20, 20, 20], fillColor: [255, 255, 255]
            }
          },
        ],
        [
          {
            content: 'Balance Due',
            styles: {
              halign: 'right', fontStyle: 'bold',
              textColor: [20, 20, 20], fillColor: [238, 238, 238]
            }
          },
          {
            content: `LKR${this.fmt(sale.totalRevenue)}`,
            styles: {
              halign: 'right', fontStyle: 'bold',
              textColor: [20, 20, 20], fillColor: [238, 238, 238]
            }
          },
        ],
      ],
      startY: afterTable + 2,
      theme: 'plain',
      styles: {
        fontSize: 9.5,
        lineWidth: 0,
        cellPadding: { top: 5, bottom: 5, left: 8, right: 8 },
      },
      columnStyles: {
        0: { cellWidth: totLblW },
        1: { cellWidth: totValW },
      },
      margin: { left: totLeft, right: mR },
    });

    const afterTotals = (doc as any).lastAutoTable.finalY;

    // ══════════════════════════════════════════════════════════════
    // BLOCK 5 — NOTES
    // ══════════════════════════════════════════════════════════════
    const notesY = afterTotals + 22;

    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.5);
    doc.line(mL, notesY, rEdge, notesY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(70, 70, 70);
    doc.text('Notes', mL, notesY + 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text('Thanks for your business.', mL, notesY + 28);

    // ══════════════════════════════════════════════════════════════
    // SAVE
    // ══════════════════════════════════════════════════════════════
    doc.save(`Invoice-${sale.saleNo}.pdf`);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
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