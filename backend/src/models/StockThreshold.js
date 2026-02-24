const mongoose = require('mongoose');

const stockThresholdSchema = new mongoose.Schema({
    pack_type_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PackType', required: true, unique: true },
    threshold_qty: { type: Number, required: true, default: 0 },
}, { timestamps: { createdAt: false, updatedAt: 'updated_at' } });

module.exports = mongoose.model('StockThreshold', stockThresholdSchema);