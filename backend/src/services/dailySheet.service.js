// src/services/dailySheet.service.js
// Daily Production Sheet: grinding batches, sifting, packing, empty bags and the
// end-of-day count, all saved against the day's MachineLog.
//
// STOCK RULE (important): packing / empty-bags arrays on the MachineLog store what
// has ALREADY been applied to stock. Every save applies only the DIFFERENCE between
// the new values and the stored ones, so editing 50 -> 60 adds 10, never 110.
//
//   packing  +d  ->  packed-rice stock (Inventory)  +d   and  empty bags  -d
//   received +e  ->  empty bags                      +e
const mongoose = require('mongoose');
const MachineLog = require('../models/MachineLog');
const SievingLog = require('../models/SievingLog');
const Inventory = require('../models/Inventory');
const PackType = require('../models/PackType');
const EmptyBagStock = require('../models/EmptyBagStock');
const StockMovement = require('../models/StockMovement');
const User = require('../models/User');
const { sendWhatsApp, notifyLowStock } = require('./whatsapp.service');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BATCH_RE = /^GR\d{4}(-\d+)?$/;
const EPS = 0.001;

const bad = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

// ── Small helpers ───────────────────────────────────────────────────────────

function parseDate(dateStr) {
  if (!DATE_RE.test(String(dateStr || ''))) throw bad('date must be YYYY-MM-DD');
  const canonical = new Date(`${dateStr}T00:00:00.000Z`);
  const dayStart = new Date(`${dateStr}T00:00:00+05:30`);
  // V8 happily rolls 2026-02-31 over to March, so check the date survives a round trip
  if (isNaN(canonical) || isNaN(dayStart) || canonical.toISOString().slice(0, 10) !== dateStr) {
    throw bad('Invalid date');
  }
  // Store new logs exactly the way machineLog.service.js startOfDay() does
  // (server-local midnight), so the machine start/stop page finds the same log.
  canonical.setHours(0, 0, 0, 0);
  // Matching a whole Colombo day finds a log stored either as UTC midnight or as
  // Colombo midnight, so we never create a second log for the same day.
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  return { canonical, dayStart, dayEnd, mmdd: dateStr.slice(5, 7) + dateStr.slice(8, 10) };
}

const toNum = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

function nonNeg(v, label) {
  const n = toNum(v);
  if (n === null) return null;
  if (!Number.isFinite(n) || n < 0) throw bad(`${label} must be a non-negative number`);
  return Math.round(n * 1000) / 1000;
}

function oid(v, label) {
  if (v === null || v === undefined || v === '') return null;
  if (!mongoose.isValidObjectId(String(v))) throw bad(`Invalid ${label}`);
  return String(v);
}

const sum = (arr, pick) => arr.reduce((s, x) => s + (pick(x) ?? 0), 0);
const r3 = (n) => Math.round(n * 1000) / 1000;
const plainLines = (arr) => (arr || []).map((l) => ({ packTypeId: String(l.packTypeId), qty: l.qty }));

// ── Sanitisers (pure) ──────────────────────────────────────────────────────

function sanitiseBatches(list, mmdd) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const batchNo = String(raw?.batchNo || '').trim().toUpperCase();
    if (!BATCH_RE.test(batchNo) || !batchNo.startsWith(`GR${mmdd}`)) {
      throw bad(`Invalid batch number "${raw?.batchNo}" for this date`);
    }
    if (seen.has(batchNo)) throw bad(`Batch ${batchNo} appears twice`);
    seen.add(batchNo);

    const input = nonNeg(raw.input, `Grind input (${batchNo})`);
    const output = nonNeg(raw.output, `Grind output (${batchNo})`);
    const operatorId = oid(raw.operatorId, 'operator');
    const partnerId = oid(raw.partnerId, 'partner');
    if (operatorId && partnerId && operatorId === partnerId) {
      throw bad(`Batch ${batchNo}: operator and partner must be different people`);
    }
    // An empty batch card (no quantities) is simply not saved.
    if (input === null && output === null) continue;
    if (input !== null && output !== null && output > input + EPS) {
      throw bad(`Batch ${batchNo}: grind output (${output} kg) cannot be more than input (${input} kg)`);
    }
    out.push({ batchNo, operatorId, partnerId, input, output });
  }
  return out;
}

function sanitiseSifting(list, batches) {
  if (!Array.isArray(list)) return [];
  const byNo = new Map(batches.map((b) => [b.batchNo, b]));
  const rows = [];
  for (const raw of list) {
    const batchNo = String(raw?.batchNo || '').trim().toUpperCase();
    const input = nonNeg(raw.input, 'Sifting input');
    const output = nonNeg(raw.output, 'Sifting output');
    const rejection = nonNeg(raw.rejection, 'Sifting rejection');
    const note = String(raw.note || '').trim().slice(0, 200);
    if (input === null && output === null && rejection === null && !note) continue; // blank row
    if (!byNo.has(batchNo)) throw bad(`Sifting row refers to batch "${batchNo || '?'}" which has no grinding quantities`);
    if ((output ?? 0) + (rejection ?? 0) > (input ?? 0) + EPS) {
      throw bad(`Sifting ${batchNo}: output + rejection cannot be more than input`);
    }
    rows.push({ batchNo, input, output, rejection, note });
  }
  // Sifted input per batch can never exceed what that batch ground out.
  for (const b of batches) {
    const ceiling = b.output ?? b.input;
    if (ceiling === null) continue;
    const sifted = sum(rows.filter((r) => r.batchNo === b.batchNo), (r) => r.input);
    if (sifted > ceiling + EPS) {
      throw bad(`Batch ${b.batchNo}: sifted input (${r3(sifted)} kg) is more than the grind output (${ceiling} kg)`);
    }
  }
  return rows;
}

function sanitiseLines(list, label, keepZero) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const packTypeId = oid(raw?.packTypeId, 'pack type');
    if (!packTypeId) throw bad(`${label}: pack type is required`);
    const n = toNum(raw.qty);
    if (n === null) continue; // blank = not entered
    if (!Number.isInteger(n) || n < 0) throw bad(`${label}: quantities must be whole numbers, 0 or more`);
    if (seen.has(packTypeId)) throw bad(`${label}: a pack type appears twice`);
    seen.add(packTypeId);
    if (n === 0 && !keepZero) continue;
    out.push({ packTypeId, qty: n });
  }
  return out;
}

// [packTypeId, delta] for every pack type whose quantity changed.
function diffLines(oldLines, newLines) {
  const o = new Map();
  const n = new Map();
  for (const l of oldLines || []) o.set(String(l.packTypeId), (o.get(String(l.packTypeId)) || 0) + l.qty);
  for (const l of newLines || []) n.set(String(l.packTypeId), (n.get(String(l.packTypeId)) || 0) + l.qty);
  const out = [];
  for (const k of new Set([...o.keys(), ...n.keys()])) {
    const d = (n.get(k) || 0) - (o.get(k) || 0);
    if (d !== 0) out.push([k, d]);
  }
  return out;
}

const sortedJson = (lines) =>
  JSON.stringify([...(lines || [])].map((l) => [String(l.packTypeId), l.qty]).sort());

// ── Read ───────────────────────────────────────────────────────────────────

async function getStockSnapshot() {
  const types = await PackType.find({ is_active: { $ne: false } })
    .sort({ weight_kg: 1, pack_name: 1 })
    .lean();
  const ids = types.map((t) => t._id);
  const [inv, empty] = await Promise.all([
    Inventory.find({ pack_type_id: { $in: ids } }).lean(),
    EmptyBagStock.find({ pack_type_id: { $in: ids } }).lean(),
  ]);
  const invMap = new Map(inv.map((i) => [String(i.pack_type_id), i.stock_qty ?? 0]));
  const emptyMap = new Map(empty.map((e) => [String(e.pack_type_id), e]));
  return types.map((t) => {
    const id = String(t._id);
    const e = emptyMap.get(id);
    return {
      packTypeId: id,
      packName: t.pack_name,
      weightKg: t.weight_kg,
      riceStock: invMap.get(id) ?? 0,
      emptyBagStock: e?.stock_qty ?? 0,
      emptyBagThreshold: e?.threshold_qty ?? 0,
    };
  });
}

async function buildSheet(dateStr) {
  const { dayStart, dayEnd, mmdd } = parseDate(dateStr);
  const [log, packTypes] = await Promise.all([
    MachineLog.findOne({ date: { $gte: dayStart, $lt: dayEnd } }).lean(),
    getStockSnapshot(),
  ]);

  const blank = {
    date: dateStr, exists: false, machineLogId: null, rawRiceReceived: null,
    defaultOperatorId: null, defaultPartnerId: null,
    batches: [], sifting: [], packing: [], emptyBagsReceived: [], endOfDayStock: [],
    endStockSavedAt: null, endStockSentAt: null, packTypes,
  };
  if (!log) return blank;

  let batches = (log.grindBatches || []).map((b) => ({
    batchNo: b.batchNo,
    operatorId: b.operator ? String(b.operator) : null,
    partnerId: b.partner ? String(b.partner) : null,
    input: b.input ?? null,
    output: b.output ?? null,
  }));

  // Day entered with the OLD stock-entry page: show its totals as one batch.
  if (!batches.length && (log.input != null || log.output != null)) {
    batches = [{
      batchNo: `GR${mmdd}`,
      operatorId: log.operator ? String(log.operator) : null,
      partnerId: log.partner ? String(log.partner) : null,
      input: log.input ?? null,
      output: log.output ?? null,
    }];
  }

  const sieving = await SievingLog.find({ machineLogId: log._id, batchNo: BATCH_RE }).lean();
  const sifting = [];
  for (const s of sieving.sort((a, b) => a.batchNo.localeCompare(b.batchNo))) {
    for (const p of [...(s.parts || [])].sort((a, b) => a.partNo - b.partNo)) {
      sifting.push({
        batchNo: s.batchNo, input: p.input ?? null, output: p.output ?? null,
        rejection: p.rejection ?? null, note: p.note || '',
      });
    }
  }

  return {
    ...blank,
    exists: true,
    machineLogId: String(log._id),
    rawRiceReceived: log.rawRiceReceived ?? null,
    defaultOperatorId: log.operator ? String(log.operator) : null,
    defaultPartnerId: log.partner ? String(log.partner) : null,
    batches,
    sifting,
    packing: plainLines(log.packing),
    emptyBagsReceived: plainLines(log.emptyBagsReceived),
    endOfDayStock: plainLines(log.endOfDayStock),
    endStockSavedAt: log.endStockSavedAt ?? null,
    endStockSentAt: log.endStockSentAt ?? null,
  };
}

const getSheet = (dateStr) => buildSheet(dateStr);

// ── Write ──────────────────────────────────────────────────────────────────

async function rollback(applied) {
  for (const a of [...applied].reverse()) {
    try {
      const Model = a.stock === 'RICE' ? Inventory : EmptyBagStock;
      await Model.updateOne({ pack_type_id: a.packTypeId }, { $inc: { stock_qty: -a.delta } });
    } catch (e) {
      console.error('[DailySheet] ROLLBACK FAILED for', a, e.message);
    }
  }
}

async function syncSifting(log, batches, sifting, fallbackOperatorId) {
  const existing = await SievingLog.find({ machineLogId: log._id, batchNo: BATCH_RE });
  const byNo = new Map(existing.map((s) => [s.batchNo, s]));
  const liveNos = new Set(batches.map((b) => b.batchNo));

  for (const b of batches) {
    const rows = sifting.filter((r) => r.batchNo === b.batchNo);
    const doc = byNo.get(b.batchNo);
    if (!rows.length) {
      if (doc) await SievingLog.deleteOne({ _id: doc._id });
      continue;
    }
    const parts = rows.map((r, i) => ({
      partNo: i + 1, input: r.input, output: r.output, rejection: r.rejection, note: r.note,
    }));
    const operator = b.operatorId || fallbackOperatorId;
    if (doc) {
      doc.parts = parts;
      doc.operator = operator;
      doc.isCompleted = true;
      doc.completedAt = doc.completedAt || new Date();
      doc.completionNotified = true;
      await doc.save();
    } else {
      await SievingLog.create({
        machineLogId: log._id, batchNo: b.batchNo, operator, date: log.date, parts,
        // The sheet is the record; these are final entries, and the end-of-day
        // WhatsApp summary replaces the per-batch "sifting complete" message.
        isCompleted: true, completedAt: new Date(), completionNotified: true,
      });
    }
  }
  for (const s of existing) {
    if (!liveNos.has(s.batchNo)) await SievingLog.deleteOne({ _id: s._id });
  }
}

async function saveSheet(dateStr, body, user) {
  const { canonical, dayStart, dayEnd, mmdd } = parseDate(dateStr);
  body = body || {};

  // 1. Validate everything before touching the database
  const rawRiceReceived = nonNeg(body.rawRiceReceived, 'Raw rice received');
  const batches = sanitiseBatches(body.batches, mmdd);
  const sifting = sanitiseSifting(body.sifting, batches);
  const packing = sanitiseLines(body.packing, 'Packing', false);
  const received = sanitiseLines(body.emptyBagsReceived, 'Empty bags received', false);
  const endStock = sanitiseLines(body.endOfDayStock, 'End-of-day stock', true);

  const ids = [...new Set([...packing, ...received, ...endStock].map((l) => l.packTypeId))];
  const typeDocs = ids.length ? await PackType.find({ _id: { $in: ids } }).lean() : [];
  if (typeDocs.length !== ids.length) throw bad('Unknown pack type in request');
  const nameOf = Object.fromEntries(typeDocs.map((t) => [String(t._id), t.pack_name]));

  let log = await MachineLog.findOne({ date: { $gte: dayStart, $lt: dayEnd } });
  if (!log) log = new MachineLog({ date: canonical });

  const fallbackOperatorId =
    batches.find((b) => b.operatorId)?.operatorId || (log.operator ? String(log.operator) : null) ||
    (user?._id ? String(user._id) : null);
  if (sifting.length && !fallbackOperatorId) throw bad('Select a grinding operator before recording sifting');

  // 2. Work out the stock difference
  const prevPacking = plainLines(log.packing);
  const prevReceived = plainLines(log.emptyBagsReceived);
  const prevEnd = plainLines(log.endOfDayStock);
  const packDiff = diffLines(prevPacking, packing);
  const recvDiff = diffLines(prevReceived, received);

  const riceOps = new Map(packDiff);
  const emptyOps = new Map();
  for (const [id, d] of recvDiff) emptyOps.set(id, (emptyOps.get(id) || 0) + d);
  for (const [id, d] of packDiff) emptyOps.set(id, (emptyOps.get(id) || 0) - d);
  for (const [id, d] of [...emptyOps]) if (d === 0) emptyOps.delete(id);

  // Cannot take back packing that has already been sold
  for (const [id, d] of packDiff) {
    if (d >= 0) continue;
    const inv = await Inventory.findOne({ pack_type_id: id }).lean();
    const cur = inv?.stock_qty ?? 0;
    if (cur + d < 0) {
      const name = nameOf[id] || (await PackType.findById(id).lean())?.pack_name || 'this pack';
      throw bad(`Cannot reduce packed ${name} by ${-d}: only ${cur} in stock (the rest may already be sold)`, 409);
    }
  }

  // 3. Apply stock changes, then save the log. Roll the stock back if the save fails.
  const applied = [];
  const emptyResults = [];
  const now = new Date();
  try {
    for (const [id, d] of riceOps) {
      await Inventory.findOneAndUpdate(
        { pack_type_id: id },
        { $inc: { stock_qty: d }, $set: { last_updated_at: now } },
        { upsert: true, setDefaultsOnInsert: true }
      );
      applied.push({ stock: 'RICE', packTypeId: id, delta: d });
    }
    for (const [id, d] of emptyOps) {
      const doc = await EmptyBagStock.findOneAndUpdate(
        { pack_type_id: id },
        { $inc: { stock_qty: d }, $set: { last_updated_at: now } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      applied.push({ stock: 'EMPTY_BAG', packTypeId: id, delta: d });
      emptyResults.push({ id, delta: d, doc });
    }

    log.rawRiceReceived = rawRiceReceived;
    log.grindBatches = batches.map((b) => ({
      batchNo: b.batchNo, operator: b.operatorId, partner: b.partnerId, input: b.input, output: b.output,
    }));
    log.packing = packing;
    log.emptyBagsReceived = received;
    log.endOfDayStock = endStock;

    // keep legacy day totals in sync for the Material Store / dashboards / old sifting page
    log.input = batches.some((b) => b.input !== null) ? r3(sum(batches, (b) => b.input)) : null;
    log.output = batches.some((b) => b.output !== null) ? r3(sum(batches, (b) => b.output)) : null;
    if (log.grindBatches.length || sifting.length) {
      log.rejection = sifting.length ? r3(sum(sifting, (r) => r.rejection)) : null;
    }
    log.hasStockEntry = rawRiceReceived !== null || batches.length > 0;
    if (!log.operator && batches[0]?.operatorId) log.operator = batches[0].operatorId;
    if (!log.partner && batches[0]?.partnerId) log.partner = batches[0].partnerId;
    if (!log.batchNo || BATCH_RE.test(log.batchNo)) log.batchNo = batches[0]?.batchNo ?? null;

    if (endStock.length) {
      if (sortedJson(prevEnd) !== sortedJson(endStock) || !log.endStockSavedAt) log.endStockSavedAt = now;
    } else {
      log.endStockSavedAt = null;
    }

    await log.save();
  } catch (err) {
    await rollback(applied);
    throw err;
  }

  // 4. Sifting (replace-style, safe to retry)
  await syncSifting(log, batches, sifting, fallbackOperatorId);

  // 5. Audit ledger + warnings + low-stock alerts (never block the save)
  const movements = [];
  const mk = (stock, id, delta, reason) =>
    delta !== 0 && movements.push({
      date: canonical, machineLogId: log._id, packTypeId: id, stock, delta, reason, userId: user?._id ?? null,
    });
  for (const [id, d] of packDiff) { mk('RICE', id, d, 'PACKING'); mk('EMPTY_BAG', id, -d, 'PACKING_BAGS_USED'); }
  for (const [id, d] of recvDiff) mk('EMPTY_BAG', id, d, 'EMPTY_BAGS_RECEIVED');
  if (movements.length) StockMovement.insertMany(movements).catch((e) => console.error('[DailySheet] ledger:', e.message));

  const warnings = [];
  for (const { id, delta, doc } of emptyResults) {
    const name = nameOf[id] || (await PackType.findById(id).lean())?.pack_name || 'Pack';
    if (doc.stock_qty < 0) {
      warnings.push(`${name}: empty bag stock is ${doc.stock_qty}. More bags were used than recorded - check "Empty bags received" or set the opening count in Bag Stock.`);
    } else if (delta < 0 && doc.threshold_qty > 0 && doc.stock_qty <= doc.threshold_qty) {
      Promise.resolve(notifyLowStock({
        itemName: `${name} (empty bags)`, category: 'Empty Bag Stock',
        currentQty: doc.stock_qty, unit: 'bags', thresholdQty: doc.threshold_qty,
      })).catch((e) => console.error('[DailySheet] low-stock WA:', e.message));
    }
  }

  const sheet = await buildSheet(dateStr);
  sheet.warnings = warnings;
  return sheet;
}

// ── End-of-day WhatsApp summary ─────────────────────────────────────────────

const fmt = (n) => Number(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const pct = (o, i) => (i > 0 ? `${((o / i) * 100).toFixed(1)}%` : '-');

function buildSummaryMessage(sheet, userNames = {}) {
  const typeName = Object.fromEntries(sheet.packTypes.map((p) => [p.packTypeId, p.packName]));
  const stockOf = Object.fromEntries(sheet.packTypes.map((p) => [p.packTypeId, p.riceStock]));
  const nm = (id) => (id ? userNames[id] || '?' : '-');
  const when = new Date(`${sheet.date}T12:00:00+05:30`).toLocaleDateString('en-LK', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Colombo',
  });

  const L = [];
  L.push('📋 *Daily Production Summary*', `📅 ${when}`);
  if (sheet.rawRiceReceived != null) L.push(`🌾 Raw rice received: ${fmt(sheet.rawRiceReceived)} kg`);

  if (sheet.batches.length) {
    L.push('', '⚙️ *Grinding*');
    for (const b of sheet.batches) {
      L.push(`• ${b.batchNo} (${nm(b.operatorId)} / ${nm(b.partnerId)}): in ${fmt(b.input)} → out ${fmt(b.output)} kg (${pct(b.output ?? 0, b.input ?? 0)})`);
    }
  }
  if (sheet.sifting.length) {
    L.push('', '🔬 *Sifting*');
    for (const b of sheet.batches) {
      const rows = sheet.sifting.filter((r) => r.batchNo === b.batchNo);
      if (!rows.length) continue;
      const i = sum(rows, (r) => r.input), o = sum(rows, (r) => r.output), j = sum(rows, (r) => r.rejection);
      L.push(`• ${b.batchNo}: in ${fmt(i)} → out ${fmt(o)}, rejection ${fmt(j)} kg (${pct(o, i)})`);
    }
  }
  const lines = (arr) => arr.map((l) => `${typeName[l.packTypeId] || 'Pack'}: ${fmt(l.qty)}`).join(', ');
  if (sheet.packing.length) L.push('', `📦 *Packed:* ${lines(sheet.packing)}`);
  if (sheet.emptyBagsReceived.length) L.push(`🛍️ *Empty bags received:* ${lines(sheet.emptyBagsReceived)}`);

  L.push('', '📊 *Stock at end of day (counted)*');
  let diffs = 0;
  for (const l of sheet.endOfDayStock) {
    const sys = stockOf[l.packTypeId] ?? 0;
    const d = l.qty - sys;
    if (d === 0) L.push(`• ${typeName[l.packTypeId] || 'Pack'}: ${fmt(l.qty)} ✅`);
    else { diffs++; L.push(`• ${typeName[l.packTypeId] || 'Pack'}: ${fmt(l.qty)} ⚠️ system ${fmt(sys)} (${d > 0 ? '+' : ''}${fmt(d)})`); }
  }
  L.push(diffs ? `⚠️ ${diffs} difference(s) vs system stock` : '✅ Count matches system stock');
  return L.join('\n');
}

async function sendSummary(dateStr) {
  const { dayStart, dayEnd } = parseDate(dateStr);
  const sheet = await buildSheet(dateStr);
  if (!sheet.exists) throw bad('Nothing is saved for this date yet', 404);
  if (!sheet.endOfDayStock.length) throw bad('Save the end-of-day stock count first');

  const userIds = [...new Set(sheet.batches.flatMap((b) => [b.operatorId, b.partnerId]).filter(Boolean))];
  const users = userIds.length ? await User.find({ _id: { $in: userIds } }).select('full_name username').lean() : [];
  const names = Object.fromEntries(users.map((u) => [String(u._id), u.full_name || u.username]));

  const result = await sendWhatsApp(buildSummaryMessage(sheet, names), { template: true });
  // whatsapp-web.js version returns undefined (message is queued); Cloud API returns { success }.
  if (result && result.success === false) throw bad('WhatsApp message could not be sent', 502);

  const sentAt = new Date();
  await MachineLog.updateOne({ date: { $gte: dayStart, $lt: dayEnd } }, { $set: { endStockSentAt: sentAt } });
  return { endStockSentAt: sentAt };
}

// ── Empty bag stock (opening balance / corrections / threshold) ────────────

async function listEmptyBags() {
  const snap = await getStockSnapshot();
  return snap.map((p) => ({
    packTypeId: p.packTypeId, packName: p.packName, weightKg: p.weightKg,
    emptyBagQty: p.emptyBagStock, emptyBagThreshold: p.emptyBagThreshold,
  }));
}

async function setEmptyBags(packTypeId, body, user) {
  if (!mongoose.isValidObjectId(String(packTypeId))) throw bad('Invalid pack type');
  const pack = await PackType.findById(packTypeId).lean();
  if (!pack) throw bad('Pack type not found', 404);

  const set = {};
  let newQty = null;
  if (body.set_qty !== undefined) {
    newQty = toNum(body.set_qty);
    if (newQty === null || !Number.isInteger(newQty) || newQty < 0) throw bad('Empty bag count must be a whole number, 0 or more');
    set.stock_qty = newQty;
  }
  if (body.threshold_qty !== undefined) {
    const t = toNum(body.threshold_qty);
    if (t === null || !Number.isInteger(t) || t < 0) throw bad('Threshold must be a whole number, 0 or more');
    set.threshold_qty = t;
  }
  if (!Object.keys(set).length) throw bad('Nothing to update');

  const prev = await EmptyBagStock.findOne({ pack_type_id: packTypeId }).lean();
  const doc = await EmptyBagStock.findOneAndUpdate(
    { pack_type_id: packTypeId },
    { $set: { ...set, last_updated_at: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (newQty !== null) {
    const delta = newQty - (prev?.stock_qty ?? 0);
    if (delta !== 0) {
      StockMovement.create({
        date: new Date(), packTypeId, stock: 'EMPTY_BAG', delta, reason: 'ADJUSTMENT', userId: user?._id ?? null,
      }).catch((e) => console.error('[DailySheet] ledger:', e.message));
    }
  }
  return { packTypeId: String(packTypeId), emptyBagQty: doc.stock_qty, emptyBagThreshold: doc.threshold_qty };
}

module.exports = {
  getSheet, saveSheet, sendSummary, listEmptyBags, setEmptyBags,
  // exported for tests
  _internal: { sanitiseBatches, sanitiseSifting, sanitiseLines, diffLines, buildSummaryMessage, parseDate },
};