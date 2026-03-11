// backend/src/services/flowMoney.service.js
const Sale    = require('../models/Sale');
const Payment = require('../models/Payment');
const Capital = require('../models/Capital');

const getTimeline = async (dateFrom, dateTo) => {
  const buildFilter = (field) => {
    const f = {};
    if (dateFrom) f['$gte'] = new Date(dateFrom + 'T00:00:00.000Z');
    if (dateTo) {
      const end = new Date(dateTo + 'T00:00:00.000Z');
      end.setUTCDate(end.getUTCDate() + 1);
      f['$lt'] = end;
    }
    return Object.keys(f).length ? { [field]: f } : {};
  };

  const saleDateFilter    = buildFilter('sale_datetime');
  const paymentDateFilter = buildFilter('payment_date');
  const capitalDateFilter = buildFilter('capital_date');

  // 1. Daily profit from CASH/CARD/BANK sales
  const immediateDailyRaw = await Sale.aggregate([
    {
      $match: {
        status:         'SAVED',
        payment_method: { $in: ['CASH', 'CARD', 'BANK'] },
        ...saleDateFilter,
      },
    },
    {
      $group: {
        _id:     { $dateToString: { format: '%Y-%m-%d', date: '$sale_datetime' } },
        revenue: { $sum: '$total_revenue' },
        cost:    { $sum: '$total_cost' },
        profit:  { $sum: '$total_profit' },
      },
    },
  ]);

  // 2. Daily profit from CREDIT payments received
  const creditDailyRaw = await Payment.aggregate([
    { $match: { ...paymentDateFilter } },
    { $lookup: { from: 'sales', localField: 'sale_id', foreignField: '_id', as: 'sale' } },
    { $unwind: '$sale' },
    { $match: { 'sale.status': 'SAVED', 'sale.payment_method': 'CREDIT' } },
    {
      $addFields: {
        payRatio: {
          $cond: [
            { $gt: ['$sale.total_revenue', 0] },
            { $divide: ['$amount', '$sale.total_revenue'] },
            0,
          ],
        },
      },
    },
    {
      $group: {
        _id:     { $dateToString: { format: '%Y-%m-%d', date: '$payment_date' } },
        revenue: { $sum: '$amount' },
        cost:    { $sum: { $multiply: ['$payRatio', '$sale.total_cost'] } },
        profit:  { $sum: { $multiply: ['$payRatio', '$sale.total_profit'] } },
      },
    },
  ]);

  // 3. Capital injections per day
  const capitalDailyRaw = await Capital.aggregate([
    { $match: { ...capitalDateFilter } },
    {
      $group: {
        _id:    { $dateToString: { format: '%Y-%m-%d', date: '$capital_date' } },
        amount: { $sum: '$amount' },
      },
    },
  ]);

  // Merge into single daily map
  const dailyMap = {};
  const touch = (date) => {
    if (!dailyMap[date]) dailyMap[date] = { date, revenue: 0, cost: 0, profit: 0, capitalIn: 0 };
  };

  for (const d of immediateDailyRaw) {
    touch(d._id);
    dailyMap[d._id].revenue += d.revenue;
    dailyMap[d._id].cost    += d.cost;
    dailyMap[d._id].profit  += d.profit;
  }
  for (const d of creditDailyRaw) {
    touch(d._id);
    dailyMap[d._id].revenue += d.revenue;
    dailyMap[d._id].cost    += d.cost;
    dailyMap[d._id].profit  += d.profit;
  }
  for (const d of capitalDailyRaw) {
    touch(d._id);
    dailyMap[d._id].capitalIn += d.amount;
  }

  // Sort & compute running totals
  const sorted = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  let cumulativeCapital = 0;
  let cumulativeProfit  = 0;
  let cumulativeRevenue = 0;
  let cumulativeCost    = 0;

  const timeline = sorted.map((d) => {
    cumulativeCapital += d.capitalIn;
    cumulativeProfit  += d.profit;
    cumulativeRevenue += d.revenue;
    cumulativeCost    += d.cost;
    return {
      date:              d.date,
      dailyRevenue:      d.revenue,
      dailyCost:         d.cost,
      dailyProfit:       d.profit,
      dailyCapitalIn:    d.capitalIn,
      netWorth:          cumulativeCapital + cumulativeProfit,
      cumulativeCapital,
      cumulativeProfit,
      cumulativeRevenue,
      cumulativeCost,
    };
  });

  const totalCapital    = cumulativeCapital;
  const totalProfit     = cumulativeProfit;
  const totalRevenue    = cumulativeRevenue;
  const totalCost       = cumulativeCost;
  const currentNetWorth = totalCapital + totalProfit;

  const profitDays = sorted.filter(d => d.profit !== 0);
  const bestDay    = profitDays.reduce((b, d) => (!b || d.profit > b.profit ? d : b), null);
  const worstDay   = profitDays.reduce((w, d) => (!w || d.profit < w.profit ? d : w), null);

  const firstNW    = timeline[0]?.netWorth ?? 0;
  const lastNW     = timeline[timeline.length - 1]?.netWorth ?? 0;
  const growthRate = firstNW > 0 ? ((lastNW - firstNW) / firstNW) * 100 : 0;

  return {
    timeline,
    summary: {
      currentNetWorth,
      totalCapital,
      totalProfit,
      totalRevenue,
      totalCost,
      growthRate,
      avgDailyProfit: sorted.length > 0 ? totalProfit / sorted.length : 0,
      roi:            totalCapital > 0 ? (totalProfit / totalCapital) * 100 : 0,
      daysTracked:    sorted.length,
      bestDay:  bestDay  ? { date: bestDay.date,  profit: bestDay.profit  } : null,
      worstDay: worstDay ? { date: worstDay.date, profit: worstDay.profit } : null,
    },
    allCapitals: await Capital.find({ ...capitalDateFilter }).sort({ capital_date: 1 }).lean(),
  };
};

module.exports = { getTimeline };