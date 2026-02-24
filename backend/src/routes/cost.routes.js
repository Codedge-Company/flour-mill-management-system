const express = require('express');
const router = express.Router();
const costController = require('../controllers/cost.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRole } = require('../middlewares/role.middleware');

router.use(authenticate, authorizeRole('ADMIN'));

router.get('/',costController.getAllCostHistory);
router.get('/pack/:pack_type_id',costController.getCostsByPackType);
router.get('/:id',costController.getCostHistoryById);
router.post('/',costController.createCostHistory);
router.put('/:id',costController.updateCostHistory);
router.delete('/:id',costController.deleteCostHistory);

module.exports = router;