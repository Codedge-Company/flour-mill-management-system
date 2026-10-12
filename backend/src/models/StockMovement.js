// models/StockMovement.js
// Audit ledger: every change the daily sheet (or a manual correction) makes to
// packed-rice stock or empty-bag stock. Not used for calculations, only for tracing.
const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema(
  {
    date:         { type: Date, required: true },
    machineLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'MachineLog', default: null },
    packTypeId:   { type: mongoose.Schema.Types.ObjectId, ref: 'PackType', required: true },
    stock:        { type: String, enum: ['RICE', 'EMPTY_BAG'], required: true },
    delta:        { type: Number, required: true },
    reason:       {
      type: String,
      enum: ['PACKING', 'PACKING_BAGS_USED', 'EMPTY_BAGS_RECEIVED', 'ADJUSTMENT'],
      required: true,
    },
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

stockMovementSchema.index({ packTypeId: 1, createdAt: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
