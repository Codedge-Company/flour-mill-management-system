// controllers/sparePart.controller.js
const service = require('../services/sparePart.service');

exports.getAll = async (req, res, next) => {
  try { res.json({ success: true, data: await service.getAll() }); }
  catch (e) { next(e); }
};

exports.getById = async (req, res, next) => {
  try { res.json({ success: true, data: await service.getById(req.params.id) }); }
  catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await service.create(req.body) }); }
  catch (e) { next(e); }
};

// PATCH /:id/qty  { add_qty } OR { set_qty }
exports.updateQty = async (req, res, next) => {
  try { res.json({ success: true, data: await service.updateQty(req.params.id, req.body) }); }
  catch (e) { next(e); }
};

// PATCH /:id  { name?, category?, unit?, threshold_qty?, supplier_notes? }
exports.updateDetails = async (req, res, next) => {
  try { res.json({ success: true, data: await service.updateDetails(req.params.id, req.body) }); }
  catch (e) { next(e); }
};

exports.remove = async (req, res, next) => {
  try { await service.remove(req.params.id); res.json({ success: true, message: 'Spare part deleted' }); }
  catch (e) { next(e); }
};
