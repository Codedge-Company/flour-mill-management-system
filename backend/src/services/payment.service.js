// backend/services/payment.service.js
const Payment  = require('../models/Payment');
const Sale     = require('../models/Sale');
const mongoose = require('mongoose');
const { generateSequence } = require('../utils/sequence');

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

  await syncSalePaymentStatus(sale_id);

  return Payment.findById(payment._id)
    .populate('sale_id',     'sale_no total_revenue')
    .populate('customer_id', 'name customer_code')
    .populate('recorded_by', 'full_name username');
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
  const p = await Payment.findByIdAndDelete(id);
  if (!p) throw Object.assign(new Error('Payment not found'), { statusCode: 404 });
  await syncSalePaymentStatus(p.sale_id);
};

module.exports = { addPayment, getBySale, getByCustomer, getCreditSummaryByCustomer, getById, remove, getTotalPaid };