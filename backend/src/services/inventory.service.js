const Inventory = require('../models/Inventory');
const StockThreshold = require('../models/StockThreshold');
const CostHistory = require('../models/CostHistory');
const Notification = require('../models/Notification');
const PackType = require('../models/PackType');

// ── Helper: enrich a single inventory doc with cost + threshold ──
const enrichOne = async (inv) => {
  const packId = inv.pack_type_id?._id ?? inv.pack_type_id;

  const [latestCost, threshold] = await Promise.all([
    CostHistory.findOne({ pack_type_id: packId })
      .sort({ effective_from: -1 })
      .lean(),
    StockThreshold.findOne({ pack_type_id: packId }).lean(),
  ]);

  const pt = (inv.pack_type_id && typeof inv.pack_type_id === 'object')
    ? inv.pack_type_id
    : null;

  return {
    pack_type_id: String(packId),
    pack_name: pt?.pack_name ?? '',
    weight_kg: pt?.weight_kg ?? 0,
    is_active: pt?.is_active ?? true,
    stock_qty: inv.stock_qty ?? 0,
    last_updated_at: inv.last_updated_at ?? new Date(),
    unit_cost: latestCost?.unit_cost ?? 0,
    cost_updated_at: latestCost?.effective_from ?? inv.last_updated_at ?? new Date(),
    threshold_qty: threshold?.threshold_qty ?? 0,
    is_low_stock: (inv.stock_qty ?? 0) <= (threshold?.threshold_qty ?? 0),
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
  const populated = await Inventory.findById(inv._id)
    .populate('pack_type_id', 'pack_name weight_kg is_active')
    .lean();
  return enrichOne(populated);
};

// ── UPDATE (add stock OR correct stock) ───────────────────────────
const update = async (pack_type_id, body, userId) => {
  const { add_qty, set_qty, correction_reason } = body;

  // ── Must provide exactly one of add_qty / set_qty ──
  if (add_qty === undefined && set_qty === undefined)
    throw Object.assign(
      new Error('Either add_qty or set_qty is required'),
      { statusCode: 400 }
    );

  if (add_qty !== undefined && set_qty !== undefined)
    throw Object.assign(
      new Error('Provide either add_qty or set_qty, not both'),
      { statusCode: 400 }
    );

  let mongoUpdate;
  let isCorrection = false;
  let reason = 'Data Entry Mistake'; // ← moved here: outer scope, default value

  // ── Branch: add stock (existing behaviour) ──
  if (add_qty !== undefined) {
    const addQty = Number(add_qty);
    if (isNaN(addQty) || addQty <= 0)
      throw Object.assign(
        new Error('add_qty must be a positive number'),
        { statusCode: 400 }
      );

    mongoUpdate = {
      $inc: { stock_qty: addQty },
      $set: { last_updated_at: new Date() },
    };
  }

  // ── Branch: correct stock (overwrite) ──
  if (set_qty !== undefined) {
    const setQty = Number(set_qty);
    if (isNaN(setQty) || setQty < 0)
      throw Object.assign(
        new Error('set_qty must be a non-negative number'),
        { statusCode: 400 }
      );

    // Assign validated reason (falls back to default if blank or too short)
    reason = (correction_reason && String(correction_reason).trim().length >= 3)
      ? String(correction_reason).trim()
      : 'Data Entry Mistake'; // ← no longer const, just assignment

    mongoUpdate = {
      $set: { stock_qty: setQty, last_updated_at: new Date() },
    };
    isCorrection = true;
  }

  // ── Apply update ──
  const inv = await Inventory.findOneAndUpdate(
    { pack_type_id },
    mongoUpdate,
    { new: true }
  ).populate('pack_type_id', 'pack_name weight_kg is_active').lean();

  if (!inv) throw Object.assign(new Error('Inventory record not found'), { statusCode: 404 });

  // ── Log correction — `reason` is now accessible here ✅ ──
  if (isCorrection) {
    console.info(
      `[Inventory] Stock correction on pack_type_id=${pack_type_id} ` +
      `→ set to ${inv.stock_qty} by userId=${userId ?? 'unknown'}. ` +
      `Reason: "${reason}"`
    );
  }

  // ── Low-stock notification (applies to both add and set) ──
  const threshold = await StockThreshold.findOne({ pack_type_id }).lean();
  try {
    if (threshold && inv.stock_qty <= threshold.threshold_qty) {
      const pt = inv.pack_type_id ?? await PackType.findById(pack_type_id).lean();
      await Notification.create({
        type: 'LOW_STOCK',
        pack_type_id,
        current_stock: inv.stock_qty,
        threshold: threshold.threshold_qty,
        message: `Low stock alert: ${pt?.pack_name ?? pack_type_id} has only ${inv.stock_qty} units remaining.`,
        userId,
      });
    }
  } catch (notifErr) {
    console.error('[Inventory] Notification create failed:', notifErr.message);
  }

  return enrichOne(inv);
};

// ── DELETE ────────────────────────────────────────────────────────
const remove = async (pack_type_id) => {
  const inv = await Inventory.findOneAndDelete({ pack_type_id });
  if (!inv) throw Object.assign(new Error('Inventory record not found'), { statusCode: 404 });
};

module.exports = { getAll, getByPackType, create, update, remove };