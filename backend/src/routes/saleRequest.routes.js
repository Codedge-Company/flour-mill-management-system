// saleRequest.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/saleRequest.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRole } = require('../middlewares/role.middleware');

// ── Operator routes ────────────────────────────────────────────────────────
router.post('/', ctrl.create);          // submit request
router.get('/my', ctrl.getMyRequests);   // operator's own requests
router.post('/:id/save', ctrl.saveSale);       // operator saves approved → creates sale

router.use(authenticate);

// ── Admin routes ───────────────────────────────────────────────────────────
router.get('/pending', authorizeRole('ADMIN'), ctrl.getPending);
router.get('/', authorizeRole('ADMIN'), ctrl.getAll);
router.get('/:id', ctrl.getById);         // operator can view their own
router.patch('/:id/approve', authorizeRole('ADMIN'), ctrl.approve);
router.patch('/:id/reject', authorizeRole('ADMIN'), ctrl.reject);

module.exports = router;
