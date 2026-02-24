const Notification = require('../models/Notification');

const getAll = () => Notification.find().populate('pack_type_id', 'pack_name weight_kg').sort({ created_at: -1 });

const getUnread = () =>
    Notification.find({ is_read: false }).populate('pack_type_id', 'pack_name').sort({ created_at: -1 });

const getById = async (id) => {
    const n = await Notification.findById(id).populate('pack_type_id');
    if (!n) throw Object.assign(new Error('Notification not found'), { statusCode: 404 });
    return n;
};

const create = ({ type, pack_type_id, message }) =>
    Notification.create({ type, pack_type_id, message });

const markAsRead = async (id) => {
    const n = await Notification.findByIdAndUpdate(id, { is_read: true }, { new: true });
    if (!n) throw Object.assign(new Error('Notification not found'), { statusCode: 404 });
    return n;
};

const markAllAsRead = () => Notification.updateMany({ is_read: false }, { is_read: true });

const remove = async (id) => {
    const n = await Notification.findByIdAndDelete(id);
    if (!n) throw Object.assign(new Error('Notification not found'), { statusCode: 404 });
};

module.exports = { getAll, getUnread, getById, create, markAsRead, markAllAsRead, remove };