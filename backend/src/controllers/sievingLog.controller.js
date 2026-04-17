const sievingLogService = require('../services/sievingLog.service');

const getAvailableBatches = async (req, res) => {
  try {
    res.json({ success: true, data: await sievingLogService.getAvailableBatches() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getActiveSievingLog = async (req, res) => {
  try {
    const log = await sievingLogService.getActiveSievingLog();
    res.json({ success: true, data: log ?? null });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createSievingLog = async (req, res) => {
  try {
    const { machineLogId, operatorId, date } = req.body;
    if (!machineLogId || !operatorId)
      return res.status(400).json({ success: false, message: 'machineLogId and operatorId are required' });
    const log = await sievingLogService.getOrCreateSievingLog(
      machineLogId, operatorId, date ? new Date(date) : new Date()
    );
    res.status(201).json({ success: true, data: log });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getSievingLog = async (req, res) => {
  try {
    const log = await sievingLogService.getSievingLogById(req.params.id);
    if (!log) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: log });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const addPart = async (req, res) => {
  try {
    const log = await sievingLogService.addPart(req.params.id, req.body);
    res.status(201).json({ success: true, data: log });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

const updatePart = async (req, res) => {
  try {
    const log = await sievingLogService.updatePart(req.params.id, req.params.partId, req.body);
    res.json({ success: true, data: log });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

const removePart = async (req, res) => {
  try {
    const log = await sievingLogService.removePart(req.params.id, req.params.partId);
    res.json({ success: true, data: log });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

const completeSievingLog = async (req, res) => {
  try {
    const log = await sievingLogService.completeSievingLog(req.params.id);
    res.json({ success: true, data: log });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

const getAllSievingLogs = async (req, res) => {
  try {
    const { page, limit, from, to } = req.query;
    const result = await sievingLogService.getAllSievingLogs({
      page: parseInt(page) || 1, limit: parseInt(limit) || 20,
      from: from || null, to: to || null,
    });
    res.json({ success: true, ...result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = {
  getAvailableBatches,
  getActiveSievingLog,  
  createSievingLog,
  getSievingLog,
  addPart, updatePart, removePart,
  completeSievingLog,
  getAllSievingLogs,
};