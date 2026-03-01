const notificationService = require('../services/notification.service');

// controllers/notification.controller.js - getAllNotifications
exports.getAllNotifications = async (req, res, next) => { 
  try {
    console.log('🔍 User ID from req.user:', req.user.id);  // DEBUG
    console.log('🔍 Looking for notifications for user:', req.user.id);
    
    const notifications = await notificationService.getAll(req.user.id);
    console.log('📊 Found notifications:', notifications.length);  // DEBUG
    
    res.json({ success: true, data: notifications });
  } catch (e) {
    console.error('❌ Error:', e);
    next(e);
  }
};


exports.getUnreadCount = async (req, res, next) => {  // Add this
  try {
    const count = await notificationService.getUnreadCount(req.user.id);
    res.json({ success: true, data: { count } });
  } catch (e) { next(e); }
};

exports.getUnreadNotifications = async (req, res, next) => { 
  try { 
    const data = await notificationService.getUnread(req.user.id);
    res.json({ success: true, count: data.length, data }); 
  } catch (e) { next(e); } 
};

exports.getNotificationById = async (req, res, next) => { 
  try { 
    res.json({ success: true, data: await notificationService.getById(req.params.id, req.user.id) }); 
  } catch (e) { next(e); } 
};

// controllers/notification.controller.js
exports.createNotification = async (req, res, next) => {
  try {
    const newNotif = await notificationService.create(req.body);
    
    // Populate for frontend
    await newNotif.populate('pack_type_id', 'pack_name weight_kg');
    
    const io = req.app.get('io');
    io.to(newNotif.userId.toString()).emit('newNotification', {
      notification: {
        notificationId: newNotif._id.toString(),
        type: newNotif.type,
        message: newNotif.message,
        currentStock: newNotif.current_stock,
        packName: newNotif.pack_type_id?.pack_name,
        packWeight: newNotif.pack_type_id?.weight_kg,
        isRead: newNotif.is_read,
        createdAt: newNotif.created_at
      }
    });
    
    const unreadCount = await notificationService.getUnreadCount(newNotif.userId);
    io.to(newNotif.userId.toString()).emit('unreadCountUpdate', { count: unreadCount });
    
    res.status(201).json({ success: true, data: newNotif });
  } catch (e) { next(e); }
};

exports.markAsRead = async (req, res, next) => { 
  try { 
    res.json({ success: true, data: await notificationService.markAsRead(req.params.id, req.user.id) }); 
  } catch (e) { next(e); } 
};

exports.markAllAsRead = async (req, res, next) => { 
  try { 
    await notificationService.markAllAsRead(req.user.id);
    res.json({ success: true, message: 'All notifications marked as read' }); 
  } catch (e) { next(e); } 
};

exports.deleteNotification = async (req, res, next) => { 
  try { 
    await notificationService.remove(req.params.id, req.user.id); 
    res.json({ success: true, message: 'Notification deleted' }); 
  } catch (e) { next(e); } 
};

exports.processSale = async (req, res, next) => {
  try {
    const { pack_type_id, quantity_sold } = req.body;
    const packType = await PackType.findById(pack_type_id);
    
    const previousStock = packType.weight_kg || packType.stock;  // Adjust field name
    packType.weight_kg -= quantity_sold;  // Or stock field
    await packType.save();
    
    const currentStock = packType.weight_kg;
    
    // Notify admins/managers if low
    if (currentStock <= 10) {  // Configurable threshold
      const adminUsers = await User.find({ role: { $in: ['admin', 'manager'] } });
      for (const admin of adminUsers) {
        await notificationService.createStockAlert(
          pack_type_id, 
          currentStock, 
          previousStock, 
          10, 
          admin._id
        );
      }
    }
    
    res.json({ success: true, message: 'Sale processed' });
  } catch (e) { next(e); }
};
