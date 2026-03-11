// backend/src/controllers/budget.controller.js
const budgetSvc = require('../services/budget.service');

// GET /api/budget  — returns budget + expenditures + computed summary
const getBudget = async (req, res) => {
  try {
    const result = await budgetSvc.getSummary();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to fetch budget',
    });
  }
};

// GET /api/budget/amount  — lightweight: just the budget amount
const getBudgetAmount = async (req, res) => {
  try {
    const doc = await budgetSvc.get();
    res.json({ success: true, data: { amount: doc.amount, label: doc.label } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/budget  — upsert the budget amount (admin only)
const updateBudget = async (req, res) => {
  try {
    const { amount, label } = req.body;

    if (amount === undefined || amount === null) {
      return res.status(400).json({ success: false, message: 'amount is required' });
    }

    const doc = await budgetSvc.upsert({
      amount,
      label,
      userId: req.user?._id,
    });

    res.json({ success: true, data: { amount: doc.amount, label: doc.label } });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to update budget',
    });
  }
};

module.exports = { getBudget, getBudgetAmount, updateBudget };