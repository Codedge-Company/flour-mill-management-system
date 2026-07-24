// controllers/order.controller.js
const orderService = require('../services/order.service');

// POST /api/orders
exports.create = async (req, res, next) => {
  try {
    const data = await orderService.createOrder(req.body, req.user ?? null);
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
};

// GET /api/orders/my
exports.getMyOrders = async (req, res, next) => {
  try {
    const userId = req.user?._id ?? null;
    const data = await orderService.getMyOrders(userId);
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

// GET /api/orders?status=PENDING|COMPLETED
exports.getAll = async (req, res, next) => {
  try {
    const { status } = req.query;
    const data = await orderService.getAll({ status });
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

// GET /api/orders/queue — reminder queue, pending sorted by soonest due date
exports.getPendingQueue = async (req, res, next) => {
  try {
    const data = await orderService.getPendingQueue();
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

// GET /api/orders/stats — efficiency analysis panel
exports.getStats = async (req, res, next) => {
  try {
    const data = await orderService.getStats();
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

// GET /api/orders/:id
exports.getById = async (req, res, next) => {
  try {
    const data = await orderService.getById(req.params.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

// PATCH /api/orders/:id/done
// controllers/order.controller.js
exports.markDone = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const data = await orderService.markDone(req.params.id, req.user);
    res.json({ success: true, data });
  } catch (e) {
    console.error('markDone error:', e.message, e.statusCode);
    next(e);
  }
};