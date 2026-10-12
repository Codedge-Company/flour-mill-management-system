// whatsapp.service.js — WhatsApp Business Cloud API (Meta). No browser, no QR, no session.
//
// Required env:
//   WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
// Optional env:
//   WHATSAPP_API_VERSION (v25.0), NOTIFY_WHATSAPP_TO (internal alerts number),
//   WHATSAPP_TEMPLATE_LANG (en), WHATSAPP_TEMPLATE_TEXT (text template name),
//   WHATSAPP_TEMPLATE_DOCUMENT (document-header template name)
//
// How sending works:
//   • Free-form text / document is tried first. It is free and works whenever the
//     recipient has messaged the business number in the last 24 hours.
//   • If WhatsApp answers "outside the 24h window" (error 131047), the same message
//     is re-sent through the approved template (paid, ~LKR 3.40 for utility).
//   • Customers normally never message first, so documents to customers go via the template.

const TOKEN = () => process.env.WHATSAPP_TOKEN;
const PHONE_ID = () => process.env.WHATSAPP_PHONE_NUMBER_ID;
const API_VERSION = () => process.env.WHATSAPP_API_VERSION || 'v25.0';
const TO = () => process.env.NOTIFY_WHATSAPP_TO || '94779337369';
const TEMPLATE_LANG = () => process.env.WHATSAPP_TEMPLATE_LANG || 'en';
const TEMPLATE_TEXT = () => process.env.WHATSAPP_TEMPLATE_TEXT || '';
const TEMPLATE_DOC = () => process.env.WHATSAPP_TEMPLATE_DOCUMENT || '';

const WINDOW_CLOSED_CODES = new Set([131047, 470]);
const WINDOW_MEMO_MS = 30 * 60 * 1000;
const windowClosedUntil = new Map(); // recipient -> timestamp, skips the doomed free-form attempt

function isConfigured() {
  return !!(TOKEN() && PHONE_ID());
}

const digits = (n) => String(n || '').replace(/\D/g, '');

// ── Low-level Graph API call ────────────────────────────────────────────────
async function graph(pathSuffix, { json, form } = {}, attempt = 0) {
  if (typeof fetch !== 'function') throw new Error('WhatsApp needs Node 18+ (global fetch)');
  if (!isConfigured()) throw Object.assign(new Error('WhatsApp is not configured (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID)'), { code: 'NOT_CONFIGURED' });

  const url = `https://graph.facebook.com/${API_VERSION()}/${PHONE_ID()}/${pathSuffix}`;
  const headers = { Authorization: `Bearer ${TOKEN()}` };
  let body;
  if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  else body = form;

  let res;
  try {
    res = await fetch(url, { method: 'POST', headers, body });
  } catch (netErr) {
    if (attempt < 1) return graph(pathSuffix, { json, form }, attempt + 1);
    throw Object.assign(new Error('WhatsApp network error: ' + netErr.message), { code: 'NETWORK' });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status >= 500 && attempt < 1) return graph(pathSuffix, { json, form }, attempt + 1);
    const e = data.error || {};
    throw Object.assign(new Error(e.error_data?.details || e.message || `WhatsApp HTTP ${res.status}`), {
      code: e.code, status: res.status,
    });
  }
  return data;
}

// Template variables: no newlines/tabs, no long runs of spaces, max 1000 chars.
function flatten(text, max = 1000) {
  let t = String(text ?? '')
    .replace(/\*/g, '')
    .replace(/[ \t]*\r?\n+[ \t]*/g, ' | ')
    .replace(/ {2,}/g, ' ')
    .trim();
  if (t.length > max) t = t.slice(0, max - 1).trimEnd() + '…';
  return t;
}

// ── Senders ─────────────────────────────────────────────────────────────────
const sendTextRaw = (to, body) =>
  graph('messages', { json: { messaging_product: 'whatsapp', to, type: 'text', text: { preview_url: false, body } } });

// header: { type: 'document' | 'image', media: { id, filename? } }
const sendTemplateRaw = (to, name, bodyText, header) =>
  graph('messages', {
    json: {
      messaging_product: 'whatsapp', to, type: 'template',
      template: {
        name, language: { code: TEMPLATE_LANG() },
        components: [
          ...(header ? [{ type: 'header', parameters: [{ type: header.type, [header.type]: header.media }] }] : []),
          { type: 'body', parameters: [{ type: 'text', text: flatten(bodyText) }] },
        ],
      },
    },
  });

async function uploadMedia(buffer, filename, mime = 'application/pdf') {
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mime);
  form.append('file', new Blob([buffer], { type: mime }), filename);
  const r = await graph('media', { form });
  return r.id;
}

// Optional banner for the alert template (WHATSAPP_ALERT_IMAGE = path to a PNG/JPG).
// Only set it if `mill_alert` was created with an Image header. The upload is reused for 25 days.
let alertImageCache = { id: null, at: 0 };
async function getAlertImageHeader() {
  const configured = process.env.WHATSAPP_ALERT_IMAGE;
  if (!configured) return undefined;
  // a relative path is resolved from the backend folder, so it works wherever the app is installed
  const file = require('path').resolve(__dirname, '..', '..', configured);
  if (alertImageCache.id && Date.now() - alertImageCache.at < 25 * 24 * 3600 * 1000) {
    return { type: 'image', media: { id: alertImageCache.id } };
  }
  const fs = require('fs');
  const buf = await fs.promises.readFile(file);
  const mime = /\.jpe?g$/i.test(file) ? 'image/jpeg' : 'image/png';
  const id = await uploadMedia(buf, require('path').basename(file), mime);
  alertImageCache = { id, at: Date.now() };
  return { type: 'image', media: { id } };
}

const isWindowClosed = (to) => (windowClosedUntil.get(to) || 0) > Date.now();
const markWindowClosed = (to) => windowClosedUntil.set(to, Date.now() + WINDOW_MEMO_MS);

const ok = (extra = {}) => ({ success: true, ...extra });
const fail = (err) => ({ success: false, error: err.message, code: err.code });

// allowTemplate: only messages that must reach the recipient even outside the 24h window
// (the end-of-day summary) may fall back to the paid template. Everything else is free-form only.
async function sendSmartText(toNumber, message, allowTemplate = false) {
  const to = digits(toNumber);
  if (!to) return fail(new Error('No destination number'));
  const useTemplate = allowTemplate && !!TEMPLATE_TEXT();
  try {
    if (!isWindowClosed(to) || !useTemplate) {
      try {
        const r = await sendTextRaw(to, message);
        return ok({ id: r.messages?.[0]?.id, mode: 'text' });
      } catch (e) {
        if (!(WINDOW_CLOSED_CODES.has(e.code) && useTemplate)) throw e;
        markWindowClosed(to);
      }
    }
    const r = await sendTemplateRaw(to, TEMPLATE_TEXT(), message, await getAlertImageHeader());
    return ok({ id: r.messages?.[0]?.id, mode: 'template' });
  } catch (err) {
    console.error(`[WhatsApp] Text to ${to} failed:`, err.message);
    return fail(err);
  }
}

// Internal alert to the fixed NOTIFY_WHATSAPP_TO number. Never throws.
// Free-form only (free inside the 24h window). Pass { template: true } for the one message
// that must always arrive (end-of-day summary): it then falls back to WHATSAPP_TEMPLATE_TEXT.
async function sendWhatsApp(message, { template = false } = {}) {
  const r = await sendSmartText(TO(), message, template);
  if (r.success) console.log('[WhatsApp] Sent to', TO(), `(${r.mode})`);
  return r;
}

// Plain message to any number (customers). Never throws.
async function sendWhatsAppTextTo(toNumber, message) {
  if (!toNumber) { console.warn('[WhatsApp] No destination number - skipping text send.'); return fail(new Error('No destination number')); }
  return sendSmartText(toNumber, message);
}

// Wording around a document. Must match the body of the approved `mill_document` template
// (the template carries this text itself; here it is added for free-form document messages).
const withDocumentFrame = (text) =>
  `🌾 *Matheesha Flour Mill*\n\n${text}\n\n📄 Your document is attached.\n🙏 Thank you for your business!`;

// PDF to any number. Never throws.
async function sendWhatsAppDocument(toNumber, pdfBuffer, filename, caption = '') {
  const to = digits(toNumber);
  if (!to) { console.warn('[WhatsApp] No destination number - skipping document send.'); return fail(new Error('No destination number')); }
  try {
    const mediaId = await uploadMedia(pdfBuffer, filename);

    if (!isWindowClosed(to) || !TEMPLATE_DOC()) {
      try {
        const r = await graph('messages', {
          json: {
            messaging_product: 'whatsapp', to, type: 'document',
            document: { id: mediaId, filename, caption: withDocumentFrame(caption || filename).slice(0, 1000) },
          },
        });
        console.log(`[WhatsApp] Document "${filename}" sent to ${to} (document)`);
        return ok({ id: r.messages?.[0]?.id, mode: 'document' });
      } catch (e) {
        if (!(WINDOW_CLOSED_CODES.has(e.code) && TEMPLATE_DOC())) throw e;
        markWindowClosed(to);
      }
    }
    const r = await sendTemplateRaw(to, TEMPLATE_DOC(), caption || filename, { type: 'document', media: { id: mediaId, filename } });
    console.log(`[WhatsApp] Document "${filename}" sent to ${to} (template)`);
    return ok({ id: r.messages?.[0]?.id, mode: 'template' });
  } catch (err) {
    console.error(`[WhatsApp] Document to ${to} failed:`, err.message);
    return fail(err);
  }
}

// Kept so /whatsapp routes that call it still work. There is no QR in Cloud API.
function getWhatsAppQr() {
  return { qrImage: null, ready: isConfigured(), cloudApi: true };
}

// ── Format helpers ──────────────────────────────────────────────────────────
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

// Machine start/stop set a "notified" flag on success, so these must throw on failure.
const mustSucceed = (r) => { if (!r.success) throw new Error(r.error || 'WhatsApp send failed'); return r; };

// ── Notifications ───────────────────────────────────────────────────────────
async function notifyMachineStart({ date, operator, partner, sessionNumber, startTime }) {
  const sessionLabel = sessionNumber === 1 ? '1st' : sessionNumber === 2 ? '2nd' : '3rd';
  return mustSucceed(await sendWhatsApp(
    `🟢 *Machine Started* — ${sessionLabel} Session\n` +
    `📅 Date: ${formatDate(date)}\n` +
    `👷 Operator: ${operator}\n` +
    `🤝 Partner: ${partner}\n` +
    `🕐 Start Time: ${formatTime(startTime)}`
  ));
}

async function notifyMachineStop({ date, operator, partner, sessionNumber, stopTime }) {
  const sessionLabel = sessionNumber === 1 ? '1st' : sessionNumber === 2 ? '2nd' : '3rd';
  return mustSucceed(await sendWhatsApp(
    `🔴 *Machine Stopped* — ${sessionLabel} Session\n` +
    `📅 Date: ${formatDate(date)}\n` +
    `👷 Operator: ${operator}\n` +
    `🤝 Partner: ${partner}\n` +
    `🕐 Stop Time: ${formatTime(stopTime)}`
  ));
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
  if (rejectionDate) msg += `📆 Rejection Date: ${formatDate(rejectionDate)}\n`;
  msg +=
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `⚙️ Efficiency: ${efficiency}%\n` +
    `❌ Rejection Rate: ${rejRate}%`;
  return sendWhatsApp(msg);
}

async function notifySiftingComplete({ batchNo, date, operator, parts, input, output, rejection, efficiency, completedAt }) {
  const dateStr = new Date(date).toLocaleDateString('en-LK', { timeZone: 'Asia/Colombo' });
  return sendWhatsApp([
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
    `🕐 Completed at ${formatTime(completedAt)}`,
  ].join('\n'));
}

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

const notifyPaymentRecorded = async (payment, sale, balanceDue) =>
  sendWhatsApp(
    `💵 *Payment Received*\n` +
    `📋 Sale No: ${sale.sale_no}\n` +
    `👤 Customer: ${sale.customer_id?.name || 'N/A'}\n` +
    `🧾 Payment No: ${payment.payment_no}\n` +
    `💰 Amount Paid: LKR ${Number(payment.amount).toFixed(2)}\n` +
    `📉 Balance Remaining: LKR ${Number(balanceDue).toFixed(2)}\n` +
    `🕐 ${new Date(payment.payment_date).toLocaleString('en-LK')}`
  );

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
  sendWhatsAppDocument,
  _internal: { flatten },
};