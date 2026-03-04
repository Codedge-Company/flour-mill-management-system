// backend/models/Payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  payment_no:   { type: String, required: true, unique: true },  // PAY-000001
  sale_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'Sale',     required: true },
  customer_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  amount:       { type: Number, required: true, min: 0.01 },
  payment_date: { type: Date, required: true, default: Date.now },
  notes:        { type: String, default: '' },
  recorded_by:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

paymentSchema.index({ sale_id: 1 });
paymentSchema.index({ customer_id: 1 });
paymentSchema.index({ payment_date: -1 });

module.exports = mongoose.model('Payment', paymentSchema);