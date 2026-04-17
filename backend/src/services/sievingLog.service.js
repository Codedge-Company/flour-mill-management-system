const SievingLog = require('../models/SievingLog');
const MachineLog = require('../models/MachineLog');
const { notifySiftingComplete } = require('./whatsapp.service');

const NAME_FIELD = 'username';

function buildBatchNo(machineLog) {
  const d  = new Date(machineLog.date);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const oi = (machineLog.operator?.[NAME_FIELD] || '?')[0].toUpperCase();
  const pi = (machineLog.partner?.[NAME_FIELD]  || '?')[0].toUpperCase();
  return `ST-${mm}-${dd}-${oi}${pi}`;
}

async function getAvailableBatches() {
  const machineLogs = await MachineLog.find({
    rawRiceReceived: { $gt: 0 },
    hasStockEntry: true,
  })
    .sort({ date: -1 })
    .populate('operator', NAME_FIELD)
    .populate('partner',  NAME_FIELD)
    .limit(100);

  const mlIds = machineLogs.map(l => l._id);
  const sievingLogs = await SievingLog.find({ machineLogId: { $in: mlIds } });

  const sievedMap = {};
  for (const sl of sievingLogs) {
    const key = sl.machineLogId.toString();
    if (!sievedMap[key]) sievedMap[key] = { totalInput: 0 };
    for (const p of sl.parts) {
      sievedMap[key].totalInput += p.input ?? 0;
    }
  }

  return machineLogs.map(log => {
    const batchNo = log.batchNo || buildBatchNo(log);
    if (!log.batchNo) MachineLog.findByIdAndUpdate(log._id, { batchNo }).exec();

    const milledOutput   = log.output ?? 0;
    const sieved         = sievedMap[log._id.toString()] || { totalInput: 0 };
    const remainingStock = Math.max(0, milledOutput - sieved.totalInput);

    return {
      _id:              log._id,
      batchNo,
      date:             log.date,
      rawRiceReceived:  log.rawRiceReceived,
      input:            log.input,
      output:           log.output,
      operatorName:     log.operator?.[NAME_FIELD] || 'Unknown',
      partnerName:      log.partner?.[NAME_FIELD]  || 'Unknown',
      remainingStock,
      totalSievedInput: sieved.totalInput,
    };
  });
}

// ✅ NEW — fetch the most recent incomplete sieving log (any operator, today)
async function getActiveSievingLog() {
  const todayStart = startOfDay(new Date());
  const todayEnd   = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  return SievingLog.findOne({
    isCompleted: false,
    date: { $gte: todayStart, $lte: todayEnd },
  })
    .sort({ createdAt: -1 })
    .populate('operator', NAME_FIELD);
}

async function getOrCreateSievingLog(machineLogId, operatorId, date) {
  const dayStart = startOfDay(date || new Date());

  let log = await SievingLog.findOne({ machineLogId, date: dayStart })
    .populate('operator', NAME_FIELD);

  if (!log) {
    const ml = await MachineLog.findById(machineLogId)
      .populate('operator', NAME_FIELD)
      .populate('partner',  NAME_FIELD);
    if (!ml) throw new Error('Machine log not found');

    const batchNo = ml.batchNo || buildBatchNo(ml);
    if (!ml.batchNo) await MachineLog.findByIdAndUpdate(ml._id, { batchNo });

    log = await SievingLog.create({
      machineLogId,
      batchNo,
      operator: operatorId,
      date:     dayStart,
      parts:    [],
    });
    log = await log.populate('operator', NAME_FIELD);
  }

  return log;
}

async function addPart(id, { input, output, rejection, note }) {
  const log = await SievingLog.findById(id);
  if (!log)            throw new Error('Sieving log not found');
  if (log.isCompleted) throw new Error('Cannot add parts to a completed log');

  const partNo = log.parts.length > 0
    ? Math.max(...log.parts.map(p => p.partNo)) + 1
    : 1;

  log.parts.push({ partNo, input, output, rejection, note: note || '' });
  await log.save();
  return SievingLog.findById(id).populate('operator', NAME_FIELD);
}

async function updatePart(id, partId, { input, output, rejection, note }) {
  const log = await SievingLog.findById(id);
  if (!log)            throw new Error('Sieving log not found');
  if (log.isCompleted) throw new Error('Cannot edit a completed log');

  const part = log.parts.id(partId);
  if (!part) throw new Error('Part not found');

  if (input     !== undefined) part.input     = input;
  if (output    !== undefined) part.output    = output;
  if (rejection !== undefined) part.rejection = rejection;
  if (note      !== undefined) part.note      = note;

  await log.save();
  return SievingLog.findById(id).populate('operator', NAME_FIELD);
}

async function removePart(id, partId) {
  const log = await SievingLog.findById(id);
  if (!log)            throw new Error('Sieving log not found');
  if (log.isCompleted) throw new Error('Cannot delete parts from a completed log');

  log.parts.pull(partId);
  await log.save();
  return SievingLog.findById(id).populate('operator', NAME_FIELD);
}

async function completeSievingLog(id) {
  const log = await SievingLog.findById(id).populate('operator', NAME_FIELD);
  if (!log)            throw new Error('Sieving log not found');
  if (log.isCompleted) throw new Error('Already completed');
  if (log.parts.length === 0) throw new Error('Add at least one sifting part before completing');

  log.isCompleted = true;
  log.completedAt = new Date();

  const totalInput     = log.parts.reduce((s, p) => s + (p.input     ?? 0), 0);
  const totalOutput    = log.parts.reduce((s, p) => s + (p.output    ?? 0), 0);
  const totalRejection = log.parts.reduce((s, p) => s + (p.rejection ?? 0), 0);

  // Save first so the log is marked complete even if WhatsApp fails
  await log.save();

  try {
    await notifySiftingComplete({
      batchNo:     log.batchNo,
      date:        log.date,
      operator:    log.operator?.[NAME_FIELD] || 'Unknown',
      parts:       log.parts.length,
      input:       totalInput,
      output:      totalOutput,
      rejection:   totalRejection,
      efficiency:  totalInput ? ((totalOutput / totalInput) * 100).toFixed(1) : '0.0',
      completedAt: log.completedAt,
    });
    log.completionNotified = true;
    await log.save();  // persist the notified flag
  } catch (err) {
    console.error('[SievingLog] WhatsApp notification failed:', err.message);
  }

  return log;
}

async function getSievingLogById(id) {
  return SievingLog.findById(id).populate('operator', NAME_FIELD);
}

async function getAllSievingLogs({ page = 1, limit = 20, from = null, to = null } = {}) {
  const skip = (page - 1) * limit;
  const dateFilter = {};
  if (from || to) {
    dateFilter.date = {};
    if (from) dateFilter.date.$gte = startOfDaySL(new Date(from));
    if (to)   dateFilter.date.$lte = endOfDaySL(new Date(to));
  }
  const [logs, total] = await Promise.all([
    SievingLog.find(dateFilter).sort({ date: -1 }).skip(skip).limit(limit)
      .populate('operator', NAME_FIELD),
    SievingLog.countDocuments(dateFilter),
  ]);
  return { logs, total, page, limit };
}

function startOfDay(date) {
  const d = new Date(date); d.setHours(0, 0, 0, 0); return d;
}
function startOfDaySL(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setTime(d.getTime() - (5 * 60 + 30) * 60 * 1000);
  return d;
}
function endOfDaySL(date) {
  const d = startOfDaySL(date);
  d.setTime(d.getTime() + 24 * 60 * 60 * 1000 - 1);
  return d;
}

module.exports = {
  getAvailableBatches,
  getActiveSievingLog,      
  getOrCreateSievingLog,
  getSievingLogById,
  addPart, updatePart, removePart,
  completeSievingLog,
  getAllSievingLogs,
  buildBatchNo,
};