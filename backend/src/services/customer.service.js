const Customer = require('../models/Customer');
const { generateCustomerId } = require('../utils/generateCustomerId');

const getAll = () => Customer.find().sort({ created_at: -1 });

const getById = async (id) => {
    const customer = await Customer.findById(id);
    if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });
    return customer;
};

const create = async ({ name, phone, address, notes }) => {
    const customer_code = await generateCustomerId();
    return Customer.create({ customer_code, name, phone, address, notes });
};

const update = async (id, { name, phone, address, notes }) => {
    const customer = await Customer.findByIdAndUpdate(
        id, { name, phone, address, notes }, { new: true, runValidators: true }
    );
    if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });
    return customer;
};

const remove = async (id) => {
    const customer = await Customer.findByIdAndDelete(id);
    if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });
};

module.exports = { getAll, getById, create, update, remove };