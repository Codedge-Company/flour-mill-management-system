const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
    pack_type_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'PackType', required: true },
    qty:               { type: Number, required: true },
    unit_price_sold:   { type: Number, required: true },
    unit_cost_at_sale: { type: Number, required: true },
    line_revenue:      { type: Number, required: true },
    line_cost:         { type: Number, required: true },
    line_profit:       { type: Number, required: true },
}, { _id: true });

const saleSchema = new mongoose.Schema({
    sale_no:              { type: String, required: true, unique: true },
    customer_id:          { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    created_by_user_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sale_datetime:        { type: Date, default: Date.now },

    // ── Payment ────────────────────────────────────────────────────────────
    payment_method: {
        type:    String,
        enum:    ['CASH', 'CARD', 'BANK', 'CREDIT'],   // ← CREDIT added
        default: 'CASH'
    },

    /**
     * payment_status tracks whether the money has actually been received.
     *  - CASH / CARD / BANK  →  always 'PAID' (settled immediately)
     *  - CREDIT              →  starts as 'PENDING', updated to 'PAID' when collected
     *
     * Existing documents without this field will read as null/undefined;
     * the frontend treats a missing status on non-CREDIT sales as 'PAID'.
     */
    payment_status: {
        type:    String,
        enum:    ['PENDING', 'PAID'],
        default: 'PAID'
    },

    // ── Sale state ─────────────────────────────────────────────────────────
    status: {
        type:    String,
        enum:    ['SAVED', 'CANCELLED'],
        default: 'SAVED'
    },

    // ── Financials ─────────────────────────────────────────────────────────
    total_revenue: { type: Number, default: 0 },
    total_cost:    { type: Number, default: 0 },
    total_profit:  { type: Number, default: 0 },
    items:         [saleItemSchema],
});

saleSchema.index({ sale_datetime: -1 });
saleSchema.index({ payment_status: 1 }); // handy for "pending credits" queries

module.exports = mongoose.model('Sale', saleSchema);