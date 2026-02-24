const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    type: { type: String, enum: ['LOW_STOCK'], required: true },
    pack_type_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PackType', required: true },
    message: { type: String, required: true },
    is_read: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Notification', notificationSchema);  