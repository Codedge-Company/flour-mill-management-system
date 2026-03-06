// backend/services/sales.service.js
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
const Payment = require('../models/Payment');

// ── Helpers ───────────────────────────────────────────────────────────────────

const resolveUnitPrice = async (customer_id, pack_type_id) => {
    const special = await customerPriceRuleService.resolvePrice(customer_id, pack_type_id);
    if (special !== null) return special;
    return defaultPriceService.getLatestPrice(pack_type_id);
};

const derivePaymentStatus = (payment_method) =>
    payment_method === 'CREDIT' ? 'PENDING' : 'PAID';

const triggerLowStockNotification = async (pack_type_id, newStockQty) => {
    const thresholdDoc = await StockThreshold.findOne({ pack_type_id });
    const threshold = thresholdDoc ? thresholdDoc.threshold_qty : 10;
    if (newStockQty > threshold) return;

    const adminUsers = await User.find({ role: { $in: ['ADMIN', 'MANAGER'] } });
    for (const admin of adminUsers) {
        try {
            await notificationService.createStockAlert(pack_type_id, newStockQty, null, threshold, admin._id);
        } catch (err) {
            console.error(`[LowStock] Failed to notify user ${admin._id}:`, err.message);
        }
    }
};

// ── Create ────────────────────────────────────────────────────────────────────

const createSale = async ({ customer_id, payment_method, sale_datetime, items }, user) => {
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

        const unit_price_sold   = await resolveUnitPrice(customer_id, pack_type_id);
        const unit_cost_at_sale = await costService.getLatestCost(pack_type_id);
        const { line_revenue, line_cost, line_profit } = calculateProfit(qty, unit_price_sold, unit_cost_at_sale);

        resolvedItems.push({ pack_type_id, qty, unit_price_sold, unit_cost_at_sale, line_revenue, line_cost, line_profit });
        total_revenue += line_revenue;
        total_cost    += line_cost;
    }

    const total_profit   = parseFloat((total_revenue - total_cost).toFixed(2));
    const sale_no        = await generateSequence('SALE');
    const payment_status = derivePaymentStatus(payment_method);

    const sale = await Sale.create({
        sale_no,
        customer_id,
        created_by_user_id: user._id,
        payment_method,
        payment_status,
        sale_datetime: sale_datetime ? new Date(sale_datetime) : new Date(),
        total_revenue,
        total_cost,
        total_profit,
        items: resolvedItems
    });

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

// ── Cancel ────────────────────────────────────────────────────────────────────

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

    await Payment.deleteMany({ sale_id: id });
    sale.status         = 'CANCELLED';
    sale.payment_status = 'PAID';
    await sale.save();
    return sale.populate('customer_id items.pack_type_id');
};

// ── Delete ────────────────────────────────────────────────────────────────────

const remove = async (id) => {
    const sale = await Sale.findById(id);
    if (!sale) throw Object.assign(new Error('Sale not found'), { statusCode: 404 });
    await Payment.deleteMany({ sale_id: id });
    await Sale.findByIdAndDelete(id);
};

// ── Get all (for reports) ─────────────────────────────────────────────────────

const getAll = () => Sale.find()
    .populate('customer_id', 'customer_code name')
    .populate('created_by_user_id', 'full_name username')
    .populate('items.pack_type_id', 'pack_name weight_kg')
    .sort({ sale_datetime: -1 });

// ── Get by ID ─────────────────────────────────────────────────────────────────

const getById = async (id) => {
    const sale = await Sale.findById(id)
        .populate('customer_id')
        .populate('created_by_user_id', 'full_name username')
        .populate('items.pack_type_id');
    if (!sale) throw Object.assign(new Error('Sale not found'), { statusCode: 404 });
    return sale;
};

// ── Get paginated ─────────────────────────────────────────────────────────────

const getAllPaginated = async (page = 0, size = 20, filters = {}) => {
    const skip  = page * size;
    const match = { status: { $ne: 'DRAFT' } };

    if (filters.customerId)    match.customer_id    = new mongoose.Types.ObjectId(filters.customerId);
    if (filters.status)        match.status         = filters.status;
    if (filters.paymentMethod) match.payment_method = filters.paymentMethod;
    if (filters.paymentStatus) match.payment_status = filters.paymentStatus;
    if (filters.dateFrom)      match.sale_datetime  = { $gte: new Date(filters.dateFrom) };
    if (filters.dateTo) {
        if (!match.sale_datetime) match.sale_datetime = {};
        match.sale_datetime.$lte = new Date(filters.dateTo + 'T23:59:59.999Z');
    }

    // ── Build sub-matches for immediate vs credit ─────────────────────────────
    // Respect any existing payment_method filter instead of blindly overriding it.
    const pm = filters.paymentMethod;
    const immediateOnlyMatch = pm
        ? (['CASH', 'CARD', 'BANK'].includes(pm) ? match : { ...match, payment_method: '__SKIP__' })
        : { ...match, payment_method: { $in: ['CASH', 'CARD', 'BANK'] } };

    const creditOnlyMatch = pm
        ? (pm === 'CREDIT' ? match : { ...match, payment_method: '__SKIP__' })
        : { ...match, payment_method: 'CREDIT' };

    // ── Run page IDs, totals (split), and count in parallel ───────────────────
    const [saleIds, immediateTotalsRaw, creditTotalsRaw, total] = await Promise.all([
        Sale.find(match)
            .sort({ sale_datetime: -1 })
            .skip(skip)
            .limit(size)
            .select('_id')
            .lean(),

        // Immediate: sum directly from Sale fields
        Sale.aggregate([
            { $match: immediateOnlyMatch },
            {
                $group: {
                    _id:           null,
                    total_revenue: { $sum: '$total_revenue' },
                    total_cost:    { $sum: '$total_cost'    },
                    total_profit:  { $sum: '$total_profit'  },
                },
            },
        ]),

        // Credit: look up actual payments and apportion cost/profit via payRatio
        Sale.aggregate([
            { $match: creditOnlyMatch },
            {
                $lookup: {
                    from:         'payments',
                    localField:   '_id',
                    foreignField: 'sale_id',
                    as:           'payments',
                },
            },
            {
                $addFields: {
                    total_paid: { $sum: '$payments.amount' },
                    payRatio: {
                        $cond: [
                            { $gt: ['$total_revenue', 0] },
                            { $divide: [{ $sum: '$payments.amount' }, '$total_revenue'] },
                            0,
                        ],
                    },
                },
            },
            {
                $group: {
                    _id:           null,
                    total_revenue: { $sum: '$total_paid' },
                    total_cost:    { $sum: { $multiply: ['$payRatio', '$total_cost']   } },
                    total_profit:  { $sum: { $multiply: ['$payRatio', '$total_profit'] } },
                },
            },
        ]),

        Sale.countDocuments(match),
    ]);

    const pageIds = saleIds.map(s => s._id);

    // Fetch full page data + payment sums in parallel
    const [salesPopulated, paidAgg] = await Promise.all([
        Sale.find({ _id: { $in: pageIds } })
            .populate('customer_id',        'customer_code name')
            .populate('created_by_user_id', 'full_name username')
            .populate('items.pack_type_id', 'pack_name weight_kg')
            .sort({ sale_datetime: -1 })
            .lean(),

        Payment.aggregate([
            { $match: { sale_id: { $in: pageIds } } },
            { $group: { _id: '$sale_id', total_paid: { $sum: '$amount' } } },
        ]),
    ]);

    // Attach total_paid to each sale doc
    const paidMap = {};
    for (const p of paidAgg) paidMap[p._id.toString()] = p.total_paid;
    for (const s of salesPopulated) s.total_paid = paidMap[s._id.toString()] ?? 0;

    // ── Merge immediate + credit totals ───────────────────────────────────────
    const it = immediateTotalsRaw[0] ?? { total_revenue: 0, total_cost: 0, total_profit: 0 };
    const ct = creditTotalsRaw[0]   ?? { total_revenue: 0, total_cost: 0, total_profit: 0 };

    return {
        content:       salesPopulated,
        page,
        size,
        totalElements: total,
        totalPages:    Math.ceil(total / size),
        totals: {
            total_revenue: it.total_revenue + ct.total_revenue,
            total_cost:    it.total_cost    + ct.total_cost,
            total_profit:  it.total_profit  + ct.total_profit,
        },
    };
};


// ── Update ────────────────────────────────────────────────────────────────────

const updateSale = async (id, { customer_id, payment_method, sale_datetime, items }) => {
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

    const oldPaymentMethod = sale.payment_method?.toString();

    if (customer_id)   sale.customer_id   = customer_id;
    if (sale_datetime) sale.sale_datetime = new Date(sale_datetime);
    if (payment_method) {
        sale.payment_method = payment_method;
        if (payment_method !== oldPaymentMethod) {
            sale.payment_status = derivePaymentStatus(payment_method);
        }
    }

    sale.items         = newItems;
    sale.total_revenue = total_revenue;
    sale.total_cost    = total_cost;
    sale.total_profit  = total_profit;

    await sale.save();

    return Sale.findById(sale._id)
        .populate('customer_id',        'name customer_code')
        .populate('created_by_user_id', 'full_name username')
        .populate('items.pack_type_id', 'pack_name weight_kg');
};

module.exports = { getAllPaginated, getAll, getById, createSale, cancelSale, remove, updateSale, markAsPaid };