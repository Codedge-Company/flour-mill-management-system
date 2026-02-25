const Inventory      = require('../models/Inventory');
const StockThreshold = require('../models/StockThreshold');
const CostHistory    = require('../models/CostHistory');
const Notification   = require('../models/Notification');
const PackType       = require('../models/PackType');

// ── Helper: enrich a single inventory doc with cost + threshold ──
const enrichOne = async (inv) => {
  const packId = inv.pack_type_id?._id ?? inv.pack_type_id;

  const [latestCost, threshold] = await Promise.all([
    CostHistory.findOne({ pack_type_id: packId })
      .sort({ effective_from: -1 })
      .lean(),
    StockThreshold.findOne({ pack_type_id: packId }).lean(),
  ]);

  // pack_type_id may be a populated object or plain ID depending on caller
  const pt = (inv.pack_type_id && typeof inv.pack_type_id === 'object')
    ? inv.pack_type_id
    : null;

  return {
    pack_type_id:    String(packId),
    pack_name:       pt?.pack_name       ?? '',
    weight_kg:       pt?.weight_kg       ?? 0,
    is_active:       pt?.is_active       ?? true,
    stock_qty:       inv.stock_qty       ?? 0,
    last_updated_at: inv.last_updated_at ?? new Date(),
    unit_cost:       latestCost?.unit_cost      ?? 0,
    cost_updated_at: latestCost?.effective_from ?? inv.last_updated_at ?? new Date(),
    threshold_qty:   threshold?.threshold_qty   ?? 0,
    is_low_stock:    (inv.stock_qty ?? 0) <= (threshold?.threshold_qty ?? 0),
  };
};

// ── GET all ──────────────────────────────────────────────────────
const getAll = async () => {
  const inventories = await Inventory.find()
    .populate('pack_type_id', 'pack_name weight_kg is_active')
    .lean();

  return Promise.all(inventories.map(enrichOne));
};

// ── GET by pack type ID ───────────────────────────────────────────
const getByPackType = async (pack_type_id) => {
  const inv = await Inventory.findOne({ pack_type_id })
    .populate('pack_type_id', 'pack_name weight_kg is_active')
    .lean();

  if (!inv) throw Object.assign(new Error('Inventory record not found'), { statusCode: 404 });

  return enrichOne(inv);
};

// ── CREATE ────────────────────────────────────────────────────────
const create = async ({ pack_type_id, stock_qty }) => {
  const existing = await Inventory.findOne({ pack_type_id });
  if (existing) throw Object.assign(
    new Error('Inventory record already exists for this pack type'),
    { statusCode: 409 }
  );

  const inv = await Inventory.create({ pack_type_id, stock_qty });

  // Re-fetch with populate so enrichOne has pack info
  const populated = await Inventory.findById(inv._id)
    .populate('pack_type_id', 'pack_name weight_kg is_active')
    .lean();

  return enrichOne(populated);
};

// ── UPDATE (add stock) ────────────────────────────────────────────
const update = async (pack_type_id, { stock_qty }) => {
  const inv = await Inventory.findOneAndUpdate(
    { pack_type_id },
    { stock_qty, last_updated_at: new Date() },
    { new: true }
  ).populate('pack_type_id', 'pack_name weight_kg is_active').lean();

  if (!inv) throw Object.assign(new Error('Inventory record not found'), { statusCode: 404 });

  // Fire low-stock notification if needed
  const threshold = await StockThreshold.findOne({ pack_type_id }).lean();
  if (threshold && stock_qty <= threshold.threshold_qty) {
    const pt = inv.pack_type_id ?? await PackType.findById(pack_type_id).lean();
    await Notification.create({
      type:         'LOW_STOCK',
      pack_type_id,
      message:      `Low stock alert: ${pt?.pack_name ?? pack_type_id} has only ${stock_qty} units remaining.`,
    });
  }

  return enrichOne(inv);
};

// ── DELETE ────────────────────────────────────────────────────────
const remove = async (pack_type_id) => {
  const inv = await Inventory.findOneAndDelete({ pack_type_id });
  if (!inv) throw Object.assign(new Error('Inventory record not found'), { statusCode: 404 });
};

module.exports = { getAll, getByPackType, create, update, remove };
