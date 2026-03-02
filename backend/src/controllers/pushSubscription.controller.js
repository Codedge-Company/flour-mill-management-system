// backend/src/controllers/pushSubscription.controller.js
const PushSubscription = require('../models/PushSubscription');

exports.subscribe = async (req, res, next) => {
  try {
    const userId      = req.user._id;
    const subscription = req.body;  // { endpoint, expirationTime, keys: { p256dh, auth } }

    if (!subscription?.endpoint) {
      return res.status(400).json({ success: false, message: 'Invalid subscription object' });
    }

    // Upsert — replace existing subscription for this user
    await PushSubscription.findOneAndUpdate(
      { userId },
      { userId, subscription },
      { upsert: true, new: true }
    );

    console.log(`[Push] ✅ Subscription saved for user ${userId}`);
    res.status(201).json({ success: true, message: 'Push subscription saved' });
  } catch (e) {
    next(e);
  }
};

exports.unsubscribe = async (req, res, next) => {
  try {
    await PushSubscription.findOneAndDelete({ userId: req.user._id });
    res.json({ success: true, message: 'Unsubscribed from push notifications' });
  } catch (e) {
    next(e);
  }
};
