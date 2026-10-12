// src/controllers/dailySheet.controller.js
const svc = require('../services/dailySheet.service');

exports.get = async (req, res, next) => {
  try { res.json({ success: true, data: await svc.getSheet(req.params.date) }); } catch (e) { next(e); }
};

exports.save = async (req, res, next) => {
  try { res.json({ success: true, data: await svc.saveSheet(req.params.date, req.body, req.user) }); } catch (e) { next(e); }
};

exports.sendSummary = async (req, res, next) => {
  try { res.json({ success: true, data: await svc.sendSummary(req.params.date) }); } catch (e) { next(e); }
};

exports.listEmptyBags = async (req, res, next) => {
  try { res.json({ success: true, data: await svc.listEmptyBags() }); } catch (e) { next(e); }
};

// Opening balance / correction of empty bag stock: admins and managers only
exports.setEmptyBags = async (req, res, next) => {
  try {
    const role = String(req.user?.role || '').toUpperCase();
    if (!['ADMIN', 'MANAGER'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Only an admin or manager can change the empty bag count' });
    }
    res.json({ success: true, data: await svc.setEmptyBags(req.params.packTypeId, req.body || {}, req.user) });
  } catch (e) { next(e); }
};
