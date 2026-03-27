// saleRequest.controller.js
const saleRequestService = require('../services/saleRequest.service');

// POST /api/sale-requests
exports.create = async (req, res, next) => {
  try {
    const data = await saleRequestService.createRequest(req.body, req.user);
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
};

// GET /api/sale-requests/my
exports.getMyRequests = async (req, res, next) => {
  try {
    const data = await saleRequestService.getMyRequests(req.user._id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

// GET /api/sale-requests/pending  (admin only)
exports.getPending = async (req, res, next) => {
  try {
    const data = await saleRequestService.getPendingRequests();
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

// GET /api/sale-requests  (admin only)
exports.getAll = async (req, res, next) => {
  try {
    const { page = 0, size = 20, status } = req.query;
    const result = await saleRequestService.getAllRequests({ page: +page, size: +size, status });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
};

// GET /api/sale-requests/:id
exports.getById = async (req, res, next) => {
  try {
    const data = await saleRequestService.getById(req.params.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

// PATCH /api/sale-requests/:id/approve  (admin only)
exports.approve = async (req, res, next) => {
  try {
    const data = await saleRequestService.approveRequest(req.params.id, req.user);
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

// PATCH /api/sale-requests/:id/reject  (admin only)
exports.reject = async (req, res, next) => {
  try {
    const { note } = req.body;
    const data = await saleRequestService.rejectRequest(req.params.id, req.user, note);
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

// POST /api/sale-requests/:id/save  (operator — saves approved request as sale)
exports.saveSale = async (req, res, next) => {
  try {
    const data = await saleRequestService.saveApprovedRequest(req.params.id, req.user);
    res.json({ success: true, data });
  } catch (e) { next(e); }
};
