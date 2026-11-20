const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.get('/', customerController.getAllCustomers);
router.get('/:id/effective-price/:packTypeId', customerController.getEffectivePrice);

router.use(authenticate);

// keep these two ABOVE '/:id' so "balances" is not read as an id
router.get('/balances', customerController.getBalances);
router.get('/:id/advance', customerController.getAdvance);

router.get('/:id', customerController.getCustomerById);
router.post('/', customerController.createCustomer);
router.put('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);

module.exports = router;
