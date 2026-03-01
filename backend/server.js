require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = require('./src/app');

const PORT = process.env.PORT || 5000;

// Create HTTP server (needed for Socket.IO)
const server = http.createServer(app);

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// Socket.IO Server
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:4200', 'http://127.0.0.1:4200'],
    credentials: true
  }
});

// Socket.IO Auth Middleware
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Token required'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId || decoded.id;
    socket.userRole = decoded.role;

    socket.join(socket.userId.toString());
    if (['admin', 'manager'].includes(socket.userRole)) socket.join('admins');

    console.log(`🔌 Socket auth OK: ${socket.userId} [${socket.userRole}]`);
    next();
  } catch (error) {
    console.error('🔐 Socket auth ERROR:', error.message);
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`✅ Connected: ${socket.userId} [${socket.userRole}]`);
  socket.on('disconnect', () => console.log(`❌ Disconnected: ${socket.userId}`));
});

// Store io instance for routes/controllers
app.set('io', io);

// Start server (ONLY here)
server.listen(PORT, () => {
  console.log(`🚀 Server + Socket.IO: http://localhost:${PORT}`);
  console.log(`📡 Socket.IO ready on ws://localhost:${PORT}`);
});