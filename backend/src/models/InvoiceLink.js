const mongoose = require('mongoose');

const invoiceLinkSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true, index: true },
  file_path: { type: String, required: true },
  filename: { type: String, required: true },
  expires_at: { type: Date, required: true },
}, { timestamps: true });

module.exports = mongoose.model('InvoiceLink', invoiceLinkSchema);