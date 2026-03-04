// routes/expenditure.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/expenditure.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRole } = require('../middlewares/role.middleware');

router.use(authenticate);

// All authenticated users can read
router.get('/', ctrl.getAllExpenditures);
router.get('/:id', ctrl.getExpenditureById);

// Only ADMIN can create / edit / delete
router.post('/', authorizeRole('ADMIN'), ctrl.createExpenditure);
router.put('/:id', authorizeRole('ADMIN'), ctrl.updateExpenditure);
router.delete('/:id', authorizeRole('ADMIN'), ctrl.deleteExpenditure);

module.exports = router;