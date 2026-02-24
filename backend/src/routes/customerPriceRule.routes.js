const express = require('express');
const router = express.Router();
const customerPriceRuleController = require('../controllers/customerPriceRule.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRole } = require('../middlewares/role.middleware');

router.use(authenticate, authorizeRole('ADMIN'));

router.get('/', customerPriceRuleController.getAllPriceRules);
router.get('/customer/:customer_id', customerPriceRuleController.getPriceRulesByCustomer);
router.get('/:id', customerPriceRuleController.getPriceRuleById);
router.post('/', customerPriceRuleController.createPriceRule);
router.put('/:id', customerPriceRuleController.updatePriceRule);
router.delete('/:id', customerPriceRuleController.deletePriceRule);

module.exports = router;