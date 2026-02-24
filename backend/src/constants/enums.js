const ROLES = Object.freeze({ ADMIN: 'ADMIN', SALES: 'SALES' });
const PAYMENT_METHODS = Object.freeze({ CASH: 'CASH', CARD: 'CARD', BANK: 'BANK' });
const SALE_STATUS = Object.freeze({ SAVED: 'SAVED', CANCELLED: 'CANCELLED' });
const NOTIFICATION_TYPES = Object.freeze({ LOW_STOCK: 'LOW_STOCK' });

module.exports = { ROLES, PAYMENT_METHODS, SALE_STATUS, NOTIFICATION_TYPES };