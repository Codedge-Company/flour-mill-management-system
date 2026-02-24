const defaultPriceService = require('../services/defaultPrice.service');

exports.getAllDefaultPrices = async (req, res, next) => { try { res.json({ success: true, data: await defaultPriceService.getAll() }); } catch (e) { next(e); } };
exports.getDefaultPriceById = async (req, res, next) => { try { res.json({ success: true, data: await defaultPriceService.getById(req.params.id) }); } catch (e) { next(e); } };
exports.getDefaultPriceByPackType = async (req, res, next) => { try { res.json({ success: true, data: await defaultPriceService.getActiveByPackType(req.params.pack_type_id) }); } catch (e) { next(e); } };
exports.createDefaultPrice = async (req, res, next) => { try { res.status(201).json({ success: true, data: await defaultPriceService.create(req.body) }); } catch (e) { next(e); } };
exports.updateDefaultPrice = async (req, res, next) => { try { res.json({ success: true, data: await defaultPriceService.update(req.params.id, req.body) }); } catch (e) { next(e); } };
exports.deleteDefaultPrice = async (req, res, next) => { try { await defaultPriceService.remove(req.params.id); res.json({ success: true, message: 'Default price deleted' }); } catch (e) { next(e); } };