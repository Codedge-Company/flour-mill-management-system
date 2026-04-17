const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/sievingLog.controller');

router.get('/batches', ctrl.getAvailableBatches);
router.get('/active',  ctrl.getActiveSievingLog);  // ✅ must be before /:id
router.get('/',        ctrl.getAllSievingLogs);
router.post('/',       ctrl.createSievingLog);
router.get('/:id',     ctrl.getSievingLog);
router.post('/:id/complete',         ctrl.completeSievingLog);
router.post('/:id/parts',            ctrl.addPart);
router.patch('/:id/parts/:partId',   ctrl.updatePart);
router.delete('/:id/parts/:partId',  ctrl.removePart);

module.exports = router;