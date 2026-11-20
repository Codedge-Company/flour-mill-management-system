// src/controllers/customer.controller.js
const customerService = require('../services/customer.service');
const paymentService  = require('../services/payment.service');
const advanceService  = require('../services/advance.service');

exports.getAllCustomers = async (req, res, next) => { try { res.json({ success: true, data: await customerService.getAll(req.query.search) }); } catch (e) { next(e); } };
exports.getCustomerById = async (req, res, next) => { try { res.json({ success: true, data: await customerService.getById(req.params.id) }); } catch (e) { next(e); } };
exports.createCustomer = async (req, res, next) => { try { res.status(201).json({ success: true, data: await customerService.create(req.body) }); } catch (e) { next(e); } };
exports.updateCustomer = async (req, res, next) => { try { res.json({ success: true, data: await customerService.update(req.params.id, req.body) }); } catch (e) { next(e); } };
exports.deleteCustomer = async (req, res, next) => { try { await customerService.remove(req.params.id); res.json({ success: true, message: 'Customer deleted' }); } catch (e) { next(e); } };
exports.getEffectivePrice = async (req, res, next) => { try { res.json({ success: true, data: await customerService.getEffectivePrice(req.params.id, req.params.packTypeId) }); } catch (e) { next(e); } };

// outstanding + advance for every customer (customer list page)
exports.getBalances = async (req, res, next) => { try { res.json({ success: true, data: await paymentService.getAllCustomerBalances() }); } catch (e) { next(e); } };

// one customer's advance: current balance + history (new-sale page, advance history)
exports.getAdvance = async (req, res, next) => {
  try {
    const [balance, entries] = await Promise.all([
      advanceService.getBalance(req.params.id),
      advanceService.getEntries(req.params.id),
    ]);
    res.json({ success: true, data: { balance, entries } });
  } catch (e) { next(e); }
};
