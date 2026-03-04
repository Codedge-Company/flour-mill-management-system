// backend/routes/payment.routes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/payment.controller');
const { authenticate }  = require('../middlewares/auth.middleware');
const { authorizeRole } = require('../middlewares/role.middleware');

router.use(authenticate);

// Create a partial payment (ADMIN only)
router.post('/', authorizeRole('ADMIN'), ctrl.addPayment);

// Get a single payment
router.get('/:id', ctrl.getById);

// All payments for a sale
router.get('/sale/:sale_id', ctrl.getBySale);

// All payments for a customer (flat list)
router.get('/customer/:customer_id', ctrl.getByCustomer);

// Credit summary for a customer (sales + payments + balance)
router.get('/customer/:customer_id/credit-summary', ctrl.getCreditSummary);

// Delete (admin only)
router.delete('/:id', authorizeRole('ADMIN'), ctrl.remove);

module.exports = router;