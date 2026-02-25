const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);

router.get('/', dashboardController.getDashboardData);     
router.get('/summary', dashboardController.getSummary);

module.exports = router;
