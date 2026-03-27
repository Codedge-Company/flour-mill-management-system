const express = require('express');
const router = express.Router();

const userController = require('../controllers/user.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRole } = require('../middlewares/role.middleware');

// ======================
// Public to authenticated users (no role restriction)
// ======================
router.get('/by-roles', authenticate, userController.getUsersByRoles);

// ======================
// Admin-only routes
// ======================
router.use(authenticate, authorizeRole('ADMIN'));   // This applies to all routes below

router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;