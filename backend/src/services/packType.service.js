const PackType = require('../models/PackType');

const getAll = () => PackType.find().sort({ weight_kg: 1 });

const getById = async (id) => {
    const pt = await PackType.findById(id);
    if (!pt) throw Object.assign(new Error('Pack type not found'), { statusCode: 404 });
    return pt;
};

const create = ({ pack_name, weight_kg, is_active }) =>
    PackType.create({ pack_name, weight_kg, is_active });

const update = async (id, { pack_name, weight_kg, is_active }) => {
    const pt = await PackType.findByIdAndUpdate(
        id, { pack_name, weight_kg, is_active }, { new: true, runValidators: true }
    );
    if (!pt) throw Object.assign(new Error('Pack type not found'), { statusCode: 404 });
    return pt;
};

const remove = async (id) => {
    const pt = await PackType.findByIdAndDelete(id);
    if (!pt) throw Object.assign(new Error('Pack type not found'), { statusCode: 404 });
};

module.exports = { getAll, getById, create, update, remove };