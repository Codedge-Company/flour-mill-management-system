// controllers/expenditure.controller.js
const expenditureService = require('../services/expenditure.service');

const send = (res, statusCode, data) => res.status(statusCode).json(data);

const getAllExpenditures = async (req, res) => {
    try {
        const data = await expenditureService.getAll();
        send(res, 200, { success: true, data });
    } catch (err) {
        send(res, err.statusCode || 500, { success: false, message: err.message });
    }
};

const getExpenditureById = async (req, res) => {
    try {
        const data = await expenditureService.getById(req.params.id);
        send(res, 200, { success: true, data });
    } catch (err) {
        send(res, err.statusCode || 500, { success: false, message: err.message });
    }
};

const createExpenditure = async (req, res) => {
    try {
        const data = await expenditureService.create(req.body);
        send(res, 201, { success: true, data });
    } catch (err) {
        send(res, err.statusCode || 500, { success: false, message: err.message });
    }
};

const updateExpenditure = async (req, res) => {
    try {
        const data = await expenditureService.update(req.params.id, req.body);
        send(res, 200, { success: true, data });
    } catch (err) {
        send(res, err.statusCode || 500, { success: false, message: err.message });
    }
};

const deleteExpenditure = async (req, res) => {
    try {
        await expenditureService.remove(req.params.id);
        send(res, 200, { success: true, message: 'Expenditure deleted successfully' });
    } catch (err) {
        send(res, err.statusCode || 500, { success: false, message: err.message });
    }
};

module.exports = {
    getAllExpenditures,
    getExpenditureById,
    createExpenditure,
    updateExpenditure,
    deleteExpenditure,
};