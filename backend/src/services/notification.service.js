// backend/src/services/notification.service.js
const Notification    = require('../models/Notification');
const PackType        = require('../models/PackType');
const PushSubscription = require('../models/PushSubscription');
const webPush         = require('../config/webPush.config');

const getIO = () => require('../../server').io;

// ── Web Push helper ───────────────────────────────────────────────────────
const sendWebPush = async (userId, notification) => {
  try {
    const subDoc = await PushSubscription.findOne({ userId });
    if (!subDoc) return;  // user hasn't subscribed yet

    const titles = {
      LOW_STOCK:      '⚠️ Low Stock Alert',
      OUT_OF_STOCK:   '🚨 Out of Stock!',
      REORDER_NEEDED: '🔄 Reorder Needed',
      STOCK_UPDATE:   '📊 Stock Updated'
    };

    const payload = JSON.stringify({
      title:  titles[notification.type] ?? '🔔 Notification',
      body:   notification.message,
      icon:   '/assets/icons/icon-192x192.png',
      badge:  '/assets/icons/badge-72x72.png',
      tag:    notification.type,
      requireInteraction: notification.type === 'OUT_OF_STOCK',
      data: {
        url:          notification.type === 'STOCK_UPDATE' ? '/inventory' : '/inventory',
        type:         notification.type,
        currentStock: notification.current_stock
      }
    });

    await webPush.sendNotification(subDoc.subscription, payload);
    console.log(`[Push] 📱 Web push sent to user ${userId}`);
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Subscription expired or invalid — clean it up
      await PushSubscription.findOneAndDelete({ userId });
      console.warn(`[Push] Expired subscription removed for user ${userId}`);
    } else {
      console.error('[Push] Failed to send:', err.message);
    }
  }
};

// ── Existing methods (unchanged) ──────────────────────────────────────────
const getAll = (userId) =>
  Notification.find({ userId }).populate('pack_type_id', 'pack_name weight_kg').sort({ created_at: -1 });

const getUnreadCount = (userId) =>
  Notification.countDocuments({ userId, is_read: false });

const getUnread = (userId) =>
  Notification.find({ userId, is_read: false }).populate('pack_type_id', 'pack_name weight_kg').sort({ created_at: -1 });

const getById = async (id, userId) => {
  const n = await Notification.findOne({ _id: id, userId }).populate('pack_type_id', 'pack_name weight_kg');
  if (!n) throw Object.assign(new Error('Notification not found'), { statusCode: 404 });
  return n;
};

const create = ({ type, pack_type_id, current_stock, previous_stock, threshold, message, userId }) =>
  Notification.create({ type, pack_type_id, current_stock, previous_stock, threshold, message, userId });

// ── createStockAlert — DB + Socket.IO + Web Push ──────────────────────────
const createStockAlert = async (packTypeId, currentStock, previousStock = null, threshold = 10, userId) => {
  const packType = await PackType.findById(packTypeId).select('pack_name weight_kg');
  if (!packType) throw new Error('Pack type not found');

  const packInfo = `${packType.pack_name} (${packType.weight_kg}kg)`;
  const type     = currentStock === 0       ? 'OUT_OF_STOCK'
                 : currentStock < threshold  ? 'LOW_STOCK'
                 :                            'STOCK_UPDATE';

  const messages = {
    LOW_STOCK:    `⚠️ Low Stock Alert: ${packInfo} now has only ${currentStock} units remaining (threshold: ${threshold}). Action required.`,
    OUT_OF_STOCK: `🚨 OUT OF STOCK: ${packInfo} at 0 units. Immediate reorder needed!`,
    STOCK_UPDATE: `📊 Stock Update: ${packInfo} reduced to ${currentStock} units (was ${previousStock}).`
  };

  // 1️⃣ Save to DB
  const notification = await create({
    type,
    pack_type_id:   packTypeId,
    current_stock:  currentStock,
    previous_stock: previousStock,
    threshold,
    message:        messages[type],
    userId
  });

  await notification.populate('pack_type_id', 'pack_name weight_kg');

  const socketPayload = {
    notificationId: notification._id.toString(),
    type:           notification.type,
    message:        notification.message,
    currentStock:   notification.current_stock,
    packName:       notification.pack_type_id?.pack_name ?? null,
    isRead:         false,
    createdAt:      notification.created_at
  };

  // 2️⃣ Socket.IO — real-time (browser tab open)
  const targetRoom = `user_${userId.toString()}`;
  try {
    const io = getIO();
    io.to(targetRoom).emit('newNotification', { notification: socketPayload });

    const unreadCount = await Notification.countDocuments({ userId, is_read: false });
    io.to(targetRoom).emit('unreadCountUpdate', { count: unreadCount });
    console.log(`[LowStock] 📡 Socket emitted to ${targetRoom} — type: ${type}, unread: ${unreadCount}`);
  } catch (err) {
    console.error('[LowStock] Socket emit failed:', err.message);
  }

  // 3️⃣ Web Push — OS notification (works even when tab is closed)
  await sendWebPush(userId, notification);

  return notification;
};

const markAsRead = async (id, userId) => {
  const n = await Notification.findOneAndUpdate(
    { _id: id, userId },
    { is_read: true },
    { new: true }
  ).populate('pack_type_id', 'pack_name weight_kg');
  if (!n) throw Object.assign(new Error('Notification not found'), { statusCode: 404 });
  return n;
};

const markAllAsRead = (userId) =>
  Notification.updateMany({ userId, is_read: false }, { is_read: true });

const remove = async (id, userId) => {
  const n = await Notification.findOneAndDelete({ _id: id, userId });
  if (!n) throw Object.assign(new Error('Notification not found'), { statusCode: 404 });
};

module.exports = {
  getAll, getUnreadCount, getUnread, getById,
  create, createStockAlert,
  markAsRead, markAllAsRead, remove
};
