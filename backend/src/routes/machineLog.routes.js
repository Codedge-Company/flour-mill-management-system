// machineLog.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/machineLog.controller');

// Material Store — Raw Rice Stock summary (must come before any /:id routes)
router.get('/raw-rice-stock', ctrl.getRawRiceStockSummary);

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
router.patch('/stock-by-date', ctrl.updateStockByDate);

module.exports = router;