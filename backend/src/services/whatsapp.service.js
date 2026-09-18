const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');

// ── Windows fix: LocalAuth.logout() is called internally by whatsapp-web.js
// whenever the client disconnects - completely separate from our own
// teardownClient(). On Windows, Chromium sometimes hasn't released the
// session lockfile yet, causing an EBUSY error. That internal call has no
// .catch() anywhere reachable from our code, so the rejection is unhandled
// and crashes the whole Node process. This patch makes logout() swallow
// cleanup errors instead of throwing - the session files get cleaned up
// on a best-effort basis, and a failed cleanup here is harmless (worst
// case, a stale file lingers until the next successful logout).
const originalLogout = LocalAuth.prototype.logout;
LocalAuth.prototype.logout = async function (...args) {
  try {
    return await originalLogout.apply(this, args);
  } catch (err) {
    console.warn('[WhatsApp] LocalAuth cleanup failed (ignored, non-fatal):', err.message);
  }
};

const TO = process.env.NOTIFY_WHATSAPP_TO || '94779337369';

let client = null;
let qrData = { qrImage: null, ready: false };
let starting = false;
let reconnectTimer = null;

// ── Queue for messages sent while client isn't ready ────────────────────────
const pendingMessages = [];
const MAX_QUEUE_SIZE = 50;

// ── Puppeteer args ──
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
    webVersionCache: { type: 'none' },
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
  }, 10_000);
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
    if (pendingMessages.length < MAX_QUEUE_SIZE) pendingMessages.push(message);
  }
}

// ── Send a plain text message to an ARBITRARY WhatsApp number ─────────────
// Distinct from sendWhatsApp(), which always targets the fixed internal
// NOTIFY_WHATSAPP_TO number - this one is for messaging a customer
// directly (e.g. an invoice download link), so it takes the destination
// number as a parameter. No queueing here since these are one-off,
// time-sensitive sends tied to a specific sale/payment - if the client
// isn't ready, the caller's own .catch() logs it and the sale/payment
// itself is unaffected either way.
async function sendWhatsAppTextTo(toNumber, message) {
  if (!toNumber) {
    console.warn('[WhatsApp] No destination number - skipping text send.');
    return;
  }
  if (!client || !qrData.ready) {
    console.warn(`[WhatsApp] Client not ready - cannot send text to ${toNumber} right now.`);
    return;
  }
  try {
    await client.sendMessage(`${toNumber}@c.us`, message);
    console.log('[WhatsApp] Text sent to', toNumber);
  } catch (err) {
    console.error(`[WhatsApp] Text send to ${toNumber} failed:`, err.message);
  }
}

// ── FORMAT HELPERS ──────────────────────────────────────────
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

// ── NOTIFICATIONS (unchanged) ──────────────────────────────────
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

// ── NEW: generic low-stock alert — used by Bag Stock (Inventory) and
// Spare Parts. Same emoji/format style as the other stock messages. ────────
async function notifyLowStock({ itemName, category, currentQty, unit, thresholdQty }) {
  return sendWhatsApp(
    `⚠️ *Low Stock Alert*\n` +
    `📦 Item: ${itemName}\n` +
    `🏷️ Category: ${category}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📉 Current Stock: ${currentQty} ${unit}\n` +
    `🚦 Threshold: ${thresholdQty} ${unit}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🔔 Please restock soon.`
  );
}

// ── WhatsApp notification on payment recorded ───────────────────────────────
const notifyPaymentRecorded = async (payment, sale, balanceDue) => {
  const message =
    `💵 *Payment Received*\n` +
    `📋 Sale No: ${sale.sale_no}\n` +
    `👤 Customer: ${sale.customer_id?.name || 'N/A'}\n` +
    `🧾 Payment No: ${payment.payment_no}\n` +
    `💰 Amount Paid: LKR ${Number(payment.amount).toFixed(2)}\n` +
    `📉 Balance Remaining: LKR ${Number(balanceDue).toFixed(2)}\n` +
    `🕐 ${new Date(payment.payment_date).toLocaleString('en-LK')}`;

  return sendWhatsApp(message);
};

// ── Send a document (PDF) to an ARBITRARY WhatsApp number ──────────────────
// Kept for reference / future retry once whatsapp-web.js fixes the @lid
// MessageMedia bug - currently unused by the sales flow, which sends a
// download link via sendWhatsAppTextTo() instead.
async function sendWhatsAppDocument(toNumber, pdfBuffer, filename, caption = '') {
  if (!toNumber) {
    console.warn('[WhatsApp] No destination number - skipping document send.');
    return;
  }
  if (!client || !qrData.ready) {
    console.warn(`[WhatsApp] Client not ready - cannot send document to ${toNumber} right now.`);
    initWhatsApp();
    return;
  }

  const chatId = `${toNumber}@c.us`;

  try {
    const base64 = pdfBuffer.toString('base64');
    const media = new MessageMedia('application/pdf', base64, filename);

    await client.sendMessage(chatId, media);
    if (caption) {
      await client.sendMessage(chatId, caption);
    }

    console.log(`[WhatsApp] Document "${filename}" sent to`, toNumber);
  } catch (err) {
    console.error(`[WhatsApp] Document send to ${toNumber} failed:`, err.message);
  }
}

module.exports = {
  notifyMachineStart,
  notifyMachineStop,
  getWhatsAppQr,
  notifyPackingDone,
  sendWhatsApp,
  sendWhatsAppTextTo,
  notifyStockEntry,
  notifySiftingComplete,
  notifyLowStock,
  notifyPaymentRecorded,
  sendWhatsAppDocument
};