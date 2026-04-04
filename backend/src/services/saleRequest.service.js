// saleRequest.service.js
const mongoose = require('mongoose');
const SaleRequest = require('../models/SaleRequest');
const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { generateSequence } = require('../utils/sequence');
const costService = require('./cost.service');
const customerPriceRuleService = require('./customerPriceRule.service');
const defaultPriceService = require('./defaultPrice.service');
const { calculateProfit } = require('../utils/calculateProfit');
const StockThreshold = require('../models/StockThreshold');
const notificationService = require('./notification.service');

// ── Whatsapp (lazy - only if client is ready) ─────────────────────────────
let waService = null;
try { waService = require('./whatsapp.service'); } catch { }

const getIO = () => { try { return require('../../server').io; } catch { return null; } };

// ── Helpers ───────────────────────────────────────────────────────────────

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.matheeshaflourmill.lk';

function formatLKR(n) {
  return `LKR ${Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function notifyAdmins(saleRequest, populatedRequest) {
  const admins = await User.find({ role: 'ADMIN' });

  const itemLines = populatedRequest.items
    .map(i => `  • ${i.pack_type_id?.pack_name || 'Item'} × ${i.qty} = ${formatLKR(i.line_revenue)}`)
    .join('\n');

  const message =
    `🛒 *New Sale Request — Pending Approval*\n` +
    `📋 Request: ${populatedRequest.request_no}\n` +
    `👤 By: ${populatedRequest.requested_by?.full_name || 'Operator'}\n` +
    `👥 Customer: ${populatedRequest.customer_id?.name} (${populatedRequest.customer_id?.customer_code})\n` +
    `💳 Payment: ${populatedRequest.payment_method}\n` +
    `📦 Items:\n${itemLines}\n` +
    `💰 Total: ${formatLKR(populatedRequest.total_preview)}\n` +
    `🔗 Review: ${FRONTEND_URL}/sales/requests`;

  // WhatsApp
  if (waService?.sendWhatsApp) {
    try { await waService.sendWhatsApp(message); }
    catch (e) { console.error('[SaleReq] WA failed:', e.message); }
  } else if (waService?.notifyMachineStart) {
    // fallback if using Twilio-style service
    try { await waService.sendWhatsApp?.(message); } catch { }
  }

  // In-app notification for each admin
  for (const admin of admins) {
    try {
      const notif = await Notification.create({
        type: 'SALE_REQUEST',
        sale_request_id: saleRequest._id,
        message: `New sale request ${populatedRequest.request_no} from ${populatedRequest.requested_by?.full_name} — ${formatLKR(populatedRequest.total_preview)}`,
        userId: admin._id,
      });

      const io = getIO();
      if (io) {
        const room = `user_${admin._id.toString()}`;
        io.to(room).emit('newNotification', {
          notification: {
            notificationId: notif._id.toString(),
            type: 'SALE_REQUEST',
            message: notif.message,
            isRead: false,
            createdAt: notif.created_at,
            saleRequestId: saleRequest._id.toString(),
          },
        });
        const unread = await Notification.countDocuments({ userId: admin._id, is_read: false });
        io.to(room).emit('unreadCountUpdate', { count: unread });
      }
    } catch (e) { console.error('[SaleReq] Admin notif error:', e.message); }
  }
}

async function notifyOperator(saleRequest, status, note) {
  const userId = saleRequest.requested_by;
  const emoji = status === 'APPROVED' ? '✅' : '❌';
  const word = status === 'APPROVED' ? 'Approved' : 'Rejected';

  try {
    const notif = await Notification.create({
      type: status === 'APPROVED' ? 'SALE_APPROVED' : 'SALE_REJECTED',
      sale_request_id: saleRequest._id,
      message: `${emoji} Your request ${saleRequest.request_no} was ${word.toLowerCase()}${note ? ': ' + note : '.'}`,
      userId,
    });

    const io = getIO();
    if (io) {
      const room = `user_${userId.toString()}`;
      io.to(room).emit('saleRequestStatusUpdate', {
        requestId: saleRequest._id.toString(),
        status,
        note: note || null,
      });
      io.to(room).emit('newNotification', {
        notification: {
          notificationId: notif._id.toString(),
          type: notif.type,
          message: notif.message,
          isRead: false,
          createdAt: notif.created_at,
        },
      });
      const unread = await Notification.countDocuments({ userId, is_read: false });
      io.to(room).emit('unreadCountUpdate', { count: unread });
    }
  } catch (e) { console.error('[SaleReq] Operator notif error:', e.message); }
}

// ── Create Request ────────────────────────────────────────────────────────

const createRequest = async ({ customer_id, payment_method, sales_person_id, items }, requestedByUser) => {
  if (!items || items.length === 0)
    throw Object.assign(new Error('Request must have at least one item'), { statusCode: 422 });

  // Validate stock availability (no deduction yet, just check)
  for (const item of items) {
    const inv = await Inventory.findOne({ pack_type_id: item.pack_type_id });
    if (!inv) throw new Error(`No inventory for pack ${item.pack_type_id}`);
    if (inv.stock_qty < item.qty)
      throw new Error(`Insufficient stock for pack. Available: ${inv.stock_qty}`);
  }

  // Build items with line_revenue preview
  const resolvedItems = items.map(item => ({
    pack_type_id: item.pack_type_id,
    qty: item.qty,
    unit_price_sold: item.unit_price_sold,
    line_revenue: item.qty * item.unit_price_sold,
  }));

  const total_preview = resolvedItems.reduce((s, i) => s + i.line_revenue, 0);
  const request_no = await generateSequence('REQ');

  const req = await SaleRequest.create({
    request_no,
    requested_by: requestedByUser?._id ?? null,
    sales_person_id,
    customer_id,
    payment_method,
    items: resolvedItems,
    total_preview,
  });

  const populated = await SaleRequest.findById(req._id)
    .populate('requested_by', 'full_name username')
    .populate('sales_person_id', 'full_name')
    .populate('customer_id', 'name customer_code')
    .populate('items.pack_type_id', 'pack_name weight_kg');

  // Fire notifications (non-blocking)
  notifyAdmins(req, populated).catch(() => { });

  return populated;
};

// ── Approve ───────────────────────────────────────────────────────────────

const approveRequest = async (requestId, adminUser) => {
  const req = await SaleRequest.findById(requestId)
    .populate('items.pack_type_id', 'pack_name weight_kg');

  if (!req) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  if (req.status !== 'PENDING') throw Object.assign(new Error('Only PENDING requests can be approved'), { statusCode: 400 });

  // ── Validate stock is still available ──────────────────────────────────
  for (const item of req.items) {
    const packTypeId = item.pack_type_id._id || item.pack_type_id;
    const inv = await Inventory.findOne({ pack_type_id: packTypeId });
    if (!inv) throw new Error(`No inventory for pack ${packTypeId}`);
    if (inv.stock_qty < item.qty)
      throw new Error(`Insufficient stock (${inv.stock_qty} left) for a pack in this request.`);
  }

  // ── Build sale items ────────────────────────────────────────────────────
  let total_revenue = 0, total_cost = 0;
  const saleItems = [];

  for (const item of req.items) {
    const packTypeId = item.pack_type_id._id || item.pack_type_id;
    const unit_cost_at_sale = await costService.getLatestCost(packTypeId);
    const { line_revenue, line_cost, line_profit } = calculateProfit(item.qty, item.unit_price_sold, unit_cost_at_sale);

    saleItems.push({
      pack_type_id: packTypeId,
      qty: item.qty,
      unit_price_sold: item.unit_price_sold,
      unit_cost_at_sale,
      line_revenue,
      line_cost,
      line_profit,
    });
    total_revenue += line_revenue;
    total_cost += line_cost;
  }

  const total_profit = parseFloat((total_revenue - total_cost).toFixed(2));
  const payment_status = req.payment_method === 'CREDIT' ? 'PENDING' : 'PAID';
  const sale_no = await generateSequence('SALE');

  // ── Create the Sale ─────────────────────────────────────────────────────
  const sale = await Sale.create({
    sale_no,
    customer_id: req.customer_id,
    created_by_user_id: req.sales_person_id,
    payment_method: req.payment_method,
    payment_status,
    sale_datetime: new Date(),
    total_revenue,
    total_cost,
    total_profit,
    items: saleItems,
  });

  // ── Deduct stock ────────────────────────────────────────────────────────
  for (const si of saleItems) {
    await Inventory.findOneAndUpdate(
      { pack_type_id: si.pack_type_id },
      { $inc: { stock_qty: -si.qty }, last_updated_at: new Date() }
    );
    // Low-stock check (non-blocking)
    Inventory.findOne({ pack_type_id: si.pack_type_id }).then(async inv => {
      if (!inv) return;
      const td = await StockThreshold.findOne({ pack_type_id: si.pack_type_id });
      const thr = td?.threshold_qty ?? 10;
      if (inv.stock_qty > thr) return;
      const admins = await User.find({ role: { $in: ['ADMIN', 'MANAGER'] } });
      for (const a of admins) {
        notificationService.createStockAlert(si.pack_type_id, inv.stock_qty, null, thr, a._id).catch(() => { });
      }
    }).catch(() => { });
  }

  // ── Mark request APPROVED + link sale ──────────────────────────────────
  req.status = 'APPROVED';
  req.reviewed_by = adminUser._id;
  req.reviewed_at = new Date();
  req.sale_id = sale._id;
  await req.save();

  notifyOperator(req, 'APPROVED', null).catch(() => { });

  return SaleRequest.findById(req._id)
    .populate('requested_by sales_person_id reviewed_by', 'full_name username')
    .populate('customer_id', 'name customer_code')
    .populate('items.pack_type_id', 'pack_name weight_kg');
};

// ── Reject ────────────────────────────────────────────────────────────────

const rejectRequest = async (requestId, adminUser, note = '') => {
  const req = await SaleRequest.findById(requestId);
  if (!req) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  if (req.status !== 'PENDING') throw Object.assign(new Error('Only PENDING requests can be rejected'), { statusCode: 400 });

  req.status = 'REJECTED';
  req.reviewed_by = adminUser._id;
  req.reviewed_at = new Date();
  req.review_note = note;
  await req.save();

  notifyOperator(req, 'REJECTED', note).catch(() => { });

  return SaleRequest.findById(req._id)
    .populate('requested_by sales_person_id reviewed_by', 'full_name username')
    .populate('customer_id', 'name customer_code')
    .populate('items.pack_type_id', 'pack_name weight_kg');
};

// ── Save (operator confirms approved request → creates actual Sale) ────────

const saveApprovedRequest = async (requestId, creatingUser) => {
  const req = await SaleRequest.findById(requestId)
    .populate('items.pack_type_id', 'pack_name weight_kg');

  if (!req) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  if (req.status !== 'APPROVED') throw Object.assign(new Error('Only APPROVED requests can be saved'), { statusCode: 400 });
  if (creatingUser && req.requested_by.toString() !== creatingUser._id.toString())
    throw Object.assign(new Error('Only the requestor can save this'), { statusCode: 403 })

  // Build sale items using current costs
  let total_revenue = 0, total_cost = 0;
  const saleItems = [];

  for (const item of req.items) {
    const packTypeId = item.pack_type_id._id || item.pack_type_id;
    const inv = await Inventory.findOne({ pack_type_id: packTypeId });
    if (!inv) throw new Error(`No inventory for pack ${packTypeId}`);
    if (inv.stock_qty < item.qty) throw new Error(`Insufficient stock (${inv.stock_qty} left). Please request again.`);

    const unit_cost_at_sale = await costService.getLatestCost(packTypeId);
    const { line_revenue, line_cost, line_profit } = calculateProfit(item.qty, item.unit_price_sold, unit_cost_at_sale);

    saleItems.push({ pack_type_id: packTypeId, qty: item.qty, unit_price_sold: item.unit_price_sold, unit_cost_at_sale, line_revenue, line_cost, line_profit });
    total_revenue += line_revenue;
    total_cost += line_cost;
  }

  const total_profit = parseFloat((total_revenue - total_cost).toFixed(2));
  const payment_status = req.payment_method === 'CREDIT' ? 'PENDING' : 'PAID';
  const sale_no = await generateSequence('SALE');

  const sale = await Sale.create({
    sale_no,
    customer_id: req.customer_id,
    created_by_user_id: req.sales_person_id,
    payment_method: req.payment_method,
    payment_status,
    sale_datetime: new Date(),
    total_revenue,
    total_cost,
    total_profit,
    items: saleItems,
  });

  // Deduct stock
  for (const si of saleItems) {
    await Inventory.findOneAndUpdate(
      { pack_type_id: si.pack_type_id },
      { $inc: { stock_qty: -si.qty }, last_updated_at: new Date() }
    );
    // Low-stock checks (non-blocking)
    Inventory.findOne({ pack_type_id: si.pack_type_id }).then(async inv => {
      if (!inv) return;
      const td = await StockThreshold.findOne({ pack_type_id: si.pack_type_id });
      const thr = td?.threshold_qty ?? 10;
      if (inv.stock_qty > thr) return;
      const admins = await User.find({ role: { $in: ['ADMIN', 'MANAGER'] } });
      for (const a of admins) {
        notificationService.createStockAlert(si.pack_type_id, inv.stock_qty, null, thr, a._id).catch(() => { });
      }
    }).catch(() => { });
  }

  // Mark request as SAVED
  req.status = 'SAVED';
  req.sale_id = sale._id;
  await req.save();

  return Sale.findById(sale._id)
    .populate('customer_id', 'customer_code name')
    .populate('created_by_user_id', 'full_name username')
    .populate('items.pack_type_id', 'pack_name weight_kg');
};

// ── Queries ───────────────────────────────────────────────────────────────

const getMyRequests = (userId) => {
  // If no userId provided, return ALL requests
  const query = userId ? { requested_by: userId } : {};

  return SaleRequest.find(query)
    .sort({ createdAt: -1 })
    .populate('requested_by sales_person_id reviewed_by', 'full_name username')
    .populate('customer_id', 'name customer_code')
    .populate('items.pack_type_id', 'pack_name weight_kg');
};

const getPendingRequests = () =>
  SaleRequest.find({ status: 'PENDING' })
    .sort({ createdAt: 1 })
    .populate('requested_by sales_person_id', 'full_name username')
    .populate('customer_id', 'name customer_code')
    .populate('items.pack_type_id', 'pack_name weight_kg');

const getAllRequests = ({ page = 0, size = 20, status } = {}) => {
  const q = status ? { status } : {};
  return Promise.all([
    SaleRequest.find(q)
      .sort({ createdAt: -1 })
      .skip(page * size)
      .limit(size)
      .populate('requested_by sales_person_id reviewed_by', 'full_name username')
      .populate('customer_id', 'name customer_code')
      .populate('items.pack_type_id', 'pack_name weight_kg'),
    SaleRequest.countDocuments(q),
  ]).then(([data, total]) => ({ data, total, page, size, totalPages: Math.ceil(total / size) }));
};

const getById = async (id) => {
  const r = await SaleRequest.findById(id)
    .populate('requested_by sales_person_id reviewed_by', 'full_name username')
    .populate('customer_id', 'name customer_code')
    .populate('items.pack_type_id', 'pack_name weight_kg');
  if (!r) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
  return r;
};

module.exports = {
  createRequest,
  approveRequest,
  rejectRequest,
  saveApprovedRequest,
  getMyRequests,
  getPendingRequests,
  getAllRequests,
  getById,
};
