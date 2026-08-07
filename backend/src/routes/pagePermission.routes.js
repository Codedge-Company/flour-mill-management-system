const express = require('express');
const router = express.Router();

const c = require('../controllers/pagePermission.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRole } = require('../middlewares/role.middleware');

router.use(authenticate);

router.get('/pages', c.getPages);
router.get('/me', c.getMyPermissions);

router.use(authorizeRole('ADMIN'));
router.get('/', c.getAllPermissions);
router.put('/', c.updatePermissions);

module.exports = router;