// whatsapp.service.js
// Uses whatsapp-web.js — links YOUR WhatsApp number (free, self-hosted)
// Run once: node whatsapp.service.js  → scan QR in terminal
// Session is saved in ./.wwebjs_auth/ and reused automatically

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const TO = process.env.NOTIFY_WHATSAPP_TO || '94779337369'; // digits only, no +

const client = new Client({
  authStrategy: new LocalAuth(), // saves session locally — no re-scan needed
  puppeteer: { headless: true, args: ['--no-sandbox'] },
});

client.on('qr', (qr) => {
  console.log('[WhatsApp] Scan this QR code with your phone:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('[WhatsApp] Client is ready!');
});

client.on('auth_failure', () => {
  console.error('[WhatsApp] Authentication failed. Delete .wwebjs_auth/ and re-scan.');
});

// Initialize once when the module loads
client.initialize();

/**
 * Send a WhatsApp message using your own linked number.
 * @param {string} message
 */
async function sendWhatsApp(message) {
  try {
    const chatId = `${TO}@c.us`; // WhatsApp chat ID format
    await client.sendMessage(chatId, message);
    console.log('[WhatsApp] Sent to', TO);
  } catch (err) {
    console.error('[WhatsApp] Failed to send:', err.message);
    throw err;
  }
}

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

async function notifyMachineStart({ date, operator, partner, sessionNumber, startTime }) {
  const sessionLabel = sessionNumber === 1 ? '1st' : sessionNumber === 2 ? '2nd' : '3rd';
  const message =
    `🟢 *Machine Started* — ${sessionLabel} Session\n` +
    `📅 Date: ${formatDate(date)}\n` +
    `👷 Operator: ${operator}\n` +
    `🤝 Partner: ${partner}\n` +
    `🕐 Start Time: ${formatTime(startTime)}`;
  return sendWhatsApp(message);
}

async function notifyMachineStop({ date, operator, partner, sessionNumber, stopTime }) {
  const sessionLabel = sessionNumber === 1 ? '1st' : sessionNumber === 2 ? '2nd' : '3rd';
  const message =
    `🔴 *Machine Stopped* — ${sessionLabel} Session\n` +
    `📅 Date: ${formatDate(date)}\n` +
    `👷 Operator: ${operator}\n` +
    `🤝 Partner: ${partner}\n` +
    `🕐 Stop Time: ${formatTime(stopTime)}`;
  return sendWhatsApp(message);
}

module.exports = { notifyMachineStart, notifyMachineStop, client };