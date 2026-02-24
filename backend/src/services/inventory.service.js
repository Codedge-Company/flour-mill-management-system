const Inventory = require('../models/Inventory');
const StockThreshold = require('../models/StockThreshold');
const Notification = require('../models/Notification');
const PackType = require('../models/PackType');

const getAll = () => Inventory.find().populate('pack_type_id', 'pack_name weight_kg is_active');

const getByPackType = async (pack_type_id) => {
    const inv = await Inventory.findOne({ pack_type_id }).populate('pack_type_id');
    if (!inv) throw Object.assign(new Error('Inventory record not found'), { statusCode: 404 });
    return inv;
};

const create = async ({ pack_type_id, stock_qty }) => {
    const existing = await Inventory.findOne({ pack_type_id });
    if (existing) throw Object.assign(new Error('Inventory record already exists for this pack type'), { statusCode: 409 });
    return Inventory.create({ pack_type_id, stock_qty });
};

const update = async (pack_type_id, { stock_qty }) => {
    const inv = await Inventory.findOneAndUpdate(
        { pack_type_id },
        { stock_qty, last_updated_at: new Date() },
        { new: true }
    );
    if (!inv) throw Object.assign(new Error('Inventory record not found'), { statusCode: 404 });

    const threshold = await StockThreshold.findOne({ pack_type_id });
    if (threshold && stock_qty <= threshold.threshold_qty) {
        const pt = await PackType.findById(pack_type_id);
        await Notification.create({
            type: 'LOW_STOCK',
            pack_type_id,
            message: `Low stock alert: ${pt?.pack_name || pack_type_id} has only ${stock_qty} units remaining.`,
        });
    }
    return inv;
};

const remove = async (pack_type_id) => {
    const inv = await Inventory.findOneAndDelete({ pack_type_id });
    if (!inv) throw Object.assign(new Error('Inventory record not found'), { statusCode: 404 });
};

module.exports = { getAll, getByPackType, create, update, remove };