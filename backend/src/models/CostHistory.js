const mongoose = require('mongoose');

const costHistorySchema = new mongoose.Schema({
    pack_type_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PackType', required: true },
    unit_cost: { type: Number, required: true },
    effective_from: { type: Date, default: Date.now },
    updated_by_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

costHistorySchema.index({ pack_type_id: 1, effective_from: -1 });

module.exports = mongoose.model('CostHistory', costHistorySchema);