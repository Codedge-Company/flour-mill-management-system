const CostHistory = require('../models/CostHistory');

const getAll = () => CostHistory.find().populate('pack_type_id', 'pack_name weight_kg').sort({ effective_from: -1 });

const getById = async (id) => {
    const c = await CostHistory.findById(id).populate('pack_type_id');
    if (!c) throw Object.assign(new Error('Cost record not found'), { statusCode: 404 });
    return c;
};

const getByPackType = (pack_type_id) =>
    CostHistory.find({ pack_type_id }).sort({ effective_from: -1 });

const getLatestCost = async (pack_type_id) => {
    const c = await CostHistory.findOne({ pack_type_id }).sort({ effective_from: -1 });
    if (!c) throw Object.assign(new Error(`No cost record found for this pack type`), { statusCode: 404 });
    return c.unit_cost;
};

const create = ({ pack_type_id, unit_cost, effective_from, updated_by_user_id }) =>
    CostHistory.create({ pack_type_id, unit_cost, effective_from: effective_from || new Date(), updated_by_user_id });

const update = async (id, body) => {
    const c = await CostHistory.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    if (!c) throw Object.assign(new Error('Cost record not found'), { statusCode: 404 });
    return c;
};

const remove = async (id) => {
    const c = await CostHistory.findByIdAndDelete(id);
    if (!c) throw Object.assign(new Error('Cost record not found'), { statusCode: 404 });
};

module.exports = { getAll, getById, getByPackType, getLatestCost, create, update, remove };