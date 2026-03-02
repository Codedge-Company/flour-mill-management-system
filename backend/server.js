// backend/server.js
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./src/config/config');
const app = require('./src/app');
const connectDB = require('./src/config/db');

const server = http.createServer(app);

// ── Allowed Origins ────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'https://flour-mill-management-system-nine.vercel.app'  // ✅ your Vercel URL
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

const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
});

module.exports = { server, io };