// machineLog.controller.js
const machineLogService = require('../services/machineLog.service');

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

const getLogByDate = async (req, res) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const log = await machineLogService.getLogByDate(date);
    res.json({ success: true, data: log });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

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

const updateOperators = async (req, res) => {
  try {
    const { operatorId, partnerId } = req.body;
    const log = await machineLogService.updateOperators(req.params.id, operatorId, partnerId);
    res.json({ success: true, data: log });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

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

const updateStockEntry = async (req, res) => {
  try {
    const log = await machineLogService.updateStockEntry(req.params.id, req.body);
    res.json({ success: true, data: log });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAllLogs = async (req, res) => {
  try {
    const { page, limit, from, to } = req.query;
    const result = await machineLogService.getAllLogs({
      page:  parseInt(page)  || 1,
      limit: parseInt(limit) || 20,
      from:  from || null,
      to:    to   || null,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateStockByDate = async (req, res) => {
  try {
    const { date, rawRiceReceived, input, output, rejection, rejectionDate } = req.body;
    if (!date) {
      return res.status(400).json({ success: false, message: 'date is required' });
    }
    const log = await machineLogService.upsertStockByDate(new Date(date), {
      rawRiceReceived,
      input,
      output,
      rejection,
      rejectionDate,
    });
    res.json({ success: true, data: log });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/machine-logs/raw-rice-stock — Material Store dashboard
const getRawRiceStockSummary = async (req, res) => {
  try {
    const summary = await machineLogService.getRawRiceStockSummary();
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getOrCreateLog,
  getLogByDate,
  createLog,
  updateOperators,
  updateStockByDate,
  recordStart,
  recordStop,
  updateStockEntry,
  getAllLogs,
  getRawRiceStockSummary,
};