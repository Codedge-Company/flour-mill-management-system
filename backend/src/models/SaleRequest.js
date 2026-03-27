const mongoose = require('mongoose');

const requestItemSchema = new mongoose.Schema({
  pack_type_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'PackType', required: true },
  qty:             { type: Number, required: true, min: 1 },
  unit_price_sold: { type: Number, required: true, min: 0 },
  line_revenue:    { type: Number, default: 0 },
}, { _id: true });

const saleRequestSchema = new mongoose.Schema({
  request_no:      { type: String, required: true, unique: true },

  // Who submitted + who will execute
  requested_by:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sales_person_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Sale details
  customer_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  payment_method:  { type: String, enum: ['CASH', 'CREDIT'], required: true },
  request_datetime: { type: Date, default: Date.now },
  items:           [requestItemSchema],
  total_preview:   { type: Number, default: 0 },   // sum(qty * unit_price_sold)

  // Approval workflow
  status: {
    type:    String,
    enum:    ['PENDING', 'APPROVED', 'REJECTED', 'SAVED'],
    default: 'PENDING',
  },
  reviewed_by:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewed_at:  { type: Date, default: null },
  review_note:  { type: String, default: null },

  // After operator saves → actual sale reference
  sale_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null },

  // Track notifications
  whatsapp_sent:   { type: Boolean, default: false },
  notified_admins: { type: Boolean, default: false },
}, { timestamps: true });

saleRequestSchema.index({ requested_by: 1, createdAt: -1 });
saleRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('SaleRequest', saleRequestSchema);
