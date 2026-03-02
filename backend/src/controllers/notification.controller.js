// backend/controllers/notification.controller.js
const notificationService = require('../services/notification.service');

// ── GET all notifications for logged-in user ──────────────────────────────
exports.getAllNotifications = async (req, res, next) => {
  try {
    const notifications = await notificationService.getAll(req.user.id);
    res.json({ success: true, data: notifications });
  } catch (e) { next(e); }
};

// ── GET unread count ──────────────────────────────────────────────────────
exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await notificationService.getUnreadCount(req.user.id);
    res.json({ success: true, data: { count } });
  } catch (e) { next(e); }
};

// ── GET unread notifications ──────────────────────────────────────────────
exports.getUnreadNotifications = async (req, res, next) => {
  try {
    const data = await notificationService.getUnread(req.user.id);
    res.json({ success: true, count: data.length, data });
  } catch (e) { next(e); }
};

// ── GET single notification ───────────────────────────────────────────────
exports.getNotificationById = async (req, res, next) => {
  try {
    const data = await notificationService.getById(req.params.id, req.user.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

// ── POST create notification + emit socket ────────────────────────────────
exports.createNotification = async (req, res, next) => {
  try {
    const newNotif = await notificationService.create(req.body);
    await newNotif.populate('pack_type_id', 'pack_name weight_kg');

    const io        = req.app.get('io');       // ✅ works because server.js sets this
    const targetRoom = `user_${newNotif.user_id.toString()}`;  // ✅ use user_id field

    io.to(targetRoom).emit('newNotification', {
      notification: {
        notificationId: newNotif._id.toString(),
        type:           newNotif.type,
        message:        newNotif.message,
        currentStock:   newNotif.current_stock,
        packName:       newNotif.pack_type_id?.pack_name,
        isRead:         newNotif.is_read,
        createdAt:      newNotif.created_at
      }
    });

    const unreadCount = await notificationService.getUnreadCount(newNotif.user_id);
    io.to(targetRoom).emit('unreadCountUpdate', { count: unreadCount });

    console.log(`[Notif] ✅ Emitted to ${targetRoom}`);
    res.status(201).json({ success: true, data: newNotif });
  } catch (e) { next(e); }
};

// ── PATCH mark single as read ─────────────────────────────────────────────
exports.markAsRead = async (req, res, next) => {
  try {
    const data = await notificationService.markAsRead(req.params.id, req.user.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

// ── PATCH mark all as read ────────────────────────────────────────────────
exports.markAllAsRead = async (req, res, next) => {
  try {
    await notificationService.markAllAsRead(req.user.id);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (e) { next(e); }
};

// ── DELETE notification ───────────────────────────────────────────────────
exports.deleteNotification = async (req, res, next) => {
  try {
    await notificationService.remove(req.params.id, req.user.id);
    res.json({ success: true, message: 'Notification deleted' });
  } catch (e) { next(e); }
};
