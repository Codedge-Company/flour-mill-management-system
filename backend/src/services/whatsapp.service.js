const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode  = require('qrcode');

const TO = process.env.NOTIFY_WHATSAPP_TO || '94779337369';

// ── State ──────────────────────────────────────────────────────────────────
let client   = null;
let qrData   = { qrImage: null, ready: false };
let starting = false;

// ── Memory-optimised Puppeteer args ───────────────────────────────────────
const PUPPETEER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',          // critical on Render / low-RAM servers
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--no-first-run',
  '--no-zygote',
  '--single-process',                 // biggest RAM saver — one process only
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-default-apps',
  '--mute-audio',
  '--disable-sync',
];

// ── Lazy init — called only when needed ───────────────────────────────────
function initWhatsApp() {
  if (client || starting) return;   // don't double-init
  starting = true;

  console.log('[WhatsApp] Initialising client...');

  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: PUPPETEER_ARGS,
      // If you set PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true in Render env,
      // point to the system Chrome:
      ...(process.env.PUPPETEER_EXECUTABLE_PATH && {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      }),
    },
  });

  client.on('qr', async (qr) => {
    console.log('[WhatsApp] QR received — scan in browser at /whatsapp/qr');
    qrcode.generate(qr, { small: true });
    try {
      qrData = { qrImage: await QRCode.toDataURL(qr), ready: false };
    } catch (e) {
      console.error('[WhatsApp] QR image gen failed:', e.message);
    }
  });

  client.on('ready', () => {
    console.log('[WhatsApp] Client is ready ✅');
    qrData = { qrImage: null, ready: true };
  });

  client.on('auth_failure', () => {
    console.error('[WhatsApp] Auth failed — delete .wwebjs_auth/ and re-scan.');
    client    = null;
    starting  = false;
    qrData    = { qrImage: null, ready: false };
  });

  client.on('disconnected', (reason) => {
    console.warn('[WhatsApp] Disconnected:', reason);
    client    = null;
    starting  = false;
    qrData    = { qrImage: null, ready: false };
  });

  client.initialize();
}

// ── Called by /whatsapp/qr route ──────────────────────────────────────────
function getWhatsAppQr() {
  initWhatsApp();   // starts Chrome only on first call to this route
  return qrData;
}

// ── Internal sender ───────────────────────────────────────────────────────
async function sendWhatsApp(message) {
  if (!client || !qrData.ready) {
    console.warn('[WhatsApp] Client not ready — message skipped.');
    return;   // fail silently so it never crashes your main app
  }
  try {
    await client.sendMessage(`${TO}@c.us`, message);
    console.log('[WhatsApp] Sent to', TO);
  } catch (err) {
    console.error('[WhatsApp] Send failed:', err.message);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-LK', {
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Colombo',
  });
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-LK', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Asia/Colombo',
  });
}

// ── Notification functions ─────────────────────────────────────────────────
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

module.exports = { notifyMachineStart, notifyMachineStop, getWhatsAppQr };