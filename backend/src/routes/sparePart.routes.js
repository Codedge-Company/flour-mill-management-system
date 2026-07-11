// routes/sparePart.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/sparePart.controller');

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.patch('/:id/qty', ctrl.updateQty);
router.patch('/:id', ctrl.updateDetails);
router.delete('/:id', ctrl.remove);

module.exports = router;
