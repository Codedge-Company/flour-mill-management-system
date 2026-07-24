// models/Order.js
//
// A forward/pre-order with an expected delivery date. Creating an order
// does NOT touch stock. Marking it "Done" does: it creates a real Sale
// (same as approving a Sale Request does) and deducts Inventory at that
// point — not at creation — since the expected date may be weeks out and
// stock naturally gets replenished before then.

const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  pack_type_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PackType', required: true },
  qty: { type: Number, required: true, min: 1 },
  unit_price: { type: Number, required: true, min: 0 },
  line_total: { type: Number, default: 0 },
}, { _id: true });

const orderSchema = new mongoose.Schema({
  order_no: { type: String, required: true, unique: true },

  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  created_by:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  payment_method: { type: String, enum: ['CASH', 'CREDIT'], required: true },

  // When the customer expects/wants this order fulfilled.
  expected_date: { type: Date, required: true },

  items: [orderItemSchema],
  total_amount: { type: Number, default: 0 },

  notes: { type: String, default: '', trim: true },

  status: { type: String, enum: ['PENDING', 'COMPLETED'], default: 'PENDING' },
  completed_at: { type: Date, default: null },
  completed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Set once "Done" creates the real Sale + deducts stock.
  sale_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null },
}, { timestamps: true });

orderSchema.index({ status: 1, expected_date: 1 });
orderSchema.index({ created_by: 1, createdAt: -1 });
orderSchema.index({ order_no: 1 });

module.exports = mongoose.model('Order', orderSchema);