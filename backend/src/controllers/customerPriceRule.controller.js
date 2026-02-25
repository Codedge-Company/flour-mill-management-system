// src/controllers/customerPriceRule.controller.js
const customerPriceRuleService = require('../services/customerPriceRule.service');

const getAllPriceRules = async (req, res, next) => {
  try {
    const rules = await customerPriceRuleService.getAll();
    res.status(200).json(rules);
  } catch (err) {
    next(err); // Pass to error handler middleware
  }
};

const getPriceRulesByCustomer = async (req, res, next) => {
  try {
    const { customer_id } = req.params;
    const rules = await customerPriceRuleService.getByCustomer(customer_id);
    res.status(200).json(rules);
  } catch (err) {
    next(err);
  }
};

const getPriceRuleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rule = await customerPriceRuleService.getById(id);
    res.status(200).json(rule);
  } catch (err) {
    next(err);
  }
};

const createPriceRule = async (req, res, next) => {
  try {
    const { customer_id, pack_type_id, unit_sell_price } = req.body;
    const newRule = await customerPriceRuleService.create({ customer_id, pack_type_id, unit_sell_price });
    res.status(201).json(newRule);
  } catch (err) {
    next(err);
  }
};

const updatePriceRule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { unit_sell_price } = req.body; // Add more fields if updatable
    const updatedRule = await customerPriceRuleService.update(id, { unit_sell_price });
    res.status(200).json(updatedRule);
  } catch (err) {
    next(err);
  }
};

const deletePriceRule = async (req, res, next) => {
  try {
    const { id } = req.params;
    await customerPriceRuleService.remove(id);
    res.status(204).send(); // No content
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllPriceRules,
  getPriceRulesByCustomer,
  getPriceRuleById,
  createPriceRule,
  updatePriceRule,
  deletePriceRule,
};