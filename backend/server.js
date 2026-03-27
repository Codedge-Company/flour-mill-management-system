// backend/server.js

require('dotenv').config();

const http = require('http');

const { Server } = require('socket.io');

const jwt = require('jsonwebtoken');

const { JWT_SECRET } = require('./src/config/config');

const app = require('./src/app');

const connectDB = require('./src/config/db');

// WhatsApp service

const { getWhatsAppQr } = require('./src/services/whatsapp.service'); // adjust path if your file is elsewhere

const server = http.createServer(app);

// ── Allowed Origins ────────────────────────────────────────────────────────

const allowedOrigins = [

  'http://localhost:4200',

  'http://127.0.0.1:4200',

  'https://flour-mill-management-system-nine.vercel.app',

  'https://www.matheeshaflourmill.lk'

];

const io = new Server(server, {

  cors: {

    origin: allowedOrigins,

    methods: ['GET', 'POST'],

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

// ── WhatsApp QR Route ──────────────────────────────────────────────────────

// Open this in browser:

// https://your-render-url.onrender.com/whatsapp/qr

app.get('/whatsapp/qr', (req, res) => {

  try {

    const qr = getWhatsAppQr();

    if (qr.ready) {

      return res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta http-equiv="refresh" content="3" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>WhatsApp Connected</title>
<style>

            body {

              font-family: Arial, sans-serif;

              text-align: center;

              padding: 40px;

              background: #f7f7f7;

            }

            .box {

              max-width: 500px;

              margin: auto;

              background: #fff;

              border-radius: 12px;

              padding: 30px;

              box-shadow: 0 2px 10px rgba(0,0,0,0.08);

            }

            h2 { color: #1f7a1f; }
</style>
</head>
<body>
<div class="box">
<h2>WhatsApp is already connected</h2>
<p>No QR code needed now.</p>
</div>
</body>
</html>

      `);

    }

    if (!qr.qrImage) {

      return res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>WhatsApp QR</title>
<style>

            body {

              font-family: Arial, sans-serif;

              text-align: center;

              padding: 40px;

              background: #f7f7f7;

            }

            .box {

              max-width: 500px;

              margin: auto;

              background: #fff;

              border-radius: 12px;

              padding: 30px;

              box-shadow: 0 2px 10px rgba(0,0,0,0.08);

            }
</style>
</head>
<body>
<div class="box">
<h2>QR not ready yet</h2>
<p>Please refresh this page after a few seconds.</p>
</div>
</body>
</html>

      `);

    }

    return res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>WhatsApp QR</title>
<style>

          body {

            font-family: Arial, sans-serif;

            text-align: center;

            padding: 40px;

            background: #f7f7f7;

          }

          .box {

            max-width: 550px;

            margin: auto;

            background: #fff;

            border-radius: 12px;

            padding: 30px;

            box-shadow: 0 2px 10px rgba(0,0,0,0.08);

          }

          img {

            width: 100%;

            max-width: 320px;

            height: auto;

            margin-top: 20px;

            border: 1px solid #ddd;

            border-radius: 8px;

          }

          p {

            color: #555;

          }
</style>
</head>
<body>
<div class="box">
<h2>Scan this WhatsApp QR</h2>
<p>Open WhatsApp on your phone</p>
<p><b>Linked Devices → Link a Device</b></p>
<img src="${qr.qrImage}" alt="WhatsApp QR Code" />
<p style="margin-top:20px;">If expired, refresh this page.</p>
</div>
</body>
</html>

    `);

  } catch (err) {

    console.error('[WhatsApp QR Route Error]:', err.message);

    return res.status(500).send('Failed to load WhatsApp QR');

  }

});

const PORT = process.env.PORT || 5000;

connectDB()

  .then(() => {

    server.listen(PORT, () => {

      console.log(`🚀 Server running on http://localhost:${PORT}`);
      const { getWhatsAppQr } = require('./src/services/whatsapp.service');
      getWhatsAppQr(); // triggers initWhatsApp()

    });

  })

  .catch((err) => {

    console.error('❌ DB connection failed:', err.message);

    process.exit(1);

  });

module.exports = { server, io };
