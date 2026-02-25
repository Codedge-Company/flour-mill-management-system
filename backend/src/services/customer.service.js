const Customer = require('../models/Customer');
const CustomerPriceRule = require('../models/CustomerPriceRule'); // Standardized casing
const PackType = require('../models/PackType');
const DefaultPrice = require('../models/DefaultPrice'); // Assuming this exists for defaults; adjust if needed
const { generateCustomerId } = require('../utils/generateCustomerId');

const getAll = async (search) => {
  const query = {};
  if (search) {
    query.name = { $regex: search, $options: 'i' }; // Case-insensitive search on name
  }
  return Customer.find(query).sort({ created_at: -1 });
};

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
  // Optionally cascade delete price rules
  await CustomerPriceRule.deleteMany({ customer_id: id });
};

const getEffectivePrice = async (customerId, packTypeId) => {
  const rule = await CustomerPriceRule.findOne({ customer_id: customerId, pack_type_id: packTypeId });
  if (rule) {
    return { unit_sell_price: rule.unit_sell_price };
  }

  // Fetch pack type to validate existence
  const packType = await PackType.findById(packTypeId);
  if (!packType) {
    throw Object.assign(new Error('PackType not found'), { statusCode: 404 });
  }

  // Assuming defaults are in a separate DefaultPrice model (adjust query/logic as per your setup)
  const defaultPrice = await DefaultPrice.findOne({ pack_type_id: packTypeId, is_active: true });
  if (!defaultPrice) {
    throw Object.assign(new Error('Default price not found for PackType'), { statusCode: 404 });
  }
  return { unit_sell_price: defaultPrice.unit_sell_price };
};

module.exports = { getAll, getById, create, update, remove, getEffectivePrice };