// services/order.service.js
const Order = require('../models/Order');
const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const StockThreshold = require('../models/StockThreshold');
const User = require('../models/User');
const { generateSequence } = require('../utils/sequence');
const costService = require('./cost.service');
const { calculateProfit } = require('../utils/calculateProfit');
const notificationService = require('./notification.service');

// Reuses your existing WhatsApp low-stock alert if present — same pattern
// as inventory.service.js / sales.service.js.
let waService = null;
try { waService = require('./whatsapp.service'); } catch { }

const POPULATE = [
  { path: 'customer_id', select: 'name customer_code' },
  { path: 'created_by', select: 'full_name username' },
  { path: 'completed_by', select: 'full_name username' },
  { path: 'items.pack_type_id', select: 'pack_name weight_kg' },
  { path: 'sale_id', select: 'sale_no payment_status' },
];

// ── Create ────────────────────────────────────────────────────────────────
const createOrder = async ({ customer_id, payment_method, expected_date, items, notes }, user) => {
  if (!items || items.length === 0)
    throw Object.assign(new Error('Order must have at least one item'), { statusCode: 422 });
  if (!expected_date)
    throw Object.assign(new Error('Expected date is required'), { statusCode: 422 });

  const expectedDateObj = new Date(expected_date);
  if (isNaN(expectedDateObj.getTime()))
    throw Object.assign(new Error('Expected date is invalid'), { statusCode: 422 });

  const resolvedItems = items.map(item => ({
    pack_type_id: item.pack_type_id,
    qty: item.qty,
    unit_price: item.unit_price,
    line_total: item.qty * item.unit_price,
  }));

  const total_amount = resolvedItems.reduce((s, i) => s + i.line_total, 0);
  const order_no = await generateSequence('ORD');

  const order = await Order.create({
    order_no,
    customer_id,
    created_by: user?._id ?? null,
    payment_method,
    expected_date: expectedDateObj,
    items: resolvedItems,
    total_amount,
    notes: notes?.trim() || '',
  });

  return Order.findById(order._id).populate(POPULATE);
};

// ── Queries ───────────────────────────────────────────────────────────────
const getMyOrders = (userId) => {
  const query = userId ? { created_by: userId } : {};
  return Order.find(query).sort({ createdAt: -1 }).populate(POPULATE);
};

const getAll = ({ status } = {}) => {
  const query = status ? { status } : {};
  return Order.find(query).sort({ expected_date: 1 }).populate(POPULATE);
};

const getPendingQueue = () =>
  Order.find({ status: 'PENDING' }).sort({ expected_date: 1 }).populate(POPULATE);

const getById = async (id) => {
  const order = await Order.findById(id).populate(POPULATE);
  if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  return order;
};

// ── Low-stock notification helper ───────────────────────────────────────
const triggerLowStockNotification = async (pack_type_id, newStockQty) => {
  const thresholdDoc = await StockThreshold.findOne({ pack_type_id });
  const threshold = thresholdDoc ? thresholdDoc.threshold_qty : 10;
  if (newStockQty > threshold) return;

  const admins = await User.find({ role: { $in: ['ADMIN', 'MANAGER'] } });
  for (const admin of admins) {
    try {
      await notificationService.createStockAlert(pack_type_id, newStockQty, null, threshold, admin._id);
    } catch (err) {
      console.error(`[Order] Failed to notify user ${admin._id}:`, err.message);
    }
  }

  try {
    if (waService?.notifyLowStock) {
      const PackType = require('../models/PackType');
      const packType = await PackType.findById(pack_type_id).select('pack_name weight_kg').lean();
      await waService.notifyLowStock({
        itemName: packType?.pack_name ?? 'Pack type',
        category: `Bag Stock${packType?.weight_kg ? ' — ' + packType.weight_kg + 'kg' : ''}`,
        currentQty: newStockQty,
        unit: 'bags',
        thresholdQty: threshold,
      });
    }
  } catch (err) {
    console.error('[Order] WhatsApp low-stock notify failed:', err.message);
  }
};

// ── Mark Done — creates a real Sale + deducts Inventory ────────────────────
// ── Mark Done — creates a real Sale + deducts Inventory ────────────────────
const markDone = async (id, user) => {
  // 🔒 Robust user ID extraction
  const userId = user?._id || user?.id || user?.userId;
  if (!userId) {
    throw Object.assign(
      new Error('You must be logged in to complete an order.'),
      { statusCode: 401 }
    );
  }

  const order = await Order.findById(id).populate('items.pack_type_id', 'pack_name weight_kg');
  if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  if (order.status === 'COMPLETED')
    throw Object.assign(new Error('Order is already completed'), { statusCode: 409 });

  // ── Validate stock ──────────────────────────────────────────────
  for (const item of order.items) {
    const packTypeId = item.pack_type_id._id || item.pack_type_id;
    const inv = await Inventory.findOne({ pack_type_id: packTypeId });
    if (!inv) throw Object.assign(new Error(`No inventory found for a pack in this order`), { statusCode: 400 });
    if (inv.stock_qty < item.qty)
      throw Object.assign(
        new Error(`Insufficient stock for ${item.pack_type_id.pack_name ?? 'a pack'}. Available: ${inv.stock_qty}, needed: ${item.qty}`),
        { statusCode: 400 }
      );
  }

  let total_revenue = 0, total_cost = 0;
  const saleItems = [];

  for (const item of order.items) {
    const packTypeId = item.pack_type_id._id || item.pack_type_id;
    const unit_cost_at_sale = await costService.getLatestCost(packTypeId);
    const { line_revenue, line_cost, line_profit } = calculateProfit(item.qty, item.unit_price, unit_cost_at_sale);

    saleItems.push({
      pack_type_id: packTypeId,
      qty: item.qty,
      unit_price_sold: item.unit_price,
      unit_cost_at_sale,
      line_revenue,
      line_cost,
      line_profit,
    });
    total_revenue += line_revenue;
    total_cost += line_cost;
  }

  const total_profit = parseFloat((total_revenue - total_cost).toFixed(2));
  const payment_status = order.payment_method === 'CREDIT' ? 'PENDING' : 'PAID';
  const sale_no = await generateSequence('SALE');

  // ✅ Use the extracted userId
  const sale = await Sale.create({
    sale_no,
    customer_id: order.customer_id,
    created_by_user_id: userId,          // <── USE EXTRACTED ID
    payment_method: order.payment_method,
    payment_status,
    sale_datetime: new Date(),
    total_revenue,
    total_cost,
    total_profit,
    items: saleItems,
  });

  // ── Deduct stock ──────────────────────────────────────────────────
  for (const si of saleItems) {
    await Inventory.findOneAndUpdate(
      { pack_type_id: si.pack_type_id },
      { $inc: { stock_qty: -si.qty }, last_updated_at: new Date() }
    );
    const currentInventory = await Inventory.findOne({ pack_type_id: si.pack_type_id });
    if (currentInventory) {
      triggerLowStockNotification(si.pack_type_id, currentInventory.stock_qty).catch(() => { });
    }
  }

  // ✅ Mark order as completed with userId
  order.status = 'COMPLETED';
  order.completed_at = new Date();
  order.completed_by = userId;             // <── USE EXTRACTED ID
  order.sale_id = sale._id;
  await order.save();

  return Order.findById(order._id).populate(POPULATE);
};
// ── Efficiency stats ──────────────────────────────────────────────────────
const getStats = async () => {
  const now = new Date();

  const [totalOrders, pendingOrders, completedOrders, overdueOrders] = await Promise.all([
    Order.countDocuments({}),
    Order.countDocuments({ status: 'PENDING' }),
    Order.countDocuments({ status: 'COMPLETED' }),
    Order.countDocuments({ status: 'PENDING', expected_date: { $lt: now } }),
  ]);

  const completionAgg = await Order.aggregate([
    { $match: { status: 'COMPLETED', completed_at: { $ne: null } } },
    {
      $project: {
        isOnTime: { $lte: ['$completed_at', '$expected_date'] },
        delayDays: {
          $divide: [
            { $subtract: ['$completed_at', '$expected_date'] },
            1000 * 60 * 60 * 24,
          ],
        },
        leadTimeDays: {
          $divide: [
            { $subtract: ['$expected_date', '$createdAt'] },
            1000 * 60 * 60 * 24,
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        onTimeCount: { $sum: { $cond: ['$isOnTime', 1, 0] } },
        lateCount: { $sum: { $cond: ['$isOnTime', 0, 1] } },
        avgDelayOfLate: {
          $avg: { $cond: ['$isOnTime', null, '$delayDays'] },
        },
        avgLeadTime: { $avg: '$leadTimeDays' },
      },
    },
  ]);

  const c = completionAgg[0] ?? { onTimeCount: 0, lateCount: 0, avgDelayOfLate: 0, avgLeadTime: 0 };
  const completedTotal = c.onTimeCount + c.lateCount;
  const onTimeRate = completedTotal > 0 ? (c.onTimeCount / completedTotal) * 100 : 0;

  const eightWeeksAgo = new Date(now);
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 7 * 8);

  const weeklyTrendRaw = await Order.aggregate([
    { $match: { status: 'COMPLETED', completed_at: { $gte: eightWeeksAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%U', date: '$completed_at' } },
        count: { $sum: 1 },
        weekStart: { $min: '$completed_at' },
      },
    },
    { $sort: { weekStart: 1 } },
  ]);

  const weeklyTrend = weeklyTrendRaw.map(w => ({
    weekLabel: w.weekStart,
    count: w.count,
  }));

  return {
    totalOrders,
    pendingOrders,
    completedOrders,
    overdueOrders,
    onTimeCount: c.onTimeCount,
    lateCount: c.lateCount,
    onTimeRate: Math.round(onTimeRate * 10) / 10,
    avgDelayDays: c.avgDelayOfLate ? Math.round(c.avgDelayOfLate * 10) / 10 : 0,
    avgLeadTimeDays: c.avgLeadTime ? Math.round(c.avgLeadTime * 10) / 10 : 0,
    weeklyTrend,
  };
};

module.exports = {
  createOrder,
  getMyOrders,
  getAll,
  getPendingQueue,
  getById,
  markDone,
  getStats,
};