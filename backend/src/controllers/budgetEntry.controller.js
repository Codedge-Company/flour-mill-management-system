// backend/controllers/budgetEntry.controller.js
const svc = require('../services/budgetEntry.service');

const send = (res, statusCode, data) => res.status(statusCode).json(data);

const getAll = async (req, res) => {
    try {
        const data = await svc.getAll();
        send(res, 200, { success: true, data });
    } catch (err) {
        send(res, err.statusCode || 500, { success: false, message: err.message });
    }
};

const getById = async (req, res) => {
    try {
        const data = await svc.getById(req.params.id);
        send(res, 200, { success: true, data });
    } catch (err) {
        send(res, err.statusCode || 500, { success: false, message: err.message });
    }
};

const create = async (req, res) => {
    try {
        const data = await svc.create(req.body, req.user?._id);
        send(res, 201, { success: true, data });
    } catch (err) {
        send(res, err.statusCode || 500, { success: false, message: err.message });
    }
};

const update = async (req, res) => {
    try {
        const data = await svc.update(req.params.id, req.body);
        send(res, 200, { success: true, data });
    } catch (err) {
        send(res, err.statusCode || 500, { success: false, message: err.message });
    }
};

const remove = async (req, res) => {
    try {
        await svc.remove(req.params.id);
        send(res, 200, { success: true, message: 'Budget entry deleted successfully' });
    } catch (err) {
        send(res, err.statusCode || 500, { success: false, message: err.message });
    }
};

module.exports = { getAll, getById, create, update, remove };