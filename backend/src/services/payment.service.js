// backend/services/payment.service.js
const fs       = require('fs');
const Payment  = require('../models/Payment');
const Sale     = require('../models/Sale');
const Customer = require('../models/Customer');
const CustomerAdvance = require('../models/CustomerAdvance');
const mongoose = require('mongoose');
const advance  = require('./advance.service');
const { generateSequence } = require('../utils/sequence');
const { sendWhatsApp, sendWhatsAppDocument } = require('./whatsapp.service');
const { formatPhoneForWhatsApp } = require('../utils/phone');

// ── helpers ──────────────────────────────────────────────────────────────────

const getTotalPaid = async (sale_id) => {
  const oid = typeof sale_id === 'string' ? new mongoose.Types.ObjectId(sale_id) : sale_id;
  const agg = await Payment.aggregate([
    { $match: { sale_id: oid } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  return agg[0]?.total ?? 0;
};

const syncSalePaymentStatus = async (sale_id) => {
  const sale = await Sale.findById(sale_id);
  if (!sale) return;
  const totalPaid = await getTotalPaid(sale_id);
  const newStatus = totalPaid >= sale.total_revenue ? 'PAID' : 'PENDING';
  if (sale.payment_status !== newStatus) {
    sale.payment_status = newStatus;
    await sale.save();
  }
  return { totalPaid, newStatus, balanceDue: Math.max(0, sale.total_revenue - totalPaid) };
};

// ── WhatsApp notification on payment recorded ───────────────────────────────
const notifyPaymentRecorded = async (payment, sale, balanceDue) => {
  const message =
    `💵 *Payment Received*\n` +
    `📋 Sale No: ${sale.sale_no}\n` +
    `👤 Customer: ${sale.customer_id?.name || 'N/A'}\n` +
    `🧾 Payment No: ${payment.payment_no}\n` +
    `💰 Amount Paid: LKR ${Number(payment.amount).toFixed(2)}\n` +
    `📉 Balance Remaining: LKR ${Number(balanceDue).toFixed(2)}\n` +
    `🕐 ${new Date(payment.payment_date).toLocaleString('en-LK')}`;

  return sendWhatsApp(message);
};

// ── public API ────────────────────────────────────────────────────────────────

const addPayment = async ({ sale_id, amount, payment_date, notes }, user) => {
  const sale = await Sale.findById(sale_id).populate('customer_id');
  if (!sale)
    throw Object.assign(new Error('Sale not found'), { statusCode: 404 });
  if (sale.payment_method !== 'CREDIT')
    throw Object.assign(new Error('Payments can only be added to CREDIT sales'), { statusCode: 400 });
  if (sale.status === 'CANCELLED')
    throw Object.assign(new Error('Cannot add payment to a cancelled sale'), { statusCode: 400 });

  const alreadyPaid = await getTotalPaid(sale_id);
  const remaining   = sale.total_revenue - alreadyPaid;
  if (amount > remaining + 0.001)
    throw Object.assign(
      new Error(`Amount (${amount}) exceeds remaining balance (${remaining.toFixed(2)})`),
      { statusCode: 400 }
    );

  const payment_no = await generateSequence('PAY');
  const payment = await Payment.create({
    payment_no,
    sale_id,
    customer_id: sale.customer_id._id ?? sale.customer_id,
    amount,
    payment_date: payment_date ? new Date(payment_date) : new Date(),
    notes: notes ?? '',
    recorded_by: user?._id,
  });

  const { balanceDue, totalPaid: totalPaidAfter } = await syncSalePaymentStatus(sale_id);

  // ── WhatsApp notifications (fire-and-forget) ──
  notifyPaymentRecorded(payment, sale, balanceDue)
    .catch(err => console.error('[WhatsApp] Payment notify failed:', err.message));

  sendPaymentSlipToCustomer(sale, sale.customer_id, payment, totalPaidAfter, balanceDue)
    .catch(err => console.error('[WhatsApp] Payment slip send failed:', err.message));

  return Payment.findById(payment._id)
    .populate('sale_id',     'sale_no total_revenue')
    .populate('customer_id', 'name customer_code')
    .populate('recorded_by', 'full_name username');
};

// ── Due payment slip print ───────────────────────────────────────────────────
const printDueSlip = async (sale_id) => {
  const printerService = require('./printer.service');
  const sale = await Sale.findById(sale_id).populate('customer_id');
  if (!sale) throw Object.assign(new Error('Sale not found'), { statusCode: 404 });

  const totalPaid = await getTotalPaid(sale_id);
  const balanceDue = Math.max(0, sale.total_revenue - totalPaid);

  return printerService.printDueSlip({
    sale,
    customer: sale.customer_id,
    totalPaid,
    balanceDue,
  });
};

const getBySale = (sale_id) =>
  Payment.find({ sale_id })
    .populate('recorded_by', 'full_name username')
    .sort({ payment_date: -1 });

const getByCustomer = (customer_id) =>
  Payment.find({ customer_id })
    .populate('sale_id',     'sale_no total_revenue payment_status sale_datetime')
    .populate('recorded_by', 'full_name username')
    .sort({ payment_date: -1 });

/**
 * All CREDIT sales for a customer, each enriched with payment breakdown.
 */
const getCreditSummaryByCustomer = async (customer_id) => {
  const sales = await Sale.find({
    customer_id,
    payment_method: 'CREDIT',
    status: { $ne: 'CANCELLED' }
  })
    .populate('customer_id', 'name customer_code address phone')
    .populate('items.pack_type_id', 'pack_name weight_kg')
    .sort({ sale_datetime: -1 });

  return Promise.all(sales.map(async (sale) => {
    const payments  = await Payment.find({ sale_id: sale._id }).sort({ payment_date: 1 });
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const balanceDue = Math.max(0, sale.total_revenue - totalPaid);
    return {
      sale,
      payments,
      totalPaid,
      balanceDue,
      isPaid: balanceDue <= 0.001,
    };
  }));
};

const getById = async (id) => {
  const p = await Payment.findById(id)
    .populate('sale_id',     'sale_no total_revenue sale_datetime')
    .populate('customer_id', 'name customer_code')
    .populate('recorded_by', 'full_name username');
  if (!p) throw Object.assign(new Error('Payment not found'), { statusCode: 404 });
  return p;
};

const remove = async (id) => {
  const p = await Payment.findById(id);
  if (!p) throw Object.assign(new Error('Payment not found'), { statusCode: 404 });
  if (p.receipt_no)
    throw Object.assign(new Error(`This payment is part of receipt ${p.receipt_no}. Remove the whole receipt instead.`), { statusCode: 400 });
  await p.deleteOne();
  await syncSalePaymentStatus(p.sale_id);
};

// ── Customer-wide due slip (all pending CREDIT sales) ────────────────────────
const printCustomerDueSlip = async (customer_id) => {
  const printerService = require('./printer.service');

  const customer = await Customer.findById(customer_id);
  if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });

  const summaries = await getCreditSummaryByCustomer(customer_id);
  const pending = summaries.filter(s => !s.isPaid);

  if (pending.length === 0) {
    throw Object.assign(new Error('No pending balances for this customer'), { statusCode: 400 });
  }

  return printerService.printCustomerDueSlip({ customer, summaries: pending });
};

// ── Send the payment slip PDF to the customer's WhatsApp as a document ─────
// Builds the slip PDF, sends it through the WhatsApp Cloud API (document
// message, or the approved document template when the customer has not
// messaged the business in the last 24 hours) and deletes the temporary file.
const sendPaymentSlipToCustomer = async (sale, customer, payment, totalPaid, balanceDue) => {
  const phone = formatPhoneForWhatsApp(customer?.phone);
  if (!phone) {
    console.warn(`[WhatsApp] Customer ${customer?.customer_code || customer?._id} has no usable phone - skipping payment slip send.`);
    return;
  }

  const printerService = require('./printer.service');
  const isFullyPaid = balanceDue <= 0.001;

  const filePath = await printerService.buildDueSlipPdfFile({
    sale, customer, payment, totalPaid, balanceDue, isFullyPaid,
  });

  const caption = isFullyPaid
    ? `Hi ${customer.name} 👋, your order ${sale.sale_no} is now fully paid ✅. We received LKR ${Number(payment.amount).toFixed(2)}.`
    : `Hi ${customer.name} 👋, we received your payment of LKR ${Number(payment.amount).toFixed(2)} 💵 for sale ${sale.sale_no}. Outstanding balance: LKR ${Number(balanceDue).toFixed(2)}.`;

  try {
    const pdf = await fs.promises.readFile(filePath);
    const result = await sendWhatsAppDocument(phone, pdf, `Payment-${payment.payment_no}.pdf`, caption);
    if (!result.success) console.error('[WhatsApp] Payment slip send failed:', result.error);
  } finally {
    fs.promises.unlink(filePath).catch(() => {});
  }
};

// ── Total outstanding across ALL of a customer's CREDIT sales ──────────────
// Shown on receipts/invoices so staff and the customer both see the full
// picture, not just this one transaction.
const getCustomerTotalOutstanding = async (customer_id) => {
  const sales = await Sale.find({
    customer_id,
    payment_method: 'CREDIT',
    status: { $ne: 'CANCELLED' },
  }).select('_id total_revenue');

  if (sales.length === 0) return 0;

  const saleIds = sales.map(s => s._id);
  const paidAgg = await Payment.aggregate([
    { $match: { sale_id: { $in: saleIds } } },
    { $group: { _id: '$sale_id', total_paid: { $sum: '$amount' } } },
  ]);
  const paidMap = {};
  for (const p of paidAgg) paidMap[p._id.toString()] = p.total_paid;

  let total = 0;
  for (const s of sales) {
    const paid = paidMap[s._id.toString()] ?? 0;
    total += Math.max(0, s.total_revenue - paid);
  }
  return total;
};

// ── Outstanding + advance for every customer (customer list page) ───────────
// -> [{ customer_id, outstanding, advance }] only for customers with either > 0
const getAllCustomerBalances = async () => {
  const sales = await Sale.find({ payment_method: 'CREDIT', status: { $ne: 'CANCELLED' } })
    .select('_id customer_id total_revenue').lean();

  const paidAgg = sales.length
    ? await Payment.aggregate([
        { $match: { sale_id: { $in: sales.map(s => s._id) } } },
        { $group: { _id: '$sale_id', total_paid: { $sum: '$amount' } } },
      ])
    : [];
  const paidMap = {};
  for (const p of paidAgg) paidMap[String(p._id)] = p.total_paid;

  const outstanding = {}; // cents per customer
  for (const s of sales) {
    const due = Math.max(0, advance.toCents(s.total_revenue) - advance.toCents(paidMap[String(s._id)] ?? 0));
    if (due > 0) outstanding[String(s.customer_id)] = (outstanding[String(s.customer_id)] || 0) + due;
  }

  const adv = await advance.getAllBalances();
  const ids = new Set([...Object.keys(outstanding), ...Object.keys(adv)]);
  return [...ids].map(id => ({
    customer_id: id,
    outstanding: advance.fromCents(outstanding[id] || 0),
    advance: adv[id] || 0,
  }));
};

// ── All payments in a date range (used by the summary report) ───────────────
const getAllInRange = async ({ dateFrom, dateTo } = {}) => {
  const q = {};
  if (dateFrom || dateTo) {
    q.payment_date = {};
    if (dateFrom) q.payment_date.$gte = new Date(`${dateFrom}T00:00:00+05:30`);
    if (dateTo)   q.payment_date.$lte = new Date(`${dateTo}T23:59:59.999+05:30`);
  }
  return Payment.find(q)
    .populate('sale_id', 'sale_no total_revenue')
    .populate('customer_id', 'name customer_code')
    .populate('recorded_by', 'full_name username')
    .sort({ payment_date: 1 });
};

// ── Customer-level payment (one amount, auto-allocated across pending sales) ──
// Anything above the outstanding balance is kept as the customer's ADVANCE.
const toCents   = advance.toCents;
const fromCents = advance.fromCents;
const badReq    = (msg) => Object.assign(new Error(msg), { statusCode: 400 });

// pending CREDIT sales of a customer, oldest first (optionally only the chosen ones)
const loadPending = async (customer_id, sale_ids) => {
  let pending = (await getCreditSummaryByCustomer(customer_id))
    .filter(s => !s.isPaid)
    .sort((a, b) => new Date(a.sale.sale_datetime) - new Date(b.sale.sale_datetime));

  if (Array.isArray(sale_ids) && sale_ids.length) {
    const wanted = new Set(sale_ids.map(String));
    pending = pending.filter(s => wanted.has(String(s.sale._id)));
    if (pending.length !== wanted.size)
      throw badReq('One or more selected sales are not pending for this customer');
  }
  return pending;
};

const allocateOldestFirst = (pending, totalC) => {
  let left = totalC;
  const allocations = [];
  for (const s of pending) {
    if (left <= 0) break;
    const takeC = Math.min(left, toCents(s.balanceDue));
    if (takeC <= 0) continue;
    allocations.push({ summary: s, takeC });
    left -= takeC;
  }
  return allocations;
};

const syncAllocations = async (allocations) => {
  const lines = [];
  for (const a of allocations) {
    const r = await syncSalePaymentStatus(a.summary.sale._id);
    lines.push({
      sale_no:       a.summary.sale.sale_no,
      sale_date:     a.summary.sale.sale_datetime,
      invoice_total: a.summary.sale.total_revenue,
      applied:       fromCents(a.takeC),
      balance_after: r.balanceDue,
      is_paid:       r.balanceDue <= 0.001,
    });
  }
  return lines;
};

const addCustomerPayment = async ({ customer_id, amount, payment_date, notes, sale_ids }, user) => {
  const amountC = toCents(amount);
  if (!Number.isFinite(amountC) || amountC <= 0) throw badReq('Enter a valid amount');

  const customer = await Customer.findById(customer_id);
  if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });

  const pending = await loadPending(customer_id, sale_ids);

  const maxC     = pending.reduce((a, s) => a + toCents(s.balanceDue), 0);
  const payC     = Math.min(amountC, maxC);   // goes to the sales
  const advanceC = amountC - payC;            // kept as advance
  const allocations = allocateOldestFirst(pending, payC);

  const receipt_no = await generateSequence('RCP');
  // today -> the real current time (shows correctly on the slip); a back-dated entry -> midday Colombo time
  const todayLK = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
  const when = (!payment_date || payment_date === todayLK) ? new Date() : new Date(`${payment_date}T12:00:00+05:30`);
  const created = [];
  let deposit = null;
  try {
    for (const a of allocations) {
      const payment_no = await generateSequence('PAY');
      created.push(await Payment.create({
        payment_no, receipt_no,
        sale_id: a.summary.sale._id,
        customer_id,
        amount: fromCents(a.takeC),
        payment_date: when,
        notes: notes ?? '',
        recorded_by: user?._id,
      }));
    }
    if (advanceC > 0) {
      deposit = await advance.addDeposit({ customer_id, amountC: advanceC, receipt_no, date: when, notes, user });
    }
  } catch (err) {
    // nothing is half-saved: undo whatever was created for this receipt
    await Payment.deleteMany({ _id: { $in: created.map(p => p._id) } });
    if (deposit) await CustomerAdvance.deleteOne({ _id: deposit._id });
    throw err;
  }

  const lines = await syncAllocations(allocations);

  const outstandingAfter = await getCustomerTotalOutstanding(customer_id);
  const advanceBalance   = await advance.getBalance(customer_id);
  const receipt = {
    receipt_no, payment_date: when, amount: fromCents(amountC), notes: notes ?? '',
    advance_added: fromCents(advanceC), advance_balance: advanceBalance,
  };

  // ── WhatsApp (fire-and-forget): one admin alert + ONE slip to the customer ──
  notifyReceiptRecorded(customer, receipt, lines, outstandingAfter)
    .catch(err => console.error('[WhatsApp] Receipt notify failed:', err.message));
  sendReceiptSlipToCustomer(customer, receipt, lines, outstandingAfter)
    .catch(err => console.error('[WhatsApp] Receipt slip send failed:', err.message));

  return {
    receipt_no, amount: receipt.amount, payment_date: when, allocations: lines, outstandingAfter,
    advance_added: receipt.advance_added, advance_balance: advanceBalance,
  };
};

// ── Use the customer's advance to pay pending sales ─────────────────────────
// amount omitted -> as much as possible (min of advance balance and outstanding)
const applyAdvance = async ({ customer_id, amount, sale_ids, notifyCustomer = true }, user) => {
  const customer = await Customer.findById(customer_id);
  if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });

  const balC = await advance.getBalanceCents(customer_id);
  if (balC <= 0) throw badReq('This customer has no advance balance');

  const pending = await loadPending(customer_id, sale_ids);
  if (pending.length === 0) throw badReq('No pending balances for this customer');
  const maxC = pending.reduce((a, s) => a + toCents(s.balanceDue), 0);

  const hasAmount = amount !== undefined && amount !== null && amount !== '';
  const useC = hasAmount ? toCents(amount) : Math.min(balC, maxC);
  if (!Number.isFinite(useC) || useC <= 0) throw badReq('Enter a valid amount');
  if (useC > balC) throw badReq(`Amount exceeds the advance balance (LKR ${fromCents(balC).toFixed(2)})`);
  if (useC > maxC) throw badReq(`Amount exceeds the outstanding balance (max LKR ${fromCents(maxC).toFixed(2)})`);

  const allocations = allocateOldestFirst(pending, useC);
  const receipt_no = await generateSequence('ADV');
  const when = new Date();
  const created = [];
  const entries = [];
  const rollback = async () => {
    await Payment.deleteMany({ _id: { $in: created.map(p => p._id) } });
    await CustomerAdvance.deleteMany({ _id: { $in: entries.map(e => e._id) } });
  };
  try {
    for (const a of allocations) {
      const payment_no = await generateSequence('PAY');
      const p = await Payment.create({
        payment_no, receipt_no,
        sale_id: a.summary.sale._id,
        customer_id,
        amount: fromCents(a.takeC),
        payment_date: when,
        source: 'ADVANCE',
        notes: 'Paid from advance',
        recorded_by: user?._id,
      });
      created.push(p);
      entries.push(await advance.addApplied({
        customer_id, amountC: a.takeC, receipt_no, sale_id: a.summary.sale._id, payment_id: p._id, date: when, user,
      }));
    }
    // two requests at the same moment must never spend the same advance twice
    if ((await advance.getBalanceCents(customer_id)) < 0) {
      await rollback();
      throw badReq('Advance balance changed - please try again');
    }
  } catch (err) {
    if (err.statusCode !== 400) await rollback();
    throw err;
  }

  const lines = await syncAllocations(allocations);
  const outstandingAfter = await getCustomerTotalOutstanding(customer_id);
  const advanceBalance   = await advance.getBalance(customer_id);
  const receipt = {
    receipt_no, payment_date: when, amount: fromCents(useC), notes: 'Paid from advance',
    source: 'ADVANCE', advance_added: 0, advance_balance: advanceBalance,
  };

  notifyReceiptRecorded(customer, receipt, lines, outstandingAfter)
    .catch(err => console.error('[WhatsApp] Receipt notify failed:', err.message));
  if (notifyCustomer) {
    sendReceiptSlipToCustomer(customer, receipt, lines, outstandingAfter)
      .catch(err => console.error('[WhatsApp] Receipt slip send failed:', err.message));
  }

  return {
    receipt_no, amount: receipt.amount, payment_date: when, allocations: lines, outstandingAfter,
    advance_used: receipt.amount, advance_balance: advanceBalance,
  };
};

const notifyReceiptRecorded = async (customer, receipt, lines, outstandingAfter) => {
  const rows = lines.map(l =>
    `• ${l.sale_no}: LKR ${l.applied.toFixed(2)}${l.is_paid ? ' ✅' : ` (balance ${l.balance_after.toFixed(2)})`}`
  ).join('\n');
  const fromAdvance = receipt.source === 'ADVANCE';
  return sendWhatsApp(
    `${fromAdvance ? '🏦 *Advance Used*' : '💵 *Payment Received*'}\n` +
    `👤 Customer: ${customer?.name || 'N/A'}\n` +
    `🧾 Receipt: ${receipt.receipt_no}\n` +
    `💰 Amount: LKR ${receipt.amount.toFixed(2)}\n` +
    (rows ? `${rows}\n` : '') +
    (receipt.advance_added > 0 ? `➕ Kept as advance: LKR ${receipt.advance_added.toFixed(2)}\n` : '') +
    (receipt.advance_balance > 0 ? `🏦 Advance balance: LKR ${receipt.advance_balance.toFixed(2)}\n` : '') +
    `📉 Total Outstanding: LKR ${Number(outstandingAfter).toFixed(2)}\n` +
    `🕐 ${new Date(receipt.payment_date).toLocaleString('en-LK')}`
  );
};

const sendReceiptSlipToCustomer = async (customer, receipt, lines, outstandingAfter) => {
  const phone = formatPhoneForWhatsApp(customer?.phone);
  if (!phone) {
    console.warn(`[WhatsApp] Customer ${customer?.customer_code || customer?._id} has no usable phone - skipping receipt slip.`);
    return;
  }
  const printerService = require('./printer.service');
  const filePath = await printerService.buildReceiptPdfFile({ customer, receipt, lines, outstandingAfter });

  const fromAdvance = receipt.source === 'ADVANCE';
  const adv = receipt.advance_added > 0
    ? ` LKR ${receipt.advance_added.toFixed(2)} is kept as your advance balance.` : '';
  const caption = fromAdvance
    ? `Hi ${customer.name} 👋, LKR ${receipt.amount.toFixed(2)} of your advance was used to pay your orders.` +
      (outstandingAfter <= 0.001 ? ' All your orders are now fully paid ✅.' : ` Total outstanding balance: LKR ${Number(outstandingAfter).toFixed(2)}.`) +
      (receipt.advance_balance > 0 ? ` Advance balance left: LKR ${receipt.advance_balance.toFixed(2)}.` : '')
    : outstandingAfter <= 0.001
      ? `Hi ${customer.name} 👋, we received your payment of LKR ${receipt.amount.toFixed(2)} 💵. All your orders are now fully paid ✅.${adv}`
      : `Hi ${customer.name} 👋, we received your payment of LKR ${receipt.amount.toFixed(2)} 💵. Total outstanding balance: LKR ${Number(outstandingAfter).toFixed(2)}.${adv}`;

  try {
    const pdf = await fs.promises.readFile(filePath);
    const result = await sendWhatsAppDocument(phone, pdf, `Receipt-${receipt.receipt_no}.pdf`, caption);
    if (!result.success) console.error('[WhatsApp] Receipt slip send failed:', result.error);
  } finally {
    fs.promises.unlink(filePath).catch(() => {});
  }
};

// Delete a whole receipt in one go:
//  - cash receipt  -> its per-sale payments (and the advance it created, if still unspent)
//  - advance receipt (ADV-...) -> its payments, and the advance goes back to the customer
const removeReceipt = async (receipt_no) => {
  const payments = await Payment.find({ receipt_no });
  const deposits = await CustomerAdvance.find({ receipt_no, type: 'DEPOSIT' });
  if (payments.length === 0 && deposits.length === 0)
    throw Object.assign(new Error('Receipt not found'), { statusCode: 404 });

  // the advance created by this receipt can only go if it has not been spent already
  for (const d of deposits) {
    const balC = await advance.getBalanceCents(d.customer_id);
    if (balC - toCents(d.amount) < 0)
      throw badReq('The advance from this receipt has already been used on other sales. Remove those payments first.');
  }

  const advancePaymentIds = payments.filter(p => p.source === 'ADVANCE').map(p => p._id);
  if (advancePaymentIds.length) await advance.releaseForPayments(advancePaymentIds);
  await Payment.deleteMany({ receipt_no });
  if (deposits.length) await CustomerAdvance.deleteMany({ receipt_no, type: 'DEPOSIT' });

  for (const sid of new Set(payments.map(p => String(p.sale_id)))) {
    await syncSalePaymentStatus(sid);
  }
  return {
    deleted: payments.length,
    advance_removed: advance.fromCents(deposits.reduce((s, d) => s + toCents(d.amount), 0)),
  };
};

module.exports = {
  addPayment, getBySale, getByCustomer, getCreditSummaryByCustomer, getById, remove, getTotalPaid,
  printDueSlip, printCustomerDueSlip, sendPaymentSlipToCustomer, getCustomerTotalOutstanding,
  getAllInRange, addCustomerPayment, applyAdvance, removeReceipt, getAllCustomerBalances,
};
