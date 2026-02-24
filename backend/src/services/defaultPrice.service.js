const DefaultPrice = require('../models/DefaultPrice');

const getAll = () => DefaultPrice.find().populate('pack_type_id', 'pack_name weight_kg').sort({ effective_from: -1 });

const getById = async (id) => {
    const p = await DefaultPrice.findById(id).populate('pack_type_id');
    if (!p) throw Object.assign(new Error('Default price not found'), { statusCode: 404 });
    return p;
};

const getActiveByPackType = async (pack_type_id) => {
    const p = await DefaultPrice.findOne({ pack_type_id, is_active: true }).sort({ effective_from: -1 });
    if (!p) throw Object.assign(new Error('No active default price found'), { statusCode: 404 });
    return p;
};

const getLatestPrice = async (pack_type_id) => {
    const p = await getActiveByPackType(pack_type_id);
    return p.unit_sell_price;
};

const create = async ({ pack_type_id, unit_sell_price, effective_from }) => {
    await DefaultPrice.updateMany({ pack_type_id, is_active: true }, { is_active: false });
    return DefaultPrice.create({ pack_type_id, unit_sell_price, effective_from: effective_from || new Date(), is_active: true });
};

const update = async (id, body) => {
    const p = await DefaultPrice.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    if (!p) throw Object.assign(new Error('Default price not found'), { statusCode: 404 });
    return p;
};

const remove = async (id) => {
    const p = await DefaultPrice.findByIdAndDelete(id);
    if (!p) throw Object.assign(new Error('Default price not found'), { statusCode: 404 });
};

module.exports = { getAll, getById, getActiveByPackType, getLatestPrice, create, update, remove };