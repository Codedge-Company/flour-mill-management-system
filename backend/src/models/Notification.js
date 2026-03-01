const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['LOW_STOCK', 'OUT_OF_STOCK', 'REORDER_NEEDED', 'STOCK_UPDATE'], 
    required: true 
  },
  pack_type_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PackType', required: true },
  current_stock: { type: Number, required: function() { return this.type.includes('STOCK'); } },
  previous_stock: { type: Number },
  threshold: { type: Number },
  message: { type: String, required: true },
  is_read: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }  // Add this
});

module.exports = mongoose.model('Notification', notificationSchema);
