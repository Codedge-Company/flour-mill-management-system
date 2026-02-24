const customerPriceRuleService = require('../services/customerPriceRule.service');

exports.getAllPriceRules = async (req, res, next) => { try { res.json({ success: true, data: await customerPriceRuleService.getAll() }); } catch (e) { next(e); } };
exports.getPriceRuleById = async (req, res, next) => { try { res.json({ success: true, data: await customerPriceRuleService.getById(req.params.id) }); } catch (e) { next(e); } };
exports.getPriceRulesByCustomer = async (req, res, next) => { try { res.json({ success: true, data: await customerPriceRuleService.getByCustomer(req.params.customer_id) }); } catch (e) { next(e); } };
exports.createPriceRule = async (req, res, next) => { try { res.status(201).json({ success: true, data: await customerPriceRuleService.create(req.body) }); } catch (e) { next(e); } };
exports.updatePriceRule = async (req, res, next) => { try { res.json({ success: true, data: await customerPriceRuleService.update(req.params.id, req.body) }); } catch (e) { next(e); } };
exports.deletePriceRule = async (req, res, next) => { try { await customerPriceRuleService.remove(req.params.id); res.json({ success: true, message: 'Price rule deleted' }); } catch (e) { next(e); } };