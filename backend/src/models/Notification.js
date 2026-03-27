// models/Notification.js  — updated to support SALE_REQUEST / SALE_APPROVED / SALE_REJECTED
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      // ── Stock alerts (existing) ──────────────────────────────────────
      'LOW_STOCK', 'OUT_OF_STOCK', 'REORDER_NEEDED', 'STOCK_UPDATE',
      // ── Sale-request workflow (new) ──────────────────────────────────
      'SALE_REQUEST', 'SALE_APPROVED', 'SALE_REJECTED',
    ],
    required: true,
  },

  // ── Stock-alert fields (optional for sale notifications) ─────────────
  pack_type_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'PackType', default: null },
  current_stock:  { type: Number, default: null },
  previous_stock: { type: Number, default: null },
  threshold:      { type: Number, default: null },

  // ── Sale-request fields (optional for stock notifications) ────────────
  sale_request_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SaleRequest', default: null },

  // ── Common ─────────────────────────────────────────────────────────────
  message:    { type: String, required: true },
  is_read:    { type: Boolean, default: false },
  created_at: { type: Date,   default: Date.now },
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});

module.exports = mongoose.model('Notification', notificationSchema);
