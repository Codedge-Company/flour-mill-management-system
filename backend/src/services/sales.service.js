const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const StockThreshold = require('../models/StockThreshold');
const User = require('../models/User');
const notificationService = require('./notification.service');

const customerPriceRuleService = require('./customerPriceRule.service');
const defaultPriceService = require('./defaultPrice.service');
const costService = require('./cost.service');
const { calculateProfit } = require('../utils/calculateProfit');
const { generateSequence } = require('../utils/sequence');

// ── helpers ──────────────────────────────────────────────────────────────────

const resolveUnitPrice = async (customer_id, pack_type_id) => {
    const special = await customerPriceRuleService.resolvePrice(customer_id, pack_type_id);
    if (special !== null) return special;
    return defaultPriceService.getLatestPrice(pack_type_id);
};

/**
 * Derive the correct payment_status from the payment_method.
 * CREDIT sales start as PENDING; all other methods are considered settled immediately.
 */
const derivePaymentStatus = (payment_method) =>
    payment_method === 'CREDIT' ? 'PENDING' : 'PAID';

const triggerLowStockNotification = async (pack_type_id, newStockQty) => {
    console.log(`[LowStock] Checking pack ${pack_type_id} → new qty: ${newStockQty}`);

    const thresholdDoc = await StockThreshold.findOne({ pack_type_id });
    const threshold = thresholdDoc ? thresholdDoc.threshold_qty : 10;

    if (newStockQty > threshold) {
        console.log(`[LowStock] Still safe (above ${threshold})`);
        return;
    }

    const adminUsers = await User.find({ role: { $in: ['ADMIN', 'MANAGER'] } });
    console.log(`[LowStock] Found ${adminUsers.length} admin/manager(s) to notify`);

    if (adminUsers.length === 0) {
        console.warn('[LowStock] WARNING: No ADMIN/MANAGER users found!');
        return;
    }

    for (const admin of adminUsers) {
        try {
            await notificationService.createStockAlert(
                pack_type_id, newStockQty, null, threshold, admin._id
            );
            console.log(`[LowStock] ✅ Notification created for user ${admin._id}`);
        } catch (err) {
            console.error(`[LowStock] Failed to notify user ${admin._id}:`, err.message);
        }
    }
};

// ── public methods ────────────────────────────────────────────────────────────

const createSale = async ({ customer_id, payment_method, items }, user) => {
    if (!items || items.length === 0)
        throw Object.assign(new Error('Sale must have at least one item'), { statusCode: 422 });

    let total_revenue = 0, total_cost = 0;
    const resolvedItems = [];

    for (const item of items) {
        const { pack_type_id, qty } = item;
        const inventory = await Inventory.findOne({ pack_type_id });
        if (!inventory) throw new Error(`No inventory found for pack type ${pack_type_id}`);
        if (inventory.stock_qty < qty)
            throw new Error(`Insufficient stock for ${pack_type_id}. Available: ${inventory.stock_qty}`);

        const unit_price_sold  = await resolveUnitPrice(customer_id, pack_type_id);
        const unit_cost_at_sale = await costService.getLatestCost(pack_type_id);
        const { line_revenue, line_cost, line_profit } = calculateProfit(qty, unit_price_sold, unit_cost_at_sale);

        resolvedItems.push({ pack_type_id, qty, unit_price_sold, unit_cost_at_sale, line_revenue, line_cost, line_profit });
        total_revenue += line_revenue;
        total_cost    += line_cost;
    }

    const total_profit     = parseFloat((total_revenue - total_cost).toFixed(2));
    const sale_no          = await generateSequence('SALE');
    const payment_status   = derivePaymentStatus(payment_method);   // ← NEW

    const sale = await Sale.create({
        sale_no,
        customer_id,
        created_by_user_id: user._id,
        payment_method,
        payment_status,                // ← NEW
        total_revenue,
        total_cost,
        total_profit,
        items: resolvedItems
    });

    console.log(`[Sale] Sale ${sale_no} created (method: ${payment_method}, status: ${payment_status})`);

    for (const ri of resolvedItems) {
        await Inventory.findOneAndUpdate(
            { pack_type_id: ri.pack_type_id },
            { $inc: { stock_qty: -ri.qty }, last_updated_at: new Date() }
        );
        const currentInventory = await Inventory.findOne({ pack_type_id: ri.pack_type_id });
        await triggerLowStockNotification(ri.pack_type_id, currentInventory.stock_qty);
    }

    return Sale.findById(sale._id)
        .populate('customer_id', 'customer_code name')
        .populate('items.pack_type_id', 'pack_name weight_kg');
};

// ── Mark as Paid ──────────────────────────────────────────────────────────────
/**
 * Marks a CREDIT sale's payment_status as PAID.
 * Only valid for CREDIT sales that are currently PENDING.
 * Does NOT touch stock, items, or any other financial field.
 */
const markAsPaid = async (id) => {
    const sale = await Sale.findById(id);
    if (!sale)
        throw Object.assign(new Error('Sale not found'), { statusCode: 404 });
    if (sale.payment_method !== 'CREDIT')
        throw Object.assign(new Error('Only CREDIT sales can be marked as paid'), { statusCode: 400 });
    if (sale.payment_status === 'PAID')
        throw Object.assign(new Error('Payment is already marked as paid'), { statusCode: 409 });
    if (sale.status === 'CANCELLED')
        throw Object.assign(new Error('Cannot update payment on a cancelled sale'), { statusCode: 400 });

    sale.payment_status = 'PAID';
    await sale.save();

    return Sale.findById(sale._id)
        .populate('customer_id', 'customer_code name')
        .populate('created_by_user_id', 'full_name username')
        .populate('items.pack_type_id', 'pack_name weight_kg');
};

const cancelSale = async (id) => {
    const sale = await Sale.findById(id);
    if (!sale) throw Object.assign(new Error('Sale not found'), { statusCode: 404 });
    if (sale.status === 'CANCELLED') throw Object.assign(new Error('Sale is already cancelled'), { statusCode: 409 });

    for (const item of sale.items) {
        await Inventory.findOneAndUpdate(
            { pack_type_id: item.pack_type_id },
            { $inc: { stock_qty: item.qty }, last_updated_at: new Date() }
        );
    }

    sale.status = 'CANCELLED';
    await sale.save();
    return sale.populate('customer_id items.pack_type_id');
};

const remove = async (id) => {
    const sale = await Sale.findByIdAndDelete(id);
    if (!sale) throw Object.assign(new Error('Sale not found'), { statusCode: 404 });
};

const getAll = () => Sale.find()
    .populate('customer_id', 'customer_code name')
    .populate('created_by_user_id', 'full_name username')
    .populate('items.pack_type_id', 'pack_name weight_kg')
    .sort({ sale_datetime: -1 });

const getById = async (id) => {
    const sale = await Sale.findById(id)
        .populate('customer_id')
        .populate('created_by_user_id', 'full_name username')
        .populate('items.pack_type_id');
    if (!sale) throw Object.assign(new Error('Sale not found'), { statusCode: 404 });
    return sale;
};

const getAllPaginated = async (page = 0, size = 20, filters = {}) => {
    const skip  = page * size;
    const match = { status: { $ne: 'DRAFT' } };

    if (filters.customerId)     match.customer_id      = filters.customerId;
    if (filters.status)         match.status            = filters.status;
    if (filters.paymentMethod)  match.payment_method    = filters.paymentMethod;   // ← NEW filter
    if (filters.paymentStatus)  match.payment_status    = filters.paymentStatus;   // ← NEW filter
    if (filters.dateFrom)       match.sale_datetime     = { $gte: new Date(filters.dateFrom) };
    if (filters.dateTo) {
        if (!match.sale_datetime) match.sale_datetime = {};
        match.sale_datetime.$lte = new Date(filters.dateTo);
    }

    const [sales, total] = await Promise.all([
        Sale.find(match)
            .populate('customer_id', 'customer_code name')
            .populate('created_by_user_id', 'full_name username')
            .populate('items.pack_type_id', 'pack_name weight_kg')
            .sort({ sale_datetime: -1 })
            .skip(skip)
            .limit(size),
        Sale.countDocuments(match)
    ]);

    return { content: sales, page, size, totalElements: total, totalPages: Math.ceil(total / size) };
};

const updateSale = async (id, { customer_id, payment_method, items }) => {
    if (!items || items.length === 0)
        throw Object.assign(new Error('Sale must have at least one item'), { statusCode: 422 });

    const sale = await Sale.findById(id);
    if (!sale) throw Object.assign(new Error('Sale not found'), { statusCode: 404 });
    if (sale.status === 'CANCELLED')
        throw Object.assign(new Error('Cannot edit a cancelled sale'), { statusCode: 400 });

    // Restore old stock
    for (const oldItem of sale.items) {
        await Inventory.findOneAndUpdate(
            { pack_type_id: oldItem.pack_type_id },
            { $inc: { stock_qty: oldItem.qty }, last_updated_at: new Date() }
        );
    }

    let total_revenue = 0, total_cost = 0;
    const newItems = [];

    for (const item of items) {
        const { pack_type_id, qty, unit_price_sold } = item;
        const inventory = await Inventory.findOne({ pack_type_id });
        if (!inventory)
            throw Object.assign(new Error(`No inventory found for pack ${pack_type_id}`), { statusCode: 400 });
        if (inventory.stock_qty < qty)
            throw Object.assign(
                new Error(`Insufficient stock for ${pack_type_id}. Available: ${inventory.stock_qty}`),
                { statusCode: 400 }
            );

        const unit_cost_at_sale = await costService.getLatestCost(pack_type_id);
        const { line_revenue, line_cost, line_profit } = calculateProfit(qty, unit_price_sold, unit_cost_at_sale);
        newItems.push({ pack_type_id, qty, unit_price_sold, unit_cost_at_sale, line_revenue, line_cost, line_profit });
        total_revenue += line_revenue;
        total_cost    += line_cost;
    }

    const total_profit = parseFloat((total_revenue - total_cost).toFixed(2));

    for (const ni of newItems) {
        await Inventory.findOneAndUpdate(
            { pack_type_id: ni.pack_type_id },
            { $inc: { stock_qty: -ni.qty }, last_updated_at: new Date() }
        );
        const currentInventory = await Inventory.findOne({ pack_type_id: ni.pack_type_id });
        await triggerLowStockNotification(ni.pack_type_id, currentInventory.stock_qty);
    }

    sale.customer_id    = customer_id    ?? sale.customer_id;
    sale.payment_method = payment_method ?? sale.payment_method;
    // Re-derive payment_status only if payment_method is being changed
    if (payment_method && payment_method !== sale.payment_method) {
        // If switching away from CREDIT to a real method → mark paid
        // If switching to CREDIT                          → mark pending (only if currently not paid)
        sale.payment_status = derivePaymentStatus(payment_method);
    }
    sale.items         = newItems;
    sale.total_revenue = total_revenue;
    sale.total_cost    = total_cost;
    sale.total_profit  = total_profit;

    await sale.save();

    return Sale.findById(sale._id)
        .populate('customer_id', 'name customer_code')
        .populate('created_by_user_id', 'full_name username')
        .populate('items.pack_type_id', 'pack_name weight_kg');
};

module.exports = { getAllPaginated, getAll, getById, createSale, cancelSale, remove, updateSale, markAsPaid };