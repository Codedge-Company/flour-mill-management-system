const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error('MONGO_URI is not set in .env');
  }

  try {
    await mongoose.connect(uri);
    console.log('[DB] MongoDB connected:', mongoose.connection.name);
  } catch (err) {
    console.error('[DB] MongoDB connection failed:', err.message);
    throw err; // propagate so start()/main.js can show a clear error dialog instead of continuing half-broken
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] MongoDB disconnected');
  });
}

module.exports = connectDB;