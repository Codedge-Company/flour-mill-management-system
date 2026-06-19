const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');

const TO = process.env.NOTIFY_WHATSAPP_TO || '94779337369';

let client = null;
let qrData = { qrImage: null, ready: false };
let starting = false;
let reconnectTimer = null;

// ── NEW: queue for messages sent while client isn't ready ──────────────────
const pendingMessages = [];
const MAX_QUEUE_SIZE = 50;

// ── Puppeteer args ── (removed --single-process / --no-zygote: these are
// known to cause random Chromium crashes with whatsapp-web.js)
const PUPPETEER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--no-first-run',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-default-apps',
  '--mute-audio',
  '--disable-sync',
];

function getChromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.platform === 'win32') {
    const windowsPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    for (const p of windowsPaths) {
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

function initWhatsApp() {
  if (client || starting) return;
  starting = true;

  console.log('[WhatsApp] Initialising client...');

  const executablePath = getChromePath();

  client = new Client({
    authStrategy: new LocalAuth({ clientId: 'flour-mill' }),
    puppeteer: {
      headless: 'new',
      args: PUPPETEER_ARGS,
      ...(executablePath ? { executablePath } : {}),
    },
  });

  client.on('qr', async (qr) => {
    console.log('[WhatsApp] QR received');
    qrcode.generate(qr, { small: true });
    try {
      qrData = { qrImage: await QRCode.toDataURL(qr), ready: false };
    } catch (e) {
      console.error('[WhatsApp] QR error:', e.message);
    }
  });

  client.on('ready', () => {
    console.log('[WhatsApp] Client ready');
    qrData = { qrImage: null, ready: true };
    starting = false;
    flushQueue();
  });

  client.on('auth_failure', (msg) => {
    console.error('[WhatsApp] Auth failure:', msg);
    teardownClient();
  });

  client.on('disconnected', (reason) => {
    console.warn('[WhatsApp] Disconnected:', reason);
    teardownClient();
    scheduleReconnect();
  });

  client.initialize().catch((err) => {
    console.error('[WhatsApp] Initialize failed:', err.message);
    teardownClient();
    scheduleReconnect();
  });
}

function teardownClient() {
  if (client) {
    // best-effort cleanup of the old puppeteer/browser session
    client.destroy().catch(() => {});
  }
  client = null;
  starting = false;
  qrData = { qrImage: null, ready: false };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    console.log('[WhatsApp] Attempting reconnect...');
    initWhatsApp();
  }, 10_000); // wait 10s before retrying — avoids rapid crash-loop
}

function getWhatsAppQr() {
  initWhatsApp();
  return qrData;
}

// ── Queue handling ──────────────────────────────────────────────────────
function flushQueue() {
  if (!pendingMessages.length) return;
  console.log(`[WhatsApp] Flushing ${pendingMessages.length} queued message(s)`);
  const toSend = pendingMessages.splice(0, pendingMessages.length);
  toSend.forEach((msg) => sendWhatsApp(msg));
}

async function sendWhatsApp(message) {
  if (!client || !qrData.ready) {
    console.warn('[WhatsApp] Client not ready — queuing message.');
    if (pendingMessages.length < MAX_QUEUE_SIZE) {
      pendingMessages.push(message);
    } else {
      console.warn('[WhatsApp] Queue full — dropping oldest message.');
      pendingMessages.shift();
      pendingMessages.push(message);
    }
    // make sure a connection attempt is in flight
    initWhatsApp();
    return;
  }

  try {
    await client.sendMessage(`${TO}@c.us`, message);
    console.log('[WhatsApp] Sent to', TO);
  } catch (err) {
    console.error('[WhatsApp] Send failed:', err.message);
    teardownClient();
    scheduleReconnect();
    // requeue so it's not lost
    if (pendingMessages.length < MAX_QUEUE_SIZE) pendingMessages.push(message);
  }
}

// ── FORMAT HELPERS (unchanged) ──────────────────────────────────────────
function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-LK', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Colombo',
  });
}
function formatDate(date) {
  return new Date(date).toLocaleDateString('en-LK', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Colombo',
  });
}

// ── NOTIFICATIONS (unchanged messages) ──────────────────────────────────
async function notifyMachineStart({ date, operator, partner, sessionNumber, startTime }) {
  const sessionLabel = sessionNumber === 1 ? '1st' : sessionNumber === 2 ? '2nd' : '3rd';
  return sendWhatsApp(
    `🟢 *Machine Started* — ${sessionLabel} Session\n` +
    `📅 Date: ${formatDate(date)}\n` +
    `👷 Operator: ${operator}\n` +
    `🤝 Partner: ${partner}\n` +
    `🕐 Start Time: ${formatTime(startTime)}`
  );
}

async function notifyMachineStop({ date, operator, partner, sessionNumber, stopTime }) {
  const sessionLabel = sessionNumber === 1 ? '1st' : sessionNumber === 2 ? '2nd' : '3rd';
  return sendWhatsApp(
    `🔴 *Machine Stopped* — ${sessionLabel} Session\n` +
    `📅 Date: ${formatDate(date)}\n` +
    `👷 Operator: ${operator}\n` +
    `🤝 Partner: ${partner}\n` +
    `🕐 Stop Time: ${formatTime(stopTime)}`
  );
}

async function notifyPackingDone({ packName, weightKg, qty, operatorName, time }) {
  return sendWhatsApp(
    `📦 *Packing Complete*\n` +
    `🏷️ Pack: ${packName} (${weightKg} KG)\n` +
    `🔢 Quantity: ${qty} units\n` +
    `👷 Operator: ${operatorName}\n` +
    `🕐 Time: ${formatTime(time)}\n` +
    `📅 Date: ${formatDate(time)}`
  );
}

async function notifyStockEntry({ date, operator, partner, rawRiceReceived, input, output, rejection, rejectionDate }) {
  const efficiency = input > 0 ? ((output / input) * 100).toFixed(1) : '0.0';
  const rejRate = input > 0 ? ((rejection / input) * 100).toFixed(1) : '0.0';

  let msg =
    `📊 *Stock Entry Recorded*\n` +
    `📅 Date: ${formatDate(date)}\n` +
    `👷 Operator: ${operator}\n` +
    `🤝 Partner: ${partner}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🌾 Raw Rice Received: ${rawRiceReceived ?? 0} kg\n` +
    `📥 Input: ${input ?? 0} kg\n` +
    `📤 Output: ${output ?? 0} kg\n` +
    `🗑️ Rejection: ${rejection ?? 0} kg\n`;

  if (rejectionDate) {
    msg += `📆 Rejection Date: ${formatDate(rejectionDate)}\n`;
  }

  msg +=
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `⚙️ Efficiency: ${efficiency}%\n` +
    `❌ Rejection Rate: ${rejRate}%`;

  return sendWhatsApp(msg);
}

async function notifySiftingComplete({
  batchNo, date, operator, parts, input, output, rejection, efficiency, completedAt
}) {
  const dateStr = new Date(date).toLocaleDateString('en-LK', { timeZone: 'Asia/Colombo' });
  const completedStr = formatTime(completedAt);

  const message = [
    `✅ *Sifting Completed*`,
    `📦 Batch: *${batchNo}*`,
    `📅 Date: ${dateStr}`,
    `👤 Operator: ${operator}`,
    `🔢 Parts: ${parts}`,
    ``,
    `📥 Input:      ${input} kg`,
    `📤 Output:     ${output} kg`,
    `🗑️  Rejection:  ${rejection} kg`,
    `📊 Efficiency: ${efficiency}%`,
    ``,
    `🕐 Completed at ${completedStr}`,
  ].join('\n');

  return sendWhatsApp(message);
}

module.exports = {
  notifyMachineStart,
  notifyMachineStop,
  getWhatsAppQr,
  notifyPackingDone,
  sendWhatsApp,
  notifyStockEntry,
  notifySiftingComplete,
};