// backend/controllers/payment.controller.js
const paymentService = require('../services/payment.service');

exports.addPayment = async (req, res, next) => {
  try {
    const data = await paymentService.addPayment(req.body, req.user);
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
};

exports.getBySale = async (req, res, next) => {
  try {
    res.json({ success: true, data: await paymentService.getBySale(req.params.sale_id) });
  } catch (e) { next(e); }
};

exports.getByCustomer = async (req, res, next) => {
  try {
    res.json({ success: true, data: await paymentService.getByCustomer(req.params.customer_id) });
  } catch (e) { next(e); }
};

exports.getCreditSummary = async (req, res, next) => {
  try {
    res.json({ success: true, data: await paymentService.getCreditSummaryByCustomer(req.params.customer_id) });
  } catch (e) { next(e); }
};

exports.getById = async (req, res, next) => {
  try {
    res.json({ success: true, data: await paymentService.getById(req.params.id) });
  } catch (e) { next(e); }
};

exports.remove = async (req, res, next) => {
  try {
    await paymentService.remove(req.params.id);
    res.json({ success: true, message: 'Payment deleted' });
  } catch (e) { next(e); }
};