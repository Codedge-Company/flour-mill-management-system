const PackType = require('../models/PackType');
const Inventory = require('../models/Inventory');
const StockThreshold = require('../models/StockThreshold');
const CostHistory = require('../models/CostHistory');
const DefaultPrice = require('../models/DefaultPrice');

const getAll = () => PackType.find().sort({ weight_kg: 1 });

const getById = async (id) => {
  const pt = await PackType.findById(id);
  if (!pt) throw Object.assign(new Error('Pack type not found'), { statusCode: 404 });
  return pt;
};

const create = async ({ pack_name, weight_kg, initial_stock = 0, initial_cost, threshold_qty = 0 }) => {
  // 1. Create PackType
  const packType = await PackType.create({
    pack_name: pack_name.trim().toUpperCase(),
    weight_kg,
  });

  const packId = packType._id;

  // 2. Create all related documents in parallel
  const [inventory, threshold, costEntry, defaultPrice] = await Promise.all([
    Inventory.create({
      pack_type_id: packId,
      stock_qty: initial_stock,
      last_updated_at: new Date(),
    }),
    StockThreshold.create({
      pack_type_id: packId,
      threshold_qty: threshold_qty,
    }),
    CostHistory.create({
      pack_type_id: packId,
      unit_cost: initial_cost,
      effective_from: new Date(),
    }),
    DefaultPrice.create({
      pack_type_id: packId,
      unit_sell_price: initial_cost ?? 0,
      effective_from: new Date(),
      is_active: true
    }),
  ]);

  // 3. Return a fully joined object matching frontend mapItem expectations
  return {
    pack_type_id: packId,
    pack_name: packType.pack_name,
    weight_kg: packType.weight_kg,
    is_active: packType.is_active,
    stock_qty: inventory.stock_qty,
    last_updated_at: inventory.last_updated_at,
    unit_cost: costEntry.unit_cost,
    cost_updated_at: costEntry.effective_from,
    threshold_qty: threshold.threshold_qty,
    is_low_stock: inventory.stock_qty <= threshold.threshold_qty,
  };
};

const update = async (id, { pack_name, weight_kg, is_active }) => {
  const pt = await PackType.findByIdAndUpdate(
    id,
    { pack_name, weight_kg, is_active },
    { new: true, runValidators: true }
  );
  if (!pt) throw Object.assign(new Error('Pack type not found'), { statusCode: 404 });
  return pt;
};

const remove = async (id) => {
  const pt = await PackType.findByIdAndDelete(id);
  if (!pt) throw Object.assign(new Error('Pack type not found'), { statusCode: 404 });

  // Clean up all related documents when a pack type is deleted
  await Promise.all([
    Inventory.deleteOne({ pack_type_id: id }),
    StockThreshold.deleteOne({ pack_type_id: id }),
    CostHistory.deleteMany({ pack_type_id: id }),
  ]);
};

module.exports = { getAll, getById, create, update, remove };
