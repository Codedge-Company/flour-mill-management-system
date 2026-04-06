const RequestedStock = require('../models/Requestedstock');
const PackType = require('../models/PackType');

const mapRequest = (doc) => ({
    stock_request_id: String(doc._id),
    pack_type_id: String(doc.pack_type_id),
    pack_name: doc.pack_name,
    weight_kg: doc.weight_kg,
    qty: doc.qty,
    requested_at: doc.requested_at,
    requested_by: doc.requested_by ?? null,
    status: doc.status,
    operator_name: doc.operator_name ?? null,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
});

const create = async ({ pack_type_id, pack_name, weight_kg, qty }, userId = null) => {
    const packType = await PackType.findById(pack_type_id).lean();
    if (!packType) {
        throw Object.assign(new Error('Pack type not found'), { statusCode: 404 });
    }

    const doc = await RequestedStock.create({
        pack_type_id,
        pack_name: packType.pack_name,
        weight_kg: packType.weight_kg,
        qty: Number(qty),
        requested_at: new Date(),
        requested_by: userId ?? null,
        status: 'PENDING',
        operator_name: null,
    });

    return mapRequest(doc);
};

const getAll = async (filters = {}) => {
    const query = {};
    if (filters.pack_type_id) query.pack_type_id = filters.pack_type_id;
    if (filters.status) query.status = filters.status;

    const docs = await RequestedStock.find(query)
        .sort({ requested_at: -1 })
        .lean();

    return docs.map(mapRequest);
};

const getById = async (id) => {
    const doc = await RequestedStock.findById(id).lean();
    if (!doc) throw Object.assign(new Error('Stock request not found'), { statusCode: 404 });
    return mapRequest(doc);
};

const updateStatus = async (id, status, operatorName = null) => {
    const validStatuses = ['PENDING', 'APPROVED', 'FULFILLED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
        throw Object.assign(
            new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`),
            { statusCode: 400 }
        );
    }

    const updateData = { status };

    if (status === 'FULFILLED') {
        updateData.operator_name = operatorName || null;
    }

    const doc = await RequestedStock.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true }
    ).lean();

    if (!doc) throw Object.assign(new Error('Stock request not found'), { statusCode: 404 });
    return mapRequest(doc);
};

/** Update requested quantity — only allowed while PENDING or APPROVED */
const updateQty = async (id, qty) => {
    const parsed = Number(qty);
    if (!parsed || parsed < 1) {
        throw Object.assign(
            new Error('Quantity must be at least 1'),
            { statusCode: 400 }
        );
    }

    const doc = await RequestedStock.findOneAndUpdate(
        { _id: id, status: { $in: ['PENDING', 'APPROVED'] } },
        { $set: { qty: parsed } },
        { new: true }
    ).lean();

    if (!doc) {
        throw Object.assign(
            new Error('Stock request not found or cannot be edited in its current status'),
            { statusCode: 404 }
        );
    }

    return mapRequest(doc);
};

const remove = async (id) => {
    const doc = await RequestedStock.findByIdAndDelete(id).lean();
    if (!doc) throw Object.assign(new Error('Stock request not found'), { statusCode: 404 });
};

module.exports = { create, getAll, getById, updateStatus, updateQty, remove };