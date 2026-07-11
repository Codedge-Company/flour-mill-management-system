// services/sparePart.service.js
const SparePart = require('../models/SparePart');
const { notifyLowStock } = require('./whatsapp.service');

// ── Shape returned to the frontend ─────────────────────────────────────────
const enrich = (doc) => ({
  sparePartId: String(doc._id),
  name: doc.name,
  category: doc.category,
  unit: doc.unit,
  qty: doc.qty,
  thresholdQty: doc.threshold_qty,
  supplierNotes: doc.supplier_notes,
  isLowStock: doc.qty <= doc.threshold_qty,
  lastUpdatedAt: doc.last_updated_at,
});

// ── GET all (grouped alphabetically by category, then name) ────────────────
const getAll = async () => {
  const docs = await SparePart.find().sort({ category: 1, name: 1 }).lean();
  return docs.map(enrich);
};

const getById = async (id) => {
  const doc = await SparePart.findById(id).lean();
  if (!doc) throw Object.assign(new Error('Spare part not found'), { statusCode: 404 });
  return enrich(doc);
};

// ── CREATE ───────────────────────────────────────────────────────────────
const create = async ({ name, category, unit, qty, threshold_qty, supplier_notes }) => {
  if (!name || !String(name).trim())
    throw Object.assign(new Error('Spare part name is required'), { statusCode: 400 });

  const doc = await SparePart.create({
    name: String(name).trim(),
    category: category?.trim() || 'General',
    unit: unit?.trim() || 'pcs',
    qty: Number(qty) || 0,
    threshold_qty: Number(threshold_qty) || 0,
    supplier_notes: supplier_notes?.trim() || '',
  });

  return enrich(doc);
};

// ── UPDATE QTY (add_qty adds/subtracts, set_qty overwrites) ────────────────
// Pass a negative add_qty to reduce stock (e.g. when a part is used).
const updateQty = async (id, { add_qty, set_qty }) => {
  if (add_qty === undefined && set_qty === undefined)
    throw Object.assign(new Error('Either add_qty or set_qty is required'), { statusCode: 400 });
  if (add_qty !== undefined && set_qty !== undefined)
    throw Object.assign(new Error('Provide either add_qty or set_qty, not both'), { statusCode: 400 });

  let mongoUpdate;
  if (add_qty !== undefined) {
    const addQty = Number(add_qty);
    if (isNaN(addQty))
      throw Object.assign(new Error('add_qty must be a number'), { statusCode: 400 });
    mongoUpdate = { $inc: { qty: addQty }, $set: { last_updated_at: new Date() } };
  } else {
    const setQty = Number(set_qty);
    if (isNaN(setQty) || setQty < 0)
      throw Object.assign(new Error('set_qty must be a non-negative number'), { statusCode: 400 });
    mongoUpdate = { $set: { qty: setQty, last_updated_at: new Date() } };
  }

  let doc = await SparePart.findByIdAndUpdate(id, mongoUpdate, { new: true });
  if (!doc) throw Object.assign(new Error('Spare part not found'), { statusCode: 404 });

  // Never let a reduction push qty below 0
  if (doc.qty < 0) {
    doc = await SparePart.findByIdAndUpdate(id, { $set: { qty: 0 } }, { new: true });
  }

  if (doc.qty <= doc.threshold_qty) {
    try {
      await notifyLowStock({
        itemName: doc.name,
        category: `Spare Part${doc.category ? ' — ' + doc.category : ''}`,
        currentQty: doc.qty,
        unit: doc.unit,
        thresholdQty: doc.threshold_qty,
      });
    } catch (err) {
      console.error('[SparePart] WhatsApp low-stock notify failed:', err.message);
    }
  }

  return enrich(doc);
};

// ── UPDATE DETAILS (name, category, unit, threshold, notes) ────────────────
const updateDetails = async (id, { name, category, unit, threshold_qty, supplier_notes }) => {
  const update = { last_updated_at: new Date() };
  if (name !== undefined) update.name = String(name).trim();
  if (category !== undefined) update.category = String(category).trim();
  if (unit !== undefined) update.unit = String(unit).trim();
  if (threshold_qty !== undefined) update.threshold_qty = Number(threshold_qty);
  if (supplier_notes !== undefined) update.supplier_notes = String(supplier_notes).trim();

  const doc = await SparePart.findByIdAndUpdate(id, { $set: update }, { new: true });
  if (!doc) throw Object.assign(new Error('Spare part not found'), { statusCode: 404 });
  return enrich(doc);
};

// ── DELETE ───────────────────────────────────────────────────────────────
const remove = async (id) => {
  const doc = await SparePart.findByIdAndDelete(id);
  if (!doc) throw Object.assign(new Error('Spare part not found'), { statusCode: 404 });
};

module.exports = { getAll, getById, create, updateQty, updateDetails, remove };
