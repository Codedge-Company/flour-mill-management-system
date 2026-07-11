// machineLog.service.js
const MachineLog = require('../models/MachineLog');
const User = require('../models/User');
const { notifyMachineStart, notifyMachineStop, notifyStockEntry } = require('./whatsapp.service');

// ✅ Change 'username' to match your actual User model field
const NAME_FIELD = 'username';

async function getOrCreateLog(date, operatorId, partnerId) {
  const dayStart = startOfDay(date);

  let log = await MachineLog.findOne({ date: dayStart })
    .populate('operator', NAME_FIELD)
    .populate('partner', NAME_FIELD);

  if (!log) {
    if (!operatorId || !partnerId) {
      throw new Error('operatorId and partnerId are required to create a log');
    }
    log = await MachineLog.create({
      date: dayStart,
      operator: operatorId,
      partner: partnerId,
      sessions: [],
    });
    log = await log.populate(`operator partner`, NAME_FIELD);
  }

  return log;
}

async function getLogByDate(date) {
  const dayStart = startOfDay(date);
  return MachineLog.findOne({ date: dayStart })
    .populate('operator', NAME_FIELD)
    .populate('partner', NAME_FIELD);
}

async function recordStart(logId, sessionNumber) {
  const log = await MachineLog.findById(logId)
    .populate('operator', NAME_FIELD)
    .populate('partner', NAME_FIELD);

  if (!log) throw new Error('Machine log not found');

  const operatorName = log.operator?.[NAME_FIELD] || 'Unknown';
  const partnerName = log.partner?.[NAME_FIELD] || 'Unknown';

  let session = log.sessions.find(s => s.sessionNumber === sessionNumber);
  if (!session) {
    log.sessions.push({ sessionNumber, startTime: new Date() });
    session = log.sessions[log.sessions.length - 1];
  } else {
    if (session.startTime) throw new Error(`Session ${sessionNumber} already started`);
    session.startTime = new Date();
  }

  try {
    await notifyMachineStart({
      date: log.date,
      operator: operatorName,
      partner: partnerName,
      sessionNumber,
      startTime: session.startTime,
    });
    session.startNotified = true;
  } catch (err) {
    console.error('[MachineLog] WhatsApp start notification failed:', err.message);
  }

  await log.save();
  return log;
}

async function recordStop(logId, sessionNumber) {
  const log = await MachineLog.findById(logId)
    .populate('operator', NAME_FIELD)
    .populate('partner', NAME_FIELD);

  if (!log) throw new Error('Machine log not found');

  const session = log.sessions.find(s => s.sessionNumber === sessionNumber);
  if (!session || !session.startTime) throw new Error(`Session ${sessionNumber} not started yet`);
  if (session.stopTime) throw new Error(`Session ${sessionNumber} already stopped`);

  session.stopTime = new Date();

  const operatorName = log.operator?.[NAME_FIELD] || 'Unknown';
  const partnerName = log.partner?.[NAME_FIELD] || 'Unknown';

  try {
    await notifyMachineStop({
      date: log.date,
      operator: operatorName,
      partner: partnerName,
      sessionNumber,
      stopTime: session.stopTime,
    });
    session.stopNotified = true;
  } catch (err) {
    console.error('[MachineLog] WhatsApp stop notification failed:', err.message);
  }

  await log.save();
  return log;
}

async function updateOperators(logId, operatorId, partnerId) {
  return MachineLog.findByIdAndUpdate(
    logId,
    { operator: operatorId, partner: partnerId },
    { new: true }
  )
    .populate('operator', NAME_FIELD)
    .populate('partner', NAME_FIELD);
}

async function updateStockEntry(logId, { rawRiceReceived, input, output, rejection, rejectionDate }) {
  const existing = await MachineLog.findById(logId);
  if (!existing) return null;

  let batchNoUpdate = {};
  if (!existing.batchNo && rawRiceReceived > 0) {
    const { buildBatchNo } = require('./sievingLog.service');
    const draft = Object.assign(existing, { rawRiceReceived });
    batchNoUpdate.batchNo = buildBatchNo(draft);
  }

  const log = await MachineLog.findByIdAndUpdate(
    logId,
    {
      hasStockEntry: true,
      rawRiceReceived,
      input,
      output,
      rejection,
      rejectionDate: rejectionDate || null,
      ...batchNoUpdate,
    },
    { new: true }
  )
    .populate('operator', NAME_FIELD)
    .populate('partner', NAME_FIELD);

  if (log) {
    const operatorName = log.operator?.[NAME_FIELD] || 'Unknown';
    const partnerName  = log.partner?.[NAME_FIELD]  || 'Unknown';

    try {
      await notifyStockEntry({
        date: log.date,
        operator: operatorName,
        partner: partnerName,
        rawRiceReceived: rawRiceReceived ?? 0,
        input:           input           ?? 0,
        output:          output          ?? 0,
        rejection:       rejection       ?? 0,
        rejectionDate:   rejectionDate   || null,
      });
    } catch (err) {
      console.error('[MachineLog] WhatsApp stock notification failed:', err.message);
    }
  }

  return log;
}


async function getAllLogs({ page = 1, limit = 20, from = null, to = null } = {}) {
  const skip = (page - 1) * limit;

  const dateFilter = {};
  if (from || to) {
    dateFilter.date = {};
    if (from) {
      const fromDate = startOfDaySL(new Date(from));
      dateFilter.date.$gte = fromDate;
    }
    if (to) {
      const toDate = endOfDaySL(new Date(to));
      dateFilter.date.$lte = toDate;
    }
  }

  const [logs, total] = await Promise.all([
    MachineLog.find(dateFilter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .populate('operator', NAME_FIELD)
      .populate('partner', NAME_FIELD),
    MachineLog.countDocuments(dateFilter),
  ]);

  return { logs, total, page, limit };
}

async function upsertStockByDate(date, { rawRiceReceived, input, output, rejection, rejectionDate }) {
  const dayStart = startOfDay(date);

  const existing = await MachineLog.findOne({ date: dayStart });

  let batchNoUpdate = {};
  if (existing && existing.operator && existing.partner && !existing.batchNo && rawRiceReceived > 0) {
    const { buildBatchNo } = require('./sievingLog.service');
    const draft = Object.assign(existing, { rawRiceReceived });
    batchNoUpdate.batchNo = buildBatchNo(draft);
  }

  const log = await MachineLog.findOneAndUpdate(
    { date: dayStart },
    {
      $set: {
        hasStockEntry: true,
        rawRiceReceived,
        input,
        output,
        rejection,
        rejectionDate: rejectionDate || null,
        ...batchNoUpdate,
      },
      $setOnInsert: { date: dayStart, sessions: [] },
    },
    { new: true, upsert: true }
  )
    .populate('operator', NAME_FIELD)
    .populate('partner', NAME_FIELD);

  const operatorName = log.operator?.[NAME_FIELD] || 'Unassigned';
  const partnerName  = log.partner?.[NAME_FIELD]  || 'Unassigned';

  try {
    await notifyStockEntry({
      date: log.date,
      operator: operatorName,
      partner: partnerName,
      rawRiceReceived: rawRiceReceived ?? 0,
      input:           input           ?? 0,
      output:          output          ?? 0,
      rejection:       rejection       ?? 0,
      rejectionDate:   rejectionDate   || null,
    });
  } catch (err) {
    console.error('[MachineLog] WhatsApp stock notification failed:', err.message);
  }

  return log;
}

// ── NEW: Raw Rice Stock summary for the Material Store dashboard ───────────
// Running balance = every rawRiceReceived ever logged, minus every input
// ever logged. e.g. received 10,000kg total, used 1,000kg total → 9,000kg
// remaining. No opening-balance concept — it's a pure running total across
// all MachineLog documents.
async function getRawRiceStockSummary() {
  const agg = await MachineLog.aggregate([
    {
      $group: {
        _id: null,
        totalReceived: { $sum: { $ifNull: ['$rawRiceReceived', 0] } },
        totalInput: { $sum: { $ifNull: ['$input', 0] } },
      },
    },
  ]);

  const totalReceived = agg[0]?.totalReceived ?? 0;
  const totalInput = agg[0]?.totalInput ?? 0;
  const currentBalance = totalReceived - totalInput;

  const recentEntries = await MachineLog.find({
    $or: [{ rawRiceReceived: { $gt: 0 } }, { input: { $gt: 0 } }],
  })
    .sort({ date: -1 })
    .limit(30)
    .select('date rawRiceReceived input')
    .lean();

  return { totalReceived, totalInput, currentBalance, recentEntries };
}

// Sri Lanka is UTC+5:30. Dates are stored as midnight SL time = 18:30 UTC previous day.
function startOfDaySL(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setTime(d.getTime() - (5 * 60 + 30) * 60 * 1000);
  return d;
}

function endOfDaySL(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setTime(d.getTime() - (5 * 60 + 30) * 60 * 1000);
  d.setTime(d.getTime() + 24 * 60 * 60 * 1000 - 1);
  return d;
}
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

module.exports = {
  getOrCreateLog,
  getLogByDate,
  recordStart,
  recordStop,
  upsertStockByDate,
  updateOperators,
  updateStockEntry,
  getAllLogs,
  getRawRiceStockSummary,
};
