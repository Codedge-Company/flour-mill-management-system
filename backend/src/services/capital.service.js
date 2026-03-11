// backend/src/services/capital.service.js
const Capital = require('../models/Capital');

const getAll = async () => {
  return Capital.find().sort({ capital_date: 1 }).lean();
};

const create = async ({ amount, label, capital_date, note, userId }) => {
  const doc = await Capital.create({
    amount,
    label:        label || '',
    capital_date: new Date(capital_date),
    added_by:     userId,
    note:         note || '',
  });
  return doc;
};

const remove = async (id) => {
  return Capital.findByIdAndDelete(id);
};

module.exports = { getAll, create, remove };