const thresholdService = require('../services/stockthreshold.service');

exports.getAllThresholds = async (req, res, next) => { try { res.json({ success: true, data: await thresholdService.getAll() }); } catch (e) { next(e); } };
exports.getThresholdByPackType = async (req, res, next) => { try { res.json({ success: true, data: await thresholdService.getByPackType(req.params.pack_type_id) }); } catch (e) { next(e); } };
exports.createThreshold = async (req, res, next) => { try { res.status(201).json({ success: true, data: await thresholdService.create(req.body) }); } catch (e) { next(e); } };
exports.updateThreshold = async (req, res, next) => { try { res.json({ success: true, data: await thresholdService.update(req.params.pack_type_id, req.body) }); } catch (e) { next(e); } };
exports.deleteThreshold = async (req, res, next) => { try { await thresholdService.remove(req.params.pack_type_id); res.json({ success: true, message: 'Threshold deleted' }); } catch (e) { next(e); } };