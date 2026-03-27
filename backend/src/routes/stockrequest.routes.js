const express = require('express');
const router = express.Router();
const controller = require('../controllers/stockrequest.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRole } = require('../middlewares/role.middleware');

// ── PUBLIC (packing operator page — no token needed) ──
router.get('/', controller.getAllStockRequests);
router.patch('/:id/status', controller.updateStatus);

// ── AUTHENTICATED ──
router.use(authenticate);
router.post('/', controller.createStockRequest);
router.get('/:id', controller.getStockRequestById);
router.delete('/:id', authorizeRole('ADMIN'), controller.deleteStockRequest);

module.exports = router;