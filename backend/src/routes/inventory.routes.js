const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRole } = require('../middlewares/role.middleware');

router.use(authenticate);

router.get('/', inventoryController.getAllInventory);
router.get('/:pack_type_id', inventoryController.getInventoryByPackType);
router.post('/', authorizeRole('ADMIN'), inventoryController.createInventory);
router.put('/:pack_type_id', authorizeRole('ADMIN'), inventoryController.updateInventory);
router.delete('/:pack_type_id', authorizeRole('ADMIN'), inventoryController.deleteInventory);

module.exports = router;