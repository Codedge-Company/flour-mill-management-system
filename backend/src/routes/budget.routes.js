const express = require('express');
const router  = express.Router();

const {
  getBudget,
  getBudgetAmount,
  updateBudget
} = require('../controllers/budget.controller');

const { authenticate } = require('../middlewares/auth.middleware');

// temporary admin middleware
const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // change this according to your user model
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Admin only' });
  }

  next();
};

// GET /api/budget
router.get('/', authenticate, getBudget);

// GET /api/budget/amount
router.get('/amount', authenticate, getBudgetAmount);

// PUT /api/budget
router.put('/', authenticate, adminOnly, updateBudget);

module.exports = router;