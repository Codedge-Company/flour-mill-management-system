const User = require('./User');
const Customer = require('./Customer');
const PackType = require('./PackType');
const Inventory = require('./Inventory');
const StockThreshold = require('./StockThreshold');
const CostHistory = require('./CostHistory');
const DefaultPrice = require('./DefaultPrice');
const CustomerPriceRule = require('./CustomerPriceRule');
const Sale = require('./Sale');
const Notification = require('./Notification');
const Counter = require('./Counter');

// ── PackType associations ──────────────────────────────────────────────────
PackType.hasOne(Inventory, { foreignKey: 'pack_type_id' });
PackType.hasOne(StockThreshold, { foreignKey: 'pack_type_id' });
PackType.hasMany(CostHistory, { foreignKey: 'pack_type_id' });
PackType.hasMany(DefaultPrice, { foreignKey: 'pack_type_id' });
PackType.hasMany(CustomerPriceRule, { foreignKey: 'pack_type_id' });
PackType.hasMany(Notification, { foreignKey: 'pack_type_id' });

Inventory.belongsTo(PackType, { foreignKey: 'pack_type_id' });
StockThreshold.belongsTo(PackType, { foreignKey: 'pack_type_id' });
CostHistory.belongsTo(PackType, { foreignKey: 'pack_type_id' });
DefaultPrice.belongsTo(PackType, { foreignKey: 'pack_type_id' });
CustomerPriceRule.belongsTo(PackType, { foreignKey: 'pack_type_id' });
Notification.belongsTo(PackType, { foreignKey: 'pack_type_id' });

// ── Customer associations ──────────────────────────────────────────────────
Customer.hasMany(CustomerPriceRule, { foreignKey: 'customer_id' });
Customer.hasMany(Sale, { foreignKey: 'customer_id' });
CustomerPriceRule.belongsTo(Customer, { foreignKey: 'customer_id' });
Sale.belongsTo(Customer, { foreignKey: 'customer_id' });

// ── User associations ──────────────────────────────────────────────────────
User.hasMany(Sale, { foreignKey: 'created_by_user_id' });
User.hasMany(CostHistory, { foreignKey: 'updated_by_user_id' });
Sale.belongsTo(User, { foreignKey: 'created_by_user_id' });
CostHistory.belongsTo(User, { foreignKey: 'updated_by_user_id' });

// ── Sale associations ──────────────────────────────────────────────────────
Sale.hasMany(SaleItem, { foreignKey: 'sale_id', as: 'items' });
SaleItem.belongsTo(Sale, { foreignKey: 'sale_id' });

module.exports = {
    User, Customer, PackType, Inventory, StockThreshold,
    CostHistory, DefaultPrice, CustomerPriceRule,
    Sale, Notification, Counter,
};