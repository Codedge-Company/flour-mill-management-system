const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/customers', require('./customer.routes'));
router.use('/pack-types', require('./packType.routes'));
router.use('/inventory', require('./inventory.routes'));
router.use('/thresholds', require('./stockthreshold.routes'));
router.use('/costs', require('./cost.routes'));
router.use('/default-prices', require('./defaultPrice.routes'));
router.use('/customer-price-rules', require('./customerPriceRule.routes'));
router.use('/sales', require('./sales.routes'));
router.use('/notifications', require('./notification.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/payments', require('./payment.routes'));
router.use('/expenditures', require('./expenditure.routes'));

module.exports = router;