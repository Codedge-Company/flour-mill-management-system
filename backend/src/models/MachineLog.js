const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionNumber: { type: Number, required: true }, // 1, 2, or 3
  startTime: { type: Date, default: null },
  stopTime: { type: Date, default: null },
  startNotified: { type: Boolean, default: false },
  stopNotified: { type: Boolean, default: false },
});

const machineLogSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    operator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sessions: { type: [sessionSchema], default: [] },

    // Optional stock section — only filled on some days
    hasStockEntry: { type: Boolean, default: false },
    rawRiceReceived: { type: Number, default: null },
    input: { type: Number, default: null },
    output: { type: Number, default: null },
    rejection: { type: Number, default: null },
    rejectionDate: { type: Date, default: null },
  },
  { timestamps: true }
);

// One log per date (date stored as start-of-day UTC)
machineLogSchema.index({ date: 1 }, { unique: true });

module.exports = mongoose.model('MachineLog', machineLogSchema);
