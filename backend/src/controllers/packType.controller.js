const packTypeService = require('../services/packType.service');

exports.getAllPackTypes  = async (req, res, next) => { try { res.json({ success: true, data: await packTypeService.getAll() }); } catch (e) { next(e); } };
exports.getPackTypeById = async (req, res, next) => { try { res.json({ success: true, data: await packTypeService.getById(req.params.id) }); } catch (e) { next(e); } };

exports.createPackType  = async (req, res, next) => {
  try {
    // req.body must include: pack_name, weight_kg, initial_stock, initial_cost, threshold_qty
    const data = await packTypeService.create(req.body);
    res.status(201).json({ success: true, data });
  } catch (e) {
    // Surface duplicate name error with a clean 409
    if (e.code === 11000) {
      return res.status(409).json({ success: false, message: 'Pack type with this name already exists.' });
    }
    next(e);
  }
};

exports.updatePackType  = async (req, res, next) => { try { res.json({ success: true, data: await packTypeService.update(req.params.id, req.body) }); } catch (e) { next(e); } };
exports.deletePackType  = async (req, res, next) => { try { await packTypeService.remove(req.params.id); res.json({ success: true, message: 'Pack type deleted' }); } catch (e) { next(e); } };
