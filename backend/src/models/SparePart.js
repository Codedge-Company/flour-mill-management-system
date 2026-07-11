// models/SparePart.js
const mongoose = require('mongoose');

const sparePartSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // e.g. Belt, Bearing, Motor, Electrical, General
    category: { type: String, default: 'General', trim: true },

    // e.g. pcs, set, m, kg
    unit: { type: String, default: 'pcs', trim: true },

    qty: { type: Number, required: true, default: 0, min: 0 },
    threshold_qty: { type: Number, required: true, default: 0, min: 0 },

    // supplier name / part no / free-text notes
    supplier_notes: { type: String, default: '', trim: true },

    last_updated_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

sparePartSchema.index({ name: 1 });
sparePartSchema.index({ category: 1 });

module.exports = mongoose.model('SparePart', sparePartSchema);
