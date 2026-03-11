// backend/src/models/Capital.js
const mongoose = require('mongoose');

const capitalSchema = new mongoose.Schema({
  amount:       { type: Number, required: true },
  label:        { type: String, default: '' },
  capital_date: { type: Date, required: true },
  added_by:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  note:         { type: String, default: '' },
}, { timestamps: true });

capitalSchema.index({ capital_date: 1 });

module.exports = mongoose.model('Capital', capitalSchema);