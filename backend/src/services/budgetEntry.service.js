// backend/services/budgetEntry.service.js
const BudgetEntry = require('../models/BudgetEntry');

// GET all – sorted newest first
const getAll = async () => BudgetEntry.find().sort({ date: -1 }).lean();

// GET by ID
const getById = async (id) => {
    const entry = await BudgetEntry.findById(id).lean();
    if (!entry) throw Object.assign(new Error('Budget entry not found'), { statusCode: 404 });
    return entry;
};

// CREATE
const create = async ({ description, amount, date }, userId) => {
    if (!description || description.trim() === '')
        throw Object.assign(new Error('Description is required'), { statusCode: 400 });

    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0)
        throw Object.assign(new Error('Amount must be a positive number'), { statusCode: 400 });

    return BudgetEntry.create({
        description: description.trim(),
        amount:      amt,
        date:        date ? new Date(date) : new Date(),
        created_by:  userId ?? null,
    });
};

// UPDATE
const update = async (id, { description, amount, date }) => {
    const patch = {};
    if (description !== undefined) patch.description = description.trim();
    if (amount !== undefined) {
        const amt = Number(amount);
        if (isNaN(amt) || amt <= 0)
            throw Object.assign(new Error('Amount must be a positive number'), { statusCode: 400 });
        patch.amount = amt;
    }
    if (date !== undefined) patch.date = new Date(date);

    const updated = await BudgetEntry.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
    if (!updated) throw Object.assign(new Error('Budget entry not found'), { statusCode: 404 });
    return updated;
};

// DELETE
const remove = async (id) => {
    const deleted = await BudgetEntry.findByIdAndDelete(id).lean();
    if (!deleted) throw Object.assign(new Error('Budget entry not found'), { statusCode: 404 });
};

module.exports = { getAll, getById, create, update, remove };