// machineLog.service.js
const MachineLog = require('../models/MachineLog');
const User = require('../models/User');
const { notifyMachineStart, notifyMachineStop } = require('./whatsapp.service');

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
  const partnerName  = log.partner?.[NAME_FIELD]  || 'Unknown';

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
      date:          log.date,
      operator:      operatorName,
      partner:       partnerName,
      sessionNumber,
      startTime:     session.startTime,
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
  const partnerName  = log.partner?.[NAME_FIELD]  || 'Unknown';

  try {
    // await notifyMachineStop({
    //   date:          log.date,
    //   operator:      operatorName,
    //   partner:       partnerName,
    //   sessionNumber,
    //   stopTime:      session.stopTime,
    // });
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
  return MachineLog.findByIdAndUpdate(
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
}

async function getAllLogs({ page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const [logs, total] = await Promise.all([
    MachineLog.find()
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .populate('operator', NAME_FIELD)
      .populate('partner', NAME_FIELD),
    MachineLog.countDocuments(),
  ]);
  return { logs, total, page, limit };
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