// backend/models/BudgetEntry.js
const mongoose = require('mongoose');

const budgetEntrySchema = new mongoose.Schema(
  {
    description: {
      type:     String,
      required: true,
      trim:     true,
    },
    amount: {
      type:     Number,
      required: true,
      min:      0,
    },
    date: {
      type:    Date,
      default: Date.now,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BudgetEntry', budgetEntrySchema);