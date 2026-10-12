// models/MachineLog.js
// FULL REPLACEMENT. Everything that existed before is unchanged; the new
// "Daily Production Sheet" fields are added at the bottom of the schema.
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionNumber:  { type: Number, required: true },
  startTime:      { type: Date,    default: null },
  stopTime:       { type: Date,    default: null },
  startNotified:  { type: Boolean, default: false },
  stopNotified:   { type: Boolean, default: false },
});

// One grinding batch (GR0930, GR0930-2, ...). A day can have several.
const grindBatchSchema = new mongoose.Schema(
  {
    batchNo:  { type: String, required: true },
    operator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    partner:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    input:    { type: Number, default: null },
    output:   { type: Number, default: null },
  },
  { _id: true }
);

// One pack type + quantity. Used for packing, empty bags received and the
// end-of-day count. These arrays also remember what was ALREADY applied to
// stock, so a re-save only applies the difference.
const stockLineSchema = new mongoose.Schema(
  {
    packTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'PackType', required: true },
    qty:        { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const machineLogSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },

    // A log can exist with ONLY stock data before any operator/partner is assigned.
    operator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, default: null },
    partner:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, default: null },

    batchNo:   { type: String, default: null },

    sessions: { type: [sessionSchema], default: [] },

    hasStockEntry:    { type: Boolean, default: false },
    rawRiceReceived:  { type: Number,  default: null },
    // Legacy day totals. The daily sheet keeps these in sync (sum of all grind
    // batches) so the Material Store, sifting page and dashboards keep working.
    input:            { type: Number,  default: null },
    output:           { type: Number,  default: null },
    rejection:        { type: Number,  default: null },
    rejectionDate:    { type: Date,    default: null },

    // ── Daily Production Sheet ───────────────────────────────────────────
    grindBatches:      { type: [grindBatchSchema], default: [] },
    packing:           { type: [stockLineSchema],  default: [] },
    emptyBagsReceived: { type: [stockLineSchema],  default: [] },
    endOfDayStock:     { type: [stockLineSchema],  default: [] },
    endStockSavedAt:   { type: Date, default: null },
    endStockSentAt:    { type: Date, default: null },
  },
  { timestamps: true }
);

machineLogSchema.index({ date: 1 }, { unique: true });

module.exports = mongoose.model('MachineLog', machineLogSchema);
