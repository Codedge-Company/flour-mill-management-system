// backend/models/CustomerAdvance.js
// Ledger of the money a customer has paid IN ADVANCE (more than what they owed).
//   DEPOSIT  -> money kept as advance (from a customer payment that exceeded the outstanding)
//   APPLIED  -> advance that was used to pay a sale (one row per Payment created from it)
// Balance = sum(DEPOSIT) - sum(APPLIED). It is always computed from this ledger, never stored.
const mongoose = require('mongoose');

const customerAdvanceSchema = new mongoose.Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  type:        { type: String, enum: ['DEPOSIT', 'APPLIED'], required: true },
  amount:      { type: Number, required: true, min: 0.01 },
  entry_date:  { type: Date, required: true, default: Date.now },
  receipt_no:  { type: String, default: '', index: true },
  sale_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', index: true },     // APPLIED only
  payment_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', index: true },  // APPLIED only
  notes:       { type: String, default: '' },
  recorded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false },
});

module.exports = mongoose.model('CustomerAdvance', customerAdvanceSchema);
