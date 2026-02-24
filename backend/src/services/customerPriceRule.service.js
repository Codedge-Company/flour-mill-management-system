const CustomerPriceRule = require('../models/CustomerPriceRule');

const getAll = () =>
    CustomerPriceRule.find()
        .populate('customer_id', 'customer_code name')
        .populate('pack_type_id', 'pack_name weight_kg')
        .sort({ effective_from: -1 });

const getById = async (id) => {
    const r = await CustomerPriceRule.findById(id).populate('customer_id').populate('pack_type_id');
    if (!r) throw Object.assign(new Error('Price rule not found'), { statusCode: 404 });
    return r;
};

const getByCustomer = (customer_id) =>
    CustomerPriceRule.find({ customer_id, is_active: true })
        .populate('pack_type_id', 'pack_name weight_kg');

const resolvePrice = async (customer_id, pack_type_id) => {
    const rule = await CustomerPriceRule.findOne({ customer_id, pack_type_id, is_active: true })
        .sort({ effective_from: -1 });
    return rule ? rule.unit_sell_price : null;
};

const create = async ({ customer_id, pack_type_id, unit_sell_price, effective_from }) => {
    await CustomerPriceRule.updateMany({ customer_id, pack_type_id, is_active: true }, { is_active: false });
    return CustomerPriceRule.create({ customer_id, pack_type_id, unit_sell_price, effective_from: effective_from || new Date(), is_active: true });
};

const update = async (id, body) => {
    const r = await CustomerPriceRule.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    if (!r) throw Object.assign(new Error('Price rule not found'), { statusCode: 404 });
    return r;
};

const remove = async (id) => {
    const r = await CustomerPriceRule.findByIdAndDelete(id);
    if (!r) throw Object.assign(new Error('Price rule not found'), { statusCode: 404 });
};

module.exports = { getAll, getById, getByCustomer, resolvePrice, create, update, remove };