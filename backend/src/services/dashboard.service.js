// backend/services/dashboard.service.js
const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const StockThreshold = require('../models/StockThreshold');
const Notification = require('../models/Notification');

const getData = async (dateFrom, dateTo) => {
  const match = {
    status: 'SAVED',
    sale_datetime: {
      $gte: new Date(dateFrom),
      $lte: new Date(dateTo + 'T23:59:59.999Z')
    }
  };

  // 1. Summary
  const summary = await Sale.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total_revenue: { $sum: '$total_revenue' },
        total_cost: { $sum: '$total_cost' },
        total_profit: { $sum: '$total_profit' },
        total_sales: { $sum: 1 }
      }
    }
  ]);

  // 2. Daily Metrics
  const dailyMetrics = await Sale.aggregate([
    { $match: match },
    {
      $group: {
        _id: { 
          $dateToString: { format: '%Y-%m-%d', date: '$sale_datetime' } 
        },
        revenue: { $sum: '$total_revenue' },
        cost: { $sum: '$total_cost' },
        profit: { $sum: '$total_profit' }
      }
    },
    { $sort: { _id: 1 } },
    { $project: { date: '$_id', revenue: 1, cost: 1, profit: 1, _id: 0 } }
  ]);

  // 3. Top Customers
  const customerPerformance = await Sale.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$customer_id',
        customer_name: { $first: '$customer_id.name' },
        revenue: { $sum: '$total_revenue' },
        sales_count: { $sum: 1 }
      }
    },
    { $sort: { revenue: -1 } },
    { $limit: 10 },
    { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: 'customer' } },
    { $project: { 
      customer_name: { $arrayElemAt: ['$customer.name', 0] },
      revenue: 1, 
      sales_count: 1, 
      _id: 0 
    } }
  ]);

  return {
    summary: summary[0] || { total_revenue: 0, total_cost: 0, total_profit: 0, total_sales: 0 },
    daily_metrics: dailyMetrics,
    customer_performance: customerPerformance
  };
};

const getSummary = async () => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayStats] = await Sale.aggregate([
    { $match: { status: 'SAVED', sale_datetime: { $gte: startOfDay } } },
    { $group: { _id: null, revenue: { $sum: '$total_revenue' }, profit: { $sum: '$total_profit' }, sales_count: { $sum: 1 } } },
  ]);

  const [monthStats] = await Sale.aggregate([
    { $match: { status: 'SAVED', sale_datetime: { $gte: startOfMonth } } },
    { $group: { _id: null, revenue: { $sum: '$total_revenue' }, profit: { $sum: '$total_profit' }, sales_count: { $sum: 1 } } },
  ]);

  return {
    today: todayStats || { revenue: 0, profit: 0, sales_count: 0 },
    month: monthStats || { revenue: 0, profit: 0, sales_count: 0 }
  };
};

module.exports = { getData, getSummary };
