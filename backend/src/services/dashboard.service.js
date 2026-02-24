const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const StockThreshold = require('../models/StockThreshold');
const Notification = require('../models/Notification');

const getSummary = async () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayStats] = await Sale.aggregate([
        { $match: { status: 'SAVED', sale_datetime: { $gte: startOfDay } } },
        { $group: { _id: null, revenue: { $sum: '$total_revenue' }, profit: { $sum: '$total_profit' }, sales_count: { $sum: 1 } } },
    ]);

    const [monthStats] = await Sale.aggregate([
        { $match: { status: 'SAVED', sale_datetime: { $gte: startOfMonth } } },
        { $group: { _id: null, revenue: { $sum: '$total_revenue' }, profit: { $sum: '$total_profit' }, sales_count: { $sum: 1 } } },
    ]);

    // Low stock: inventory qty <= threshold
    const inventories = await Inventory.find().populate('pack_type_id', 'pack_name');
    const thresholds = await StockThreshold.find();
    const thresholdMap = Object.fromEntries(thresholds.map(t => [t.pack_type_id.toString(), t.threshold_qty]));

    const lowStock = inventories
        .filter(inv => {
            const tq = thresholdMap[inv.pack_type_id._id.toString()];
            return tq !== undefined && inv.stock_qty <= tq;
        })
        .map(inv => ({
            pack_name: inv.pack_type_id?.pack_name,
            stock_qty: inv.stock_qty,
            threshold_qty: thresholdMap[inv.pack_type_id._id.toString()],
        }));

    const unread_notifications = await Notification.countDocuments({ is_read: false });

    return {
        today: todayStats || { revenue: 0, profit: 0, sales_count: 0 },
        month: monthStats || { revenue: 0, profit: 0, sales_count: 0 },
        low_stock: lowStock,
        unread_notifications,
    };
};

module.exports = { getSummary };