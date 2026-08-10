const mongoose = require('mongoose');

const requestedStockSchema = new mongoose.Schema(
    {
        pack_type_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'PackType',
            required: true,
        },
        pack_name: { type: String, required: true },
        weight_kg: { type: Number, required: true },

        // Original requested quantity — never changes after creation
        qty: {
            type: Number,
            required: true,
            min: [1, 'Quantity must be at least 1'],
        },

        // ── NEW: running total already packed ──
        fulfilled_qty: {
            type: Number,
            default: 0,
            min: 0,
        },

        // ── NEW: dated log of each part-complete / full-complete entry ──
        fulfillments: [
            {
                qty: { type: Number, required: true },
                date: { type: Date, default: Date.now },
                operator_name: { type: String, default: null, trim: true },
            },
        ],

        requested_at: { type: Date, default: Date.now },
        requested_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

        status: {
            type: String,
            enum: ['PENDING', 'APPROVED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'REJECTED'],
            default: 'PENDING',
        },
        operator_name: { type: String, default: null, trim: true },
    },
    {
        timestamps: true,
        collection: 'requested_stocks',
    }
);

requestedStockSchema.index({ pack_type_id: 1, requested_at: -1 });

module.exports = mongoose.model('RequestedStock', requestedStockSchema);