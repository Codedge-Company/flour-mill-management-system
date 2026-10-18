// backend/server.js

require('dotenv').config();

// Prevent any unhandled promise rejection / exception from crashing the whole server -
// log it instead.
process.on('unhandledRejection', (reason) => {
  console.error('[UnhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[UncaughtException]', err);
});

const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./src/config/config');
const app = require('./src/app');
const connectDB = require('./src/config/db');

// WhatsApp Cloud API service (no QR / browser session any more)
const { getWhatsAppQr } = require('./src/services/whatsapp.service');
// Automatic end-of-day report for the admin (20:00 Colombo time)
const { startDigestScheduler } = require('./src/services/dailyDigest.service');

const server = http.createServer(app);

// ── Allowed Origins ────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'https://flour-mill-management-system-nine.vercel.app',
  'https://www.matheeshaflourmill.lk',
  'https://matheeshaflourmill.lk'
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true
  }
});

// ── JWT Middleware ─────────────────────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token provided'));

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error('[Socket] JWT verify failed:', err.message);
      return next(new Error('Invalid token'));
    }

    const userId = decoded.user_id ?? decoded.id ?? decoded._id;
    if (!userId) {
      console.error('[Socket] No user ID in token:', decoded);
      return next(new Error('Token missing user ID'));
    }

    socket.userId = userId.toString();
    socket.userRole = decoded.role;
    console.log(`[Socket] Auth OK — userId: ${socket.userId}, role: ${socket.userRole}`);
    next();
  });
});

// ── Connection Handler ─────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`✅ Socket connected: ${socket.id} | user: ${socket.userId}`);
  socket.join(`user_${socket.userId}`);

  socket.on('disconnect', (reason) => {
    console.log(`❌ Disconnected: ${socket.id} | reason: ${reason}`);
  });
});

app.set('io', io);

// ── WhatsApp status page ───────────────────────────────────────────────────
// WhatsApp now runs on the Meta Cloud API, so there is no QR to scan.
// This route is kept so old links / the "WhatsApp connect" page keep working.
app.get('/whatsapp/qr', (req, res) => {
  try {
    const { ready } = getWhatsAppQr();
    const title = ready ? 'WhatsApp is connected' : 'WhatsApp is not configured';
    const text = ready
      ? 'Messages are sent through the WhatsApp Business Cloud API. No QR code is needed.'
      : 'Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID in the backend .env file.';
    const colour = ready ? '#1f7a1f' : '#b45309';

    res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>WhatsApp</title>
<style>
  body { font-family: Arial, sans-serif; text-align: center; padding: 40px; background: #f7f7f7; }
  .box { max-width: 500px; margin: auto; background: #fff; border-radius: 12px; padding: 30px;
         box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
  h2 { color: ${colour}; }
  p { color: #555; }
</style>
</head>
<body>
<div class="box">
<h2>${title}</h2>
<p>${text}</p>
</div>
</body>
</html>`);
  } catch (err) {
    console.error('[WhatsApp status route error]:', err.message);
    res.status(500).send('Failed to load WhatsApp status');
  }
});

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      startDigestScheduler(); // daily 20:00 report to the admin
    });
  })
  .catch((err) => {
    console.error('❌ DB connection failed:', err.message);
    process.exit(1);
  });

module.exports = { server, io };