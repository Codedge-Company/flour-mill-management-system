const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    full_name: { type: String, required: true, maxlength: 120 },
    username: { type: String, required: true, unique: true, maxlength: 60 },
    password_hash: { type: String, required: true },
    role: { type: String, enum: ['ADMIN', 'SALES'], default: 'SALES' },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('User', userSchema);