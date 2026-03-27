const mongoose = require('mongoose');

/**
 * RequestedStock
 * Stores stock replenishment requests submitted from the Inventory UI.
 * Fields are intentionally denormalised (pack_name, weight_kg) so that
 * historical requests remain readable even if a pack type is later renamed.
 */
const requestedStockSchema = new mongoose.Schema(
    {
        pack_type_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'PackType',
            required: true,
        },

        // Denormalised snapshot at the time of request
        pack_name: {
            type: String,
            required: true,
        },
        weight_kg: {
            type: Number,
            required: true,
        },

        // Requested quantity (number of packs)
        qty: {
            type: Number,
            required: true,
            min: [1, 'Quantity must be at least 1'],
        },

        // Timestamp of the request (explicit; also tracked by createdAt below)
        requested_at: {
            type: Date,
            default: Date.now,
        },

        // Optional: track who made the request
        requested_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        // Lifecycle status of the request
        status: {
            type: String,
            enum: ['PENDING', 'APPROVED', 'FULFILLED', 'REJECTED'],
            default: 'PENDING',
        },
        operator_name: {
            type: String,
            default: null,
            trim: true,
        },
    },
    {
        timestamps: true, // adds createdAt + updatedAt
        collection: 'requested_stocks',
    }
);

// Index for common queries (all requests for a pack type, sorted by date)
requestedStockSchema.index({ pack_type_id: 1, requested_at: -1 });

module.exports = mongoose.model('RequestedStock', requestedStockSchema);