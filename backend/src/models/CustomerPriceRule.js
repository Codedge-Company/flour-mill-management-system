const mongoose = require('mongoose');

const customerPriceRuleSchema = new mongoose.Schema({
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    pack_type_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PackType', required: true },
    unit_sell_price: { type: Number, required: true },
    effective_from: { type: Date, default: Date.now },
    is_active: { type: Boolean, default: true },
});

customerPriceRuleSchema.index({ customer_id: 1, pack_type_id: 1 });

module.exports = mongoose.model('CustomerPriceRule', customerPriceRuleSchema);