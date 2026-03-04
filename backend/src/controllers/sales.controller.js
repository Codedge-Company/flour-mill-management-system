const salesService = require('../services/sales.service');

exports.getAllSales = async (req, res, next) => {
    try {
        const page    = parseInt(req.query.page) || 0;
        const size    = parseInt(req.query.size) || 20;
        const filters = req.query;
        res.json({ success: true, data: await salesService.getAllPaginated(page, size, filters) });
    } catch (e) { next(e); }
};

exports.getSaleById = async (req, res, next) => {
    try { res.json({ success: true, data: await salesService.getById(req.params.id) }); }
    catch (e) { next(e); }
};

exports.createSale = async (req, res, next) => {
    try { res.status(201).json({ success: true, data: await salesService.createSale(req.body, req.user) }); }
    catch (e) { next(e); }
};

exports.updateSale = async (req, res, next) => {
    try { res.json({ success: true, data: await salesService.updateSale(req.params.id, req.body) }); }
    catch (e) { next(e); }
};

exports.cancelSale = async (req, res, next) => {
    try { res.json({ success: true, data: await salesService.cancelSale(req.params.id) }); }
    catch (e) { next(e); }
};

exports.deleteSale = async (req, res, next) => {
    try { await salesService.remove(req.params.id); res.json({ success: true, message: 'Sale deleted permanently' }); }
    catch (e) { next(e); }
};

/**
 * PATCH /sales/:id/mark-paid
 * Marks a CREDIT sale's payment_status as PAID.
 * Only ADMIN role can do this (enforced in the router).
 */
exports.markAsPaid = async (req, res, next) => {
    try { res.json({ success: true, data: await salesService.markAsPaid(req.params.id) }); }
    catch (e) { next(e); }
};