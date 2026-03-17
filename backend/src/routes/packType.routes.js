const express = require('express');
const router = express.Router();
const packTypeController = require('../controllers/packType.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRole } = require('../middlewares/role.middleware');

router.use(authenticate);

router.get('/', packTypeController.getAllPackTypes);
router.get('/:id', packTypeController.getPackTypeById);
router.post('/', authorizeRole('ADMIN'), packTypeController.createPackType);
router.put('/:id', authorizeRole('ADMIN'), packTypeController.updatePackType);
router.delete('/:id', authorizeRole('ADMIN'), packTypeController.deletePackType);
router.patch('/:pack_type_id', authorizeRole('ADMIN'), packTypeController.updatePackName);

module.exports = router;