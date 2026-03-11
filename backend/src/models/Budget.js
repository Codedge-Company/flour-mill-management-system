// backend/src/models/Budget.js
// Single-document singleton — only one budget record ever exists (upserted by key).
const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema(
  {
    key: {
      // Singleton key — always "main". Ensures only one document exists.
      type: String,
      default: 'main',
      unique: true,
      immutable: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    label: {
      // Optional label, e.g. "Monthly Budget", "Q1 2025"
      type: String,
      default: '',
      trim: true,
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Budget', budgetSchema);