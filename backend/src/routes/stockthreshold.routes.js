const express = require('express');
const router = express.Router();
const thresholdController = require('../controllers/stockthreshold.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRole } = require('../middlewares/role.middleware');

router.use(authenticate, authorizeRole('ADMIN'));

router.get('/',                 thresholdController.getAllThresholds);
router.get('/:pack_type_id',    thresholdController.getThresholdByPackType);
router.post('/',                thresholdController.createThreshold);
router.put('/:pack_type_id',    thresholdController.updateThreshold);
router.delete('/:pack_type_id', thresholdController.deleteThreshold);

module.exports = router;