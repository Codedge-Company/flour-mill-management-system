// machineLog.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/machineLog.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// All routes require authentication
router.use(authenticate);

// Logs
router.get('/', ctrl.getAllLogs);
router.get('/by-date', ctrl.getLogByDate);
router.post('/', ctrl.createLog);

// Operators
router.patch('/:id/operators', ctrl.updateOperators);

// Sessions (start / stop)
router.post('/:id/sessions/:sessionNumber/start', ctrl.recordStart);
router.post('/:id/sessions/:sessionNumber/stop', ctrl.recordStop);

// Stock entry
router.patch('/:id/stock', ctrl.updateStockEntry);

module.exports = router;
