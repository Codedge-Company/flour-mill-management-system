// routes/order.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/order.controller');
const { authenticate } = require('../middlewares/auth.middleware');   // <-- import

// ── Specific routes before "/:id" ────────────────────────────────────────
router.get('/queue', ctrl.getPendingQueue);
router.get('/stats', ctrl.getStats);
router.get('/my', ctrl.getMyOrders);

router.get('/', ctrl.getAll);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getById);

// ✅ Apply authentication middleware
router.patch('/:id/done', authenticate, ctrl.markDone);   // <-- FIX

module.exports = router;