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
  const log = await MachineLog.findByIdAndUpdate(
    logId,
    {
      hasStockEntry: true,
      rawRiceReceived,
      input,
      output,
      rejection,
      rejectionDate: rejectionDate || null,
    },
    { new: true }
  )
    .populate('operator', NAME_FIELD)
    .populate('partner', NAME_FIELD);

  if (log) {
    const operatorName = log.operator?.[NAME_FIELD] || 'Unknown';
    const partnerName = log.partner?.[NAME_FIELD] || 'Unknown';

    try {
      await notifyStockEntry({
        date: log.date,
        operator: operatorName,
        partner: partnerName,
        rawRiceReceived: rawRiceReceived ?? 0,
        input: input ?? 0,
        output: output ?? 0,
        rejection: rejection ?? 0,
        rejectionDate: rejectionDate || null,
      });
    } catch (err) {
      console.error('[MachineLog] WhatsApp stock notification failed:', err.message);
    }
  }

  return log;
}


async function getAllLogs({ page = 1, limit = 20, from = null, to = null } = {}) {
  const skip = (page - 1) * limit;
 
  // Build date filter if provided
  const dateFilter = {};
  if (from || to) {
    dateFilter.date = {};
    if (from) {
      // from = "2026-03-28"  →  start of that day in SL time = 18:30 UTC previous day
      const fromDate = startOfDaySL(new Date(from));
      dateFilter.date.$gte = fromDate;
    }
    if (to) {
      // to = "2026-04-06"  →  end of that day in SL time = 18:29:59 UTC same day
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
// Sri Lanka is UTC+5:30. Dates are stored as midnight SL time = 18:30 UTC previous day.
// "2026-04-06" SL midnight  →  "2026-04-05T18:30:00.000Z"
function startOfDaySL(date) {
  // Parse the date string as SL midnight: subtract 5h30m from midnight UTC of that date
  const d = new Date(date);
  // d is already at 00:00:00 UTC of the given date string
  // SL midnight = d minus 5h30m
  d.setUTCHours(0, 0, 0, 0);
  d.setTime(d.getTime() - (5 * 60 + 30) * 60 * 1000);
  return d;
}
 
function endOfDaySL(date) {
  // End of day SL = start of next day SL minus 1ms
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setTime(d.getTime() - (5 * 60 + 30) * 60 * 1000); // SL midnight of this day
  d.setTime(d.getTime() + 24 * 60 * 60 * 1000 - 1);   // + 24h - 1ms = end of SL day
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
  updateOperators,
  updateStockEntry,
  getAllLogs,
};