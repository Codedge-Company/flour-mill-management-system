// backend/src/controllers/capital.controller.js
const capitalSvc   = require('../services/capital.service');
const flowMoneySvc = require('../services/flowMoney.service');

// GET /api/capital
const getAllCapital = async (req, res) => {
  try {
    const entries = await capitalSvc.getAll();
    res.json({ success: true, data: entries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch capital entries' });
  }
};

// POST /api/capital
const createCapital = async (req, res) => {
  try {
    const { amount, label, capital_date, note } = req.body;

    if (amount === undefined || amount === null || !capital_date) {
      return res.status(400).json({ success: false, message: 'amount and capital_date are required' });
    }

    const doc = await capitalSvc.create({
      amount:       Number(amount),
      label,
      capital_date,
      note,
      userId:       req.user._id,
    });

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create capital entry' });
  }
};

// DELETE /api/capital/:id
const deleteCapital = async (req, res) => {
  try {
    const deleted = await capitalSvc.remove(req.params.id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Capital entry not found' });
    }

    res.json({ success: true, message: 'Capital entry deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to delete capital entry' });
  }
};

// GET /api/capital/flow?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
const getFlowTimeline = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const result = await flowMoneySvc.getTimeline(dateFrom || null, dateTo || null);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch money flow timeline' });
  }
};

module.exports = { getAllCapital, createCapital, deleteCapital, getFlowTimeline };