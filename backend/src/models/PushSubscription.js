// backend/src/models/PushSubscription.js
const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema({
  userId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    unique:   true   // one subscription per user
  },
  subscription: {
    type:     Object,
    required: true
    // Stores: { endpoint, expirationTime, keys: { p256dh, auth } }
  }
}, { timestamps: true });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
