const express = require('express');
const router = express.Router();

const {
  getAllCapital,
  createCapital,
  deleteCapital,
  getFlowTimeline,
} = require('../controllers/capital.controller');

const { authenticate } = require('../middlewares/auth.middleware');

// local admin middleware
const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }

  // adjust this if your user field is different
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }

  next();
};

// Flow timeline
router.get('/flow', authenticate, getFlowTimeline);

// Capital CRUD
router.get('/', authenticate, getAllCapital);
router.post('/', authenticate, adminOnly, createCapital);
router.delete('/:id', authenticate, adminOnly, deleteCapital);

module.exports = router;