const express = require('express');
const router = express.Router();
const defaultPriceController = require('../controllers/defaultPrice.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRole } = require('../middlewares/role.middleware');

router.use(authenticate);

router.get('/', defaultPriceController.getAllDefaultPrices);
router.get('/pack/:pack_type_id', defaultPriceController.getDefaultPriceByPackType);
router.get('/:id', defaultPriceController.getDefaultPriceById);
router.post('/', authorizeRole('ADMIN'), defaultPriceController.createDefaultPrice);
router.put('/:id', authorizeRole('ADMIN'), defaultPriceController.updateDefaultPrice);
router.delete('/:id', authorizeRole('ADMIN'), defaultPriceController.deleteDefaultPrice);

module.exports = router;