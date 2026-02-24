const salesService = require('../services/sales.service');

exports.getAllSales = async (req, res, next) => { try { res.json({ success: true, data: await salesService.getAll() }); } catch (e) { next(e); } };
exports.getSaleById = async (req, res, next) => { try { res.json({ success: true, data: await salesService.getById(req.params.id) }); } catch (e) { next(e); } };
exports.createSale = async (req, res, next) => { try { res.status(201).json({ success: true, data: await salesService.createSale(req.body, req.user) }); } catch (e) { next(e); } };
exports.cancelSale = async (req, res, next) => { try { res.json({ success: true, data: await salesService.cancelSale(req.params.id) }); } catch (e) { next(e); } };
exports.deleteSale = async (req, res, next) => { try { await salesService.remove(req.params.id); res.json({ success: true, message: 'Sale deleted permanently' }); } catch (e) { next(e); } };