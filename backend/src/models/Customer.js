const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  customer_code: { type: String, required: true, unique: true },
  name:          { type: String, required: true, maxlength: 150 },
  phone:         { type: String },
  address:       { type: String },
  notes:         { type: String },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('Customer', customerSchema);