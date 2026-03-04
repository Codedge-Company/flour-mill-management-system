const express = require('express');
const router = express.Router();
const salesController = require('../controllers/sales.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRole } = require('../middlewares/role.middleware');

router.use(authenticate);

router.get('/', salesController.getAllSales);
router.get('/:id', salesController.getSaleById);
router.post('/', salesController.createSale);
router.patch('/:id', salesController.updateSale);
router.patch('/:id/cancel', authorizeRole('ADMIN'), salesController.cancelSale);
router.patch('/:id/mark-paid', authorizeRole('ADMIN'), salesController.markAsPaid);  // ← NEW
router.delete('/:id', authorizeRole('ADMIN'), salesController.deleteSale);

module.exports = router;