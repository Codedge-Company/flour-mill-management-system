const customerService = require('../services/customer.service');

exports.getAllCustomers = async (req, res, next) => { try { res.json({ success: true, data: await customerService.getAll() }); } catch (e) { next(e); } };
exports.getCustomerById = async (req, res, next) => { try { res.json({ success: true, data: await customerService.getById(req.params.id) }); } catch (e) { next(e); } };
exports.createCustomer = async (req, res, next) => { try { res.status(201).json({ success: true, data: await customerService.create(req.body) }); } catch (e) { next(e); } };
exports.updateCustomer = async (req, res, next) => { try { res.json({ success: true, data: await customerService.update(req.params.id, req.body) }); } catch (e) { next(e); } };
exports.deleteCustomer = async (req, res, next) => { try { await customerService.remove(req.params.id); res.json({ success: true, message: 'Customer deleted' }); } catch (e) { next(e); } };