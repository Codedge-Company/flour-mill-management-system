const mongoose = require('mongoose');

const sievingPartSchema = new mongoose.Schema(
  {
    partNo:    { type: Number, required: true },   // 1, 2, 3 …
    input:     { type: Number, default: null },
    output:    { type: Number, default: null },
    rejection: { type: Number, default: null },
    note:      { type: String, default: '' },
  },
  { _id: true, timestamps: true }
);

const sievingLogSchema = new mongoose.Schema(
  {
    machineLogId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MachineLog',
      required: true,
    },
    batchNo: { type: String, required: true },

    operator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // partner removed — single operator per log

    date: { type: Date, required: true },

    parts: [sievingPartSchema],   // ← replaces flat input/output/rejection

    isCompleted:        { type: Boolean, default: false },
    completedAt:        { type: Date,    default: null },
    completionNotified: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// ── Virtuals ───────────────────────────────────────────────────────────────
sievingLogSchema.virtual('totalInput').get(function () {
  return this.parts.reduce((s, p) => s + (p.input ?? 0), 0);
});
sievingLogSchema.virtual('totalOutput').get(function () {
  return this.parts.reduce((s, p) => s + (p.output ?? 0), 0);
});
sievingLogSchema.virtual('totalRejection').get(function () {
  return this.parts.reduce((s, p) => s + (p.rejection ?? 0), 0);
});

module.exports = mongoose.model('SievingLog', sievingLogSchema);