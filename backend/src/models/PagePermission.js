const mongoose = require('mongoose');

const pagePermissionSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ['ADMIN', 'SALES', 'MACHINE_OPERATOR', 'PACKING_OPERATOR'],
        required: true,
        unique: true,
    },
    pages: [{ type: String }], // e.g. ['dashboard', 'sales', 'inventory']
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('PagePermission', pagePermissionSchema);