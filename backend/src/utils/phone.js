// src/utils/phone.js
// Normalizes any customer-entered phone number into the WhatsApp chat-id
// format this app already uses elsewhere (e.g. "94779337369") - digits
// only, country code prefixed, no leading local "0", no +, no spaces/dashes.

const DEFAULT_COUNTRY_CODE = '94'; // Sri Lanka

function formatPhoneForWhatsApp(rawPhone, countryCode = DEFAULT_COUNTRY_CODE) {
  if (!rawPhone) return null;

  let digits = String(rawPhone).replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith(countryCode)) {
    return digits;
  }

  if (digits.startsWith('0')) {
    return countryCode + digits.slice(1);
  }

  return countryCode + digits;
}

module.exports = { formatPhoneForWhatsApp };