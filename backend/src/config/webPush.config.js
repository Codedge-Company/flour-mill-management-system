
const webPush = require('web-push');

if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.error('[WebPush] ❌ VAPID keys missing in .env!');
} else {
  webPush.setVapidDetails(
    'mailto:prasannathakshila9@gmail.com',  // ← replace with your email
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  console.log('[WebPush] ✅ VAPID configured');
}

module.exports = webPush;
