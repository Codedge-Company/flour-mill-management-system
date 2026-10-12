// models/EmptyBagStock.js
// Empty (unfilled) bags in the store room, one document per pack type.
// Rice that has been packed lives in Inventory; this is the bags waiting to be filled.
const mongoose = require('mongoose');

const emptyBagStockSchema = new mongoose.Schema({
  pack_type_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'PackType', required: true, unique: true },
  stock_qty:       { type: Number, required: true, default: 0 },
  // 0 = no low-stock alert for this pack type
  threshold_qty:   { type: Number, required: true, default: 0, min: 0 },
  last_updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('EmptyBagStock', emptyBagStockSchema);
