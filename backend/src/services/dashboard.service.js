// backend/services/dashboard.service.js
const Sale     = require('../models/Sale');
const Payment  = require('../models/Payment');

const getData = async (dateFrom, dateTo) => {
  const dateFilter = {
    $gte: new Date(dateFrom),
    $lte: new Date(dateTo + 'T23:59:59.999Z')
  };

  // ── 1. Immediate sales (CASH / CARD / BANK) ──────────────────────────────
  const immediateMatch = {
    status: 'SAVED',
    payment_method: { $in: ['CASH', 'CARD', 'BANK'] },
    sale_datetime: dateFilter
  };

  // ── 2. Credit payments received in this date range ───────────────────────
  //    Join Payment → Sale to get cost/profit of the proportional amount paid
  const creditPayments = await Payment.aggregate([
    { $match: { payment_date: dateFilter } },
    {
      $lookup: {
        from: 'sales',
        localField: 'sale_id',
        foreignField: '_id',
        as: 'sale'
      }
    },
    { $unwind: '$sale' },
    {
      $match: {
        'sale.status': 'SAVED',
        'sale.payment_method': 'CREDIT'
      }
    },
    {
      $addFields: {
        // Proportion of the sale this payment covers
        payRatio: {
          $cond: [
            { $gt: ['$sale.total_revenue', 0] },
            { $divide: ['$amount', '$sale.total_revenue'] },
            0
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        revenue: { $sum: '$amount' },
        cost:    { $sum: { $multiply: ['$payRatio', '$sale.total_cost'] } },
        profit:  { $sum: { $multiply: ['$payRatio', '$sale.total_profit'] } },
      }
    }
  ]);

  // ── 3. Summary ────────────────────────────────────────────────────────────
  const [immediateSummary] = await Sale.aggregate([
    { $match: immediateMatch },
    {
      $group: {
        _id: null,
        total_revenue: { $sum: '$total_revenue' },
        total_cost:    { $sum: '$total_cost' },
        total_profit:  { $sum: '$total_profit' },
        total_sales:   { $sum: 1 }
      }
    }
  ]);

  const [immediateSalesCount] = await Sale.aggregate([
    { $match: immediateMatch },
    { $group: { _id: null, count: { $sum: 1 } } }
  ]);

  const creditCount = await Payment.aggregate([
    { $match: { payment_date: dateFilter } },
    { $lookup: { from: 'sales', localField: 'sale_id', foreignField: '_id', as: 'sale' } },
    { $unwind: '$sale' },
    { $match: { 'sale.status': 'SAVED', 'sale.payment_method': 'CREDIT' } },
    { $group: { _id: '$sale_id' } },   // distinct sales that received payment
    { $count: 'count' }
  ]);

  const cp = creditPayments[0] ?? { revenue: 0, cost: 0, profit: 0 };
  const is = immediateSummary   ?? { total_revenue: 0, total_cost: 0, total_profit: 0, total_sales: 0 };

  const summary = {
    total_revenue: is.total_revenue + cp.revenue,
    total_cost:    is.total_cost    + cp.cost,
    total_profit:  is.total_profit  + cp.profit,
    total_sales:   is.total_sales   + (creditCount[0]?.count ?? 0)
  };

  // ── 4. Daily Metrics ──────────────────────────────────────────────────────
  const [immediateDailyRaw, creditDailyRaw] = await Promise.all([
    Sale.aggregate([
      { $match: immediateMatch },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$sale_datetime' } },
          revenue: { $sum: '$total_revenue' },
          cost:    { $sum: '$total_cost' },
          profit:  { $sum: '$total_profit' }
        }
      }
    ]),
    Payment.aggregate([
      { $match: { payment_date: dateFilter } },
      { $lookup: { from: 'sales', localField: 'sale_id', foreignField: '_id', as: 'sale' } },
      { $unwind: '$sale' },
      { $match: { 'sale.status': 'SAVED', 'sale.payment_method': 'CREDIT' } },
      {
        $addFields: {
          payRatio: {
            $cond: [
              { $gt: ['$sale.total_revenue', 0] },
              { $divide: ['$amount', '$sale.total_revenue'] },
              0
            ]
          }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$payment_date' } },
          revenue: { $sum: '$amount' },
          cost:    { $sum: { $multiply: ['$payRatio', '$sale.total_cost'] } },
          profit:  { $sum: { $multiply: ['$payRatio', '$sale.total_profit'] } }
        }
      }
    ])
  ]);

  // Merge both into a single daily map
  const dailyMap = {};
  for (const d of immediateDailyRaw) {
    dailyMap[d._id] = { date: d._id, revenue: d.revenue, cost: d.cost, profit: d.profit };
  }
  for (const d of creditDailyRaw) {
    if (dailyMap[d._id]) {
      dailyMap[d._id].revenue += d.revenue;
      dailyMap[d._id].cost    += d.cost;
      dailyMap[d._id].profit  += d.profit;
    } else {
      dailyMap[d._id] = { date: d._id, revenue: d.revenue, cost: d.cost, profit: d.profit };
    }
  }
  const dailyMetrics = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  // ── 5. Top Customers ──────────────────────────────────────────────────────
  const [immediateCustomers, creditCustomers] = await Promise.all([
    Sale.aggregate([
      { $match: immediateMatch },
      {
        $group: {
          _id: '$customer_id',
          revenue:     { $sum: '$total_revenue' },
          sales_count: { $sum: 1 }
        }
      },
      { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: 'customer' } },
      { $project: { customer_name: { $arrayElemAt: ['$customer.name', 0] }, revenue: 1, sales_count: 1 } }
    ]),
    Payment.aggregate([
      { $match: { payment_date: dateFilter } },
      { $lookup: { from: 'sales', localField: 'sale_id', foreignField: '_id', as: 'sale' } },
      { $unwind: '$sale' },
      { $match: { 'sale.status': 'SAVED', 'sale.payment_method': 'CREDIT' } },
      {
        $group: {
          _id: '$sale.customer_id',
          revenue:     { $sum: '$amount' },
          sales_count: { $addToSet: '$sale_id' }   // distinct sales
        }
      },
      { $addFields: { sales_count: { $size: '$sales_count' } } },
      { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: 'customer' } },
      { $project: { customer_name: { $arrayElemAt: ['$customer.name', 0] }, revenue: 1, sales_count: 1 } }
    ])
  ]);

  // Merge customer maps
  const custMap = {};
  for (const c of [...immediateCustomers, ...creditCustomers]) {
    const key = c._id?.toString();
    if (custMap[key]) {
      custMap[key].revenue     += c.revenue;
      custMap[key].sales_count += c.sales_count;
    } else {
      custMap[key] = { customer_name: c.customer_name, revenue: c.revenue, sales_count: c.sales_count };
    }
  }
  const customerPerformance = Object.values(custMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  return { summary, daily_metrics: dailyMetrics, customer_performance: customerPerformance };
};


const getSummary = async () => {
  const now          = new Date();
  const startOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const calcPeriod = async (since) => {
    const dateFilter = { $gte: since };

    const [immediate] = await Sale.aggregate([
      { $match: { status: 'SAVED', payment_method: { $in: ['CASH', 'CARD', 'BANK'] }, sale_datetime: dateFilter } },
      { $group: { _id: null, revenue: { $sum: '$total_revenue' }, profit: { $sum: '$total_profit' }, sales_count: { $sum: 1 } } }
    ]);

    const [credit] = await Payment.aggregate([
      { $match: { payment_date: dateFilter } },
      { $lookup: { from: 'sales', localField: 'sale_id', foreignField: '_id', as: 'sale' } },
      { $unwind: '$sale' },
      { $match: { 'sale.status': 'SAVED', 'sale.payment_method': 'CREDIT' } },
      {
        $addFields: {
          payRatio: { $cond: [{ $gt: ['$sale.total_revenue', 0] }, { $divide: ['$amount', '$sale.total_revenue'] }, 0] }
        }
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$amount' },
          profit:  { $sum: { $multiply: ['$payRatio', '$sale.total_profit'] } },
          sales_count: { $addToSet: '$sale_id' }
        }
      },
      { $addFields: { sales_count: { $size: '$sales_count' } } }
    ]);

    const i = immediate ?? { revenue: 0, profit: 0, sales_count: 0 };
    const c = credit    ?? { revenue: 0, profit: 0, sales_count: 0 };
    return {
      revenue:     i.revenue     + c.revenue,
      profit:      i.profit      + c.profit,
      sales_count: i.sales_count + c.sales_count
    };
  };

  const [today, month] = await Promise.all([
    calcPeriod(startOfDay),
    calcPeriod(startOfMonth)
  ]);

  return { today, month };
};

module.exports = { getData, getSummary };