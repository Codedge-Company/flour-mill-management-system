const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
 
const TO = process.env.NOTIFY_WHATSAPP_TO || '94779337369';
 
const CHROME_PATH =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  '/opt/render/project/src/backend/chrome/linux-147.0.7727.24/chrome-linux64/chrome';
 
let latestQrText = null;
let latestQrDataUrl = null;
let whatsappReady = false;
 
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});
 
client.on('qr', async (qr) => {
  try {
    latestQrText = qr;
    latestQrDataUrl = await QRCode.toDataURL(qr);
    whatsappReady = false;
 
    console.log('[WhatsApp] QR generated');
    qrcodeTerminal.generate(qr, { small: true }); // works locally
  } catch (err) {
    console.error('[WhatsApp] Failed to generate QR image:', err.message);
  }
});
 
client.on('ready', () => {
  whatsappReady = true;
  latestQrText = null;
  latestQrDataUrl = null;
  console.log('[WhatsApp] Client is ready!');
});
 
client.on('auth_failure', () => {
  console.error('[WhatsApp] Authentication failed. Delete .wwebjs_auth/ and re-scan.');
});
 
client.initialize();
 
async function sendWhatsApp(message) {
  const chatId = `${TO}@c.us`;
  await client.sendMessage(chatId, message);
}
 
function getWhatsAppQr() {
  return {
    ready: whatsappReady,
    qrText: latestQrText,
    qrImage: latestQrDataUrl
  };
}
 
module.exports = { client, sendWhatsApp, getWhatsAppQr };