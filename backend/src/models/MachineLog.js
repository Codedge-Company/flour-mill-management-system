// models/MachineLog.js
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionNumber:  { type: Number, required: true },
  startTime:      { type: Date,    default: null },
  stopTime:       { type: Date,    default: null },
  startNotified:  { type: Boolean, default: false },
  stopNotified:   { type: Boolean, default: false },
});

const machineLogSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },

    // ── CHANGED: no longer strictly required ──────────────────────────────
    // A log can now exist with ONLY stock data (created from the standalone
    // Raw Rice Stock Entry page) before any operator/partner is assigned.
    operator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, default: null },
    partner:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, default: null },

    batchNo:   { type: String, default: null },

    sessions: { type: [sessionSchema], default: [] },

    hasStockEntry:    { type: Boolean, default: false },
    rawRiceReceived:  { type: Number,  default: null },
    input:            { type: Number,  default: null },
    output:           { type: Number,  default: null },
    rejection:        { type: Number,  default: null },
    rejectionDate:    { type: Date,    default: null },
  },
  { timestamps: true }
);

machineLogSchema.index({ date: 1 }, { unique: true });

module.exports = mongoose.model('MachineLog', machineLogSchema);