const StockThreshold = require('../models/StockThreshold');

const getAll = () => StockThreshold.find().populate('pack_type_id', 'pack_name weight_kg');

const getByPackType = async (pack_type_id) => {
    const t = await StockThreshold.findOne({ pack_type_id }).populate('pack_type_id');
    if (!t) throw Object.assign(new Error('Threshold not found'), { statusCode: 404 });
    return t;
};

const create = async ({ pack_type_id, threshold_qty }) => {
    const existing = await StockThreshold.findOne({ pack_type_id });
    if (existing) throw Object.assign(new Error('Threshold already exists for this pack type'), { statusCode: 409 });
    return StockThreshold.create({ pack_type_id, threshold_qty });
};

const update = async (pack_type_id, { threshold_qty }) => {
    const t = await StockThreshold.findOneAndUpdate(
        { pack_type_id },
        { threshold_qty },
        { new: true, runValidators: true }
    );
    if (!t) throw Object.assign(new Error('Threshold not found'), { statusCode: 404 });
    return t;
};

const remove = async (pack_type_id) => {
    const t = await StockThreshold.findOneAndDelete({ pack_type_id });
    if (!t) throw Object.assign(new Error('Threshold not found'), { statusCode: 404 });
};

module.exports = { getAll, getByPackType, create, update, remove };