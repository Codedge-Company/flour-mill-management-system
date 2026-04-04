// machineLog.controller.js
const machineLogService = require('../services/machineLog.service');

// GET /api/machine-logs/today?date=YYYY-MM-DD
const getOrCreateLog = async (req, res) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const { operatorId, partnerId } = req.query;
    const log = await machineLogService.getOrCreateLog(date, operatorId, partnerId);
    res.json({ success: true, data: log });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/machine-logs/by-date?date=YYYY-MM-DD
const getLogByDate = async (req, res) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const log = await machineLogService.getLogByDate(date);
    res.json({ success: true, data: log });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/machine-logs
const createLog = async (req, res) => {
  try {
    const { date, operatorId, partnerId } = req.body;
    const log = await machineLogService.getOrCreateLog(
      date ? new Date(date) : new Date(),
      operatorId,
      partnerId
    );
    res.status(201).json({ success: true, data: log });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/machine-logs/:id/operators
const updateOperators = async (req, res) => {
  try {
    const { operatorId, partnerId } = req.body;
    const log = await machineLogService.updateOperators(req.params.id, operatorId, partnerId);
    res.json({ success: true, data: log });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/machine-logs/:id/sessions/:sessionNumber/start
const recordStart = async (req, res) => {
  try {
    const sessionNumber = parseInt(req.params.sessionNumber, 10);
    if (![1, 2, 3, 4].includes(sessionNumber)) {
      return res.status(400).json({ success: false, message: 'Session number must be 1, 2, or 3' });
    }
    const log = await machineLogService.recordStart(req.params.id, sessionNumber);
    res.json({ success: true, data: log });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// POST /api/machine-logs/:id/sessions/:sessionNumber/stop
const recordStop = async (req, res) => {
  try {
    const sessionNumber = parseInt(req.params.sessionNumber, 10);
    if (![1, 2, 3, 4].includes(sessionNumber)) {
      return res.status(400).json({ success: false, message: 'Session number must be 1, 2, or 3' });
    }
    const log = await machineLogService.recordStop(req.params.id, sessionNumber);
    res.json({ success: true, data: log });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// PATCH /api/machine-logs/:id/stock
const updateStockEntry = async (req, res) => {
  try {
    const log = await machineLogService.updateStockEntry(req.params.id, req.body);
    res.json({ success: true, data: log });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/machine-logs
const getAllLogs = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = await machineLogService.getAllLogs({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getOrCreateLog,
  getLogByDate,
  createLog,
  updateOperators,
  recordStart,
  recordStop,
  updateStockEntry,
  getAllLogs,
};
