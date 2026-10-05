// Run from /backend:  node scripts/preview-receipts.js
const fs = require('fs');
const path = require('path');
const printer = require('../../src/services/printer.service');
const invoice = require('../../src/services/invoicePrinter.service');
const { resolveSaleDatetime } = require('../../src/utils/saleDate');

const TZ = { timeZone: 'Asia/Colombo' };

// What the frontend sends for a date picked as 2026-09-30
const frontendInput = new Date('2026-09-30').toISOString();

console.log('OLD behaviour time :', new Date(frontendInput).toLocaleTimeString('en-LK', TZ), '  <- the 5:30 AM bug');
const fixed = resolveSaleDatetime(frontendInput);
console.log('NEW behaviour time :', fixed.toLocaleTimeString('en-LK', TZ), ' date:', fixed.toLocaleDateString('en-LK', TZ));
console.log('Real time now      :', new Date().toLocaleTimeString('en-LK', TZ));
console.log('');

const customer = { name: 'Test Customer', customer_code: 'C001', address: 'Kurunegala', phone: '0771234567' };
const sale = {
  sale_no: 'SALE-000123',
  sale_datetime: fixed,
  payment_method: 'CREDIT',
  payment_status: 'PENDING',
  total_revenue: 13400,
  customer_id: customer,
  created_by_user_id: { full_name: 'Admin User' },
  items: [
    { pack_type_id: { pack_name: 'Wheat Flour', weight_kg: 25 }, qty: 4, unit_price_sold: 2500, line_revenue: 10000 },
    { pack_type_id: { pack_name: 'Rice Flour', weight_kg: 10 }, qty: 2, unit_price_sold: 1700, line_revenue: 3400 },
  ],
};
const outstandingBalance = 45000;

const outDir = path.join(__dirname, '../tmp/preview');
fs.mkdirSync(outDir, { recursive: true });

const slips = {
  '1_sales_receipt': printer.formatSaleReceipt(sale, { outstandingBalance }),
  '2_store_room_receipt': printer.formatStoreRoomReceipt(sale),
  '3_payment_receipt': printer.formatPaymentReceipt(sale, { outstandingBalance }),
  '4_delivery_note': printer.formatDeliveryNote(sale, 'NP-ABC-1234'),
  '5_due_slip': printer.formatDueSlip({ sale, customer, totalPaid: 3000, balanceDue: 10400 }),
};

for (const [name, text] of Object.entries(slips)) {
  fs.writeFileSync(path.join(outDir, `sample_${name}.txt`), text, 'utf8');
  console.log(`\n=============== ${name} ===============`);
  console.log(text);
}

invoice.buildInvoicePdf(sale, customer, { outstandingBalance }).then((p) => {
  const dest = path.join(outDir, 'sample_invoice.pdf');
  fs.copyFileSync(p, dest);
  console.log('\nInvoice PDF saved:', dest);
});