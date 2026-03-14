// backend/routes/budgetEntry.routes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/budgetEntry.controller');
const { authenticate }   = require('../middlewares/auth.middleware');
const { authorizeRole }  = require('../middlewares/role.middleware');

router.use(authenticate);

// All authenticated users can read
router.get('/',    ctrl.getAll);
router.get('/:id', ctrl.getById);

// Only ADMIN can create / edit / delete
router.post('/',       authorizeRole('ADMIN'), ctrl.create);
router.patch('/:id',   authorizeRole('ADMIN'), ctrl.update);
router.delete('/:id',  authorizeRole('ADMIN'), ctrl.remove);

module.exports = router;