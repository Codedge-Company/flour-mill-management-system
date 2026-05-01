const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRole } = require('../middlewares/role.middleware');

// ── PUBLIC (packing operator page — no token needed) ──
router.get('/', inventoryController.getAllInventory);
router.put('/:pack_type_id', inventoryController.updateInventory);

// ── AUTHENTICATED (must be declared AFTER the public routes) ──
router.use(authenticate);
router.get('/:pack_type_id', inventoryController.getInventoryByPackType);
router.post('/', authorizeRole('ADMIN'), inventoryController.createInventory);
router.patch('/:pack_type_id', inventoryController.updateInventory);
router.delete('/:pack_type_id', authorizeRole('ADMIN'), inventoryController.deleteInventory);

module.exports = router;