const mongoose = require('mongoose');

const defaultPriceSchema = new mongoose.Schema({
    pack_type_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PackType', required: true },
    unit_sell_price: { type: Number, required: true },
    effective_from: { type: Date, default: Date.now },
    is_active: { type: Boolean, default: true },
});

defaultPriceSchema.index({ pack_type_id: 1, effective_from: -1 });

module.exports = mongoose.model('DefaultPrice', defaultPriceSchema);