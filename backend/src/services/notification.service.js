// services/notification.service.js
const Notification = require('../models/Notification');
const PackType = require('../models/PackType');  // Import PackType

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

const createStockAlert = async (packTypeId, currentStock, previousStock = null, threshold = 10, userId) => {
  const packType = await PackType.findById(packTypeId).select('pack_name weight_kg');
  if (!packType) throw new Error('Pack type not found');
  
  const packInfo = `${packType.pack_name} (${packType.weight_kg}kg)`;
  
  const type = currentStock === 0 ? 'OUT_OF_STOCK' : 
               currentStock < threshold ? 'LOW_STOCK' : 'STOCK_UPDATE';
  
  const messages = {
    LOW_STOCK: `⚠️ Low Stock Alert: ${packInfo} now has only ${currentStock} units remaining (threshold: ${threshold}). Action required.`,
    OUT_OF_STOCK: `🚨 OUT OF STOCK: ${packInfo} at 0 units. Immediate reorder needed!`,
    STOCK_UPDATE: `📊 Stock Update: ${packInfo} reduced to ${currentStock} units (was ${previousStock}).`
  };

  return create({
    type,
    pack_type_id: packTypeId,
    current_stock: currentStock,
    previous_stock: previousStock,
    threshold,
    message: messages[type],
    userId
  });
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
  getAll, getUnreadCount, getUnread, getById, create, createStockAlert, 
  markAsRead, markAllAsRead, remove 
};
