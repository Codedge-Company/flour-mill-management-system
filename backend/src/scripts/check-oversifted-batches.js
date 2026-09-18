// src/scripts/check-oversifted-batches.js
require('dotenv').config();
const mongoose = require('mongoose');
const SievingLog = require('../models/SievingLog');
const MachineLog = require('../models/MachineLog');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const sievingLogs = await SievingLog.find({});
  const machineLogIds = [...new Set(sievingLogs.map(l => l.machineLogId.toString()))];
  const machineLogs = await MachineLog.find({ _id: { $in: machineLogIds } });
  const machineLogById = new Map(machineLogs.map(m => [m._id.toString(), m]));

  console.log(`Checking ${sievingLogs.length} sieving log(s) against their batch's actual flour output...\n`);

  let flagged = 0;
  for (const sl of sievingLogs) {
    const ml = machineLogById.get(sl.machineLogId.toString());
    if (!ml) continue;

    const totalInput = sl.parts.reduce((s, p) => s + (p.input ?? 0), 0);
    const output = ml.output ?? 0;

    if (totalInput > output) {
      flagged++;
      console.log(`⚠️  SievingLog ${sl._id} (batch ${sl.batchNo})`);
      console.log(`    Sifted input logged: ${totalInput}kg`);
      console.log(`    Batch's actual flour output: ${output}kg`);
      console.log(`    Over by: ${(totalInput - output).toFixed(1)}kg\n`);
    }
  }

  console.log(flagged === 0
    ? '✅ No sieving logs exceed their batch\'s flour output. Nothing to fix.'
    : `⚠️  ${flagged} sieving log(s) recorded MORE sifting input than the batch actually produced in flour.`);

  await mongoose.disconnect();
})();