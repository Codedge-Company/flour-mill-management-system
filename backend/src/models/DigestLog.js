// models/DigestLog.js
// One document per Colombo day. The unique `date` is the lock that stops two running
// backends (e.g. the server and the Electron app) from both sending the same digest.
const mongoose = require('mongoose');

const digestLogSchema = new mongoose.Schema(
  {
    date:      { type: String, required: true, unique: true }, // YYYY-MM-DD (Colombo)
    status:    { type: String, enum: ['sending', 'sent', 'skipped'], default: 'sending' },
    claimedAt: { type: Date, default: Date.now },
    sentAt:    { type: Date, default: null },
    note:      { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.models.DigestLog || mongoose.model('DigestLog', digestLogSchema);
