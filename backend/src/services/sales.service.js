const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const StockThreshold = require('../models/StockThreshold');
const Notification = require('../models/Notification');
const PackType = require('../models/PackType');
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

const triggerLowStockNotification = async (pack_type_id, stock_qty, session) => {
    const threshold = await StockThreshold.findOne({ pack_type_id }).session(session);
    if (threshold && stock_qty <= threshold.threshold_qty) {
        const pt = await PackType.findById(pack_type_id).session(session);
        await Notification.create(
            [{ type: 'LOW_STOCK', pack_type_id, message: `Low stock alert: ${pt?.pack_name} has only ${stock_qty} units remaining.` }],
            { session }
        );
    }
};

// ── public methods ────────────────────────────────────────────────────────────

const getAll = () =>
    Sale.find()
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

const createSale = async ({ customer_id, payment_method, items }, user) => {
    if (!items || items.length === 0)
        throw Object.assign(new Error('Sale must have at least one item'), { statusCode: 422 });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let total_revenue = 0, total_cost = 0;
        const resolvedItems = [];

        for (const item of items) {
            const { pack_type_id, qty } = item;

            const inventory = await Inventory.findOne({ pack_type_id }).session(session);
            if (!inventory) throw new Error(`No inventory found for pack type ${pack_type_id}`);
            if (inventory.stock_qty < qty)
                throw new Error(`Insufficient stock for pack type ${pack_type_id}. Available: ${inventory.stock_qty}, Requested: ${qty}`);

            const unit_price_sold = await resolveUnitPrice(customer_id, pack_type_id);
            const unit_cost_at_sale = await costService.getLatestCost(pack_type_id);
            const { line_revenue, line_cost, line_profit } = calculateProfit(qty, unit_price_sold, unit_cost_at_sale);

            resolvedItems.push({ pack_type_id, qty, unit_price_sold, unit_cost_at_sale, line_revenue, line_cost, line_profit, inventory });
            total_revenue += line_revenue;
            total_cost += line_cost;
        }

        const total_profit = parseFloat((total_revenue - total_cost).toFixed(2));
        const sale_no = await generateSequence('SALE');

        const [sale] = await Sale.create(
            [{ sale_no, customer_id, created_by_user_id: user._id, payment_method, total_revenue, total_cost, total_profit, items: resolvedItems }],
            { session }
        );

        for (const ri of resolvedItems) {
            const newQty = ri.inventory.stock_qty - ri.qty;
            await Inventory.findOneAndUpdate(
                { pack_type_id: ri.pack_type_id },
                { stock_qty: newQty, last_updated_at: new Date() },
                { session }
            );
            await triggerLowStockNotification(ri.pack_type_id, newQty, session);
        }

        await session.commitTransaction();
        session.endSession();

        return Sale.findById(sale._id)
            .populate('customer_id', 'customer_code name')
            .populate('items.pack_type_id', 'pack_name weight_kg');
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw Object.assign(err, { statusCode: err.statusCode || 422 });
    }
};

const cancelSale = async (id) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const sale = await Sale.findById(id).session(session);
        if (!sale) throw Object.assign(new Error('Sale not found'), { statusCode: 404 });
        if (sale.status === 'CANCELLED') throw Object.assign(new Error('Sale is already cancelled'), { statusCode: 409 });

        for (const item of sale.items) {
            await Inventory.findOneAndUpdate(
                { pack_type_id: item.pack_type_id },
                { $inc: { stock_qty: item.qty }, last_updated_at: new Date() },
                { session }
            );
        }

        sale.status = 'CANCELLED';
        await sale.save({ session });

        await session.commitTransaction();
        session.endSession();
        return sale;
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
    }
};

const remove = async (id) => {
    const sale = await Sale.findByIdAndDelete(id);
    if (!sale) throw Object.assign(new Error('Sale not found'), { statusCode: 404 });
};

module.exports = { getAll, getById, createSale, cancelSale, remove };