const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
    pack_type_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PackType', required: true, unique: true },
    stock_qty: { type: Number, required: true, default: 0 },
    last_updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Inventory', inventorySchema);