const mongoose = require('mongoose');

const packTypeSchema = new mongoose.Schema({
    pack_name: { type: String, required: true, unique: true },
    weight_kg: { type: Number, required: true },
    is_active: { type: Boolean, default: true },
});

module.exports = mongoose.model('PackType', packTypeSchema);