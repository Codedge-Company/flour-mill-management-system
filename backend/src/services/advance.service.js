// backend/services/advance.service.js
// Customer advance (credit balance) ledger helpers. No dependency on payment.service.
const mongoose = require('mongoose');
const CustomerAdvance = require('../models/CustomerAdvance');

const toCents   = (n) => Math.round(Number(n) * 100);
const fromCents = (c) => c / 100;
const oid = (id) => (typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id);

// balance in cents (exact integer)
const getBalanceCents = async (customer_id) => {
  const agg = await CustomerAdvance.aggregate([
    { $match: { customer_id: oid(customer_id) } },
    { $group: { _id: '$type', total: { $sum: '$amount' } } },
  ]);
  const t = Object.fromEntries(agg.map(a => [a._id, toCents(a.total)]));
  return (t.DEPOSIT || 0) - (t.APPLIED || 0);
};

const getBalance = async (customer_id) => fromCents(Math.max(0, await getBalanceCents(customer_id)));

// { "<customerId>": balance } for every customer that has a positive balance
const getAllBalances = async () => {
  const agg = await CustomerAdvance.aggregate([
    { $group: { _id: { c: '$customer_id', t: '$type' }, total: { $sum: '$amount' } } },
  ]);
  const cents = {};
  for (const a of agg) {
    const k = String(a._id.c);
    cents[k] = (cents[k] || 0) + (a._id.t === 'DEPOSIT' ? 1 : -1) * toCents(a.total);
  }
  const out = {};
  for (const [k, c] of Object.entries(cents)) if (c > 0) out[k] = fromCents(c);
  return out;
};

const addDeposit = ({ customer_id, amountC, receipt_no, date, notes, user }) =>
  CustomerAdvance.create({
    customer_id, type: 'DEPOSIT', amount: fromCents(amountC),
    receipt_no, entry_date: date || new Date(), notes: notes ?? '', recorded_by: user?._id,
  });

const addApplied = ({ customer_id, amountC, receipt_no, sale_id, payment_id, date, notes, user }) =>
  CustomerAdvance.create({
    customer_id, type: 'APPLIED', amount: fromCents(amountC),
    receipt_no, sale_id, payment_id, entry_date: date || new Date(), notes: notes ?? '', recorded_by: user?._id,
  });

// Return advance that was used on payments that are being deleted
const releaseForPayments = (payment_ids) =>
  CustomerAdvance.deleteMany({ type: 'APPLIED', payment_id: { $in: payment_ids } });

// Return advance that was used on a sale that is being cancelled / deleted
const releaseForSale = (sale_id) =>
  CustomerAdvance.deleteMany({ type: 'APPLIED', sale_id });

const getEntries = (customer_id) =>
  CustomerAdvance.find({ customer_id })
    .populate('sale_id', 'sale_no')
    .sort({ entry_date: -1, created_at: -1 })
    .lean();

module.exports = {
  toCents, fromCents, getBalanceCents, getBalance, getAllBalances,
  addDeposit, addApplied, releaseForPayments, releaseForSale, getEntries,
};
