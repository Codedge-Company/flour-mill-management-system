const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);

router.get('/', notificationController.getAllNotifications);
router.get('/unread-count', notificationController.getUnreadCount); 
router.get('/unread', notificationController.getUnreadNotifications);
router.get('/:id', notificationController.getNotificationById);
router.post('/', notificationController.createNotification);
router.patch('/read-all', notificationController.markAllAsRead);    
router.patch('/:id/read', notificationController.markAsRead);      
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
