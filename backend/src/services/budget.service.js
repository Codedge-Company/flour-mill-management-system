// backend/src/services/budget.service.js
const Budget = require('../models/Budget');
const Expenditure = require('../models/Expenditure');

/**
 * Get the singleton budget document.
 * If it doesn't exist yet, returns a default { amount: 0, label: '' }.
 */
const get = async () => {
  const doc = await Budget.findOne({ key: 'main' }).lean();
  if (!doc) return { amount: 0, label: '', key: 'main', createdAt: null, updatedAt: null };
  return doc;
};

/**
 * Upsert the singleton budget document.
 */
const upsert = async ({ amount, label, userId }) => {
  const amt = Number(amount);
  if (isNaN(amt) || amt < 0) {
    throw Object.assign(new Error('Amount must be a non-negative number'), { statusCode: 400 });
  }

  const patch = { amount: amt };
  if (label !== undefined) patch.label = String(label).trim();
  if (userId) patch.updated_by = userId;

  return Budget.findOneAndUpdate(
    { key: 'main' },
    { $set: patch },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
};

/**
 * Return the budget document PLUS a live summary of all expenditures,
 * so the frontend gets everything it needs in one call.
 */
const getSummary = async () => {
  const [budget, expenditures] = await Promise.all([
    get(),
    Expenditure.find().sort({ date: -1 }).lean(),
  ]);

  const totalSpent = expenditures.reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const balance    = budget.amount - totalSpent;

  return {
    budget: {
      amount:    budget.amount,
      label:     budget.label ?? '',
      updatedAt: budget.updatedAt ?? null,
    },
    expenditures,
    summary: {
      totalBudget: budget.amount,
      totalSpent,
      balance,
      spentPercent: budget.amount > 0
        ? Math.min((totalSpent / budget.amount) * 100, 100)
        : 0,
      count: expenditures.length,
    },
  };
};

module.exports = { get, upsert, getSummary };