const Inventory = require('../models/Inventory');

const validateStock = async (items) => {
    const errors = [];
    for (const item of items) {
        const inv = await Inventory.findOne({ pack_type_id: item.pack_type_id });
        if (!inv) {
            errors.push(`No inventory found for pack_type_id ${item.pack_type_id}`);
        } else if (inv.stock_qty < item.qty) {
            errors.push(`Insufficient stock for pack_type_id ${item.pack_type_id}. Available: ${inv.stock_qty}, Requested: ${item.qty}`);
        }
    }
    return errors;
};

module.exports = { validateStock };