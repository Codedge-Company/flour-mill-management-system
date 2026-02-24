const inventoryService = require('../services/inventory.service');

exports.getAllInventory = async (req, res, next) => { try { res.json({ success: true, data: await inventoryService.getAll() }); } catch (e) { next(e); } };
exports.getInventoryByPackType = async (req, res, next) => { try { res.json({ success: true, data: await inventoryService.getByPackType(req.params.pack_type_id) }); } catch (e) { next(e); } };
exports.createInventory = async (req, res, next) => { try { res.status(201).json({ success: true, data: await inventoryService.create(req.body) }); } catch (e) { next(e); } };
exports.updateInventory = async (req, res, next) => { try { res.json({ success: true, data: await inventoryService.update(req.params.pack_type_id, req.body) }); } catch (e) { next(e); } };
exports.deleteInventory = async (req, res, next) => { try { await inventoryService.remove(req.params.pack_type_id); res.json({ success: true, message: 'Inventory record deleted' }); } catch (e) { next(e); } };