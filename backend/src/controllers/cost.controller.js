const costService = require('../services/cost.service');

exports.getAllCostHistory = async (req, res, next) => { try { res.json({ success: true, data: await costService.getAll() }); } catch (e) { next(e); } };
exports.getCostHistoryById = async (req, res, next) => { try { res.json({ success: true, data: await costService.getById(req.params.id) }); } catch (e) { next(e); } };
exports.getCostsByPackType = async (req, res, next) => { try { res.json({ success: true, data: await costService.getByPackType(req.params.pack_type_id) }); } catch (e) { next(e); } };
exports.createCostHistory = async (req, res, next) => { try { res.status(201).json({ success: true, data: await costService.create({ ...req.body, updated_by_user_id: req.user.user_id }) }); } catch (e) { next(e); } };
exports.updateCostHistory = async (req, res, next) => { try { res.json({ success: true, data: await costService.update(req.params.id, { ...req.body, updated_by_user_id: req.user.user_id }) }); } catch (e) { next(e); } };
exports.deleteCostHistory = async (req, res, next) => { try { await costService.remove(req.params.id); res.json({ success: true, message: 'Cost record deleted' }); } catch (e) { next(e); } };