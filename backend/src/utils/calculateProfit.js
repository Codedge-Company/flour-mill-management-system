const calculateProfit = (qty, unitPrice, unitCost) => {
    const line_revenue = parseFloat((qty * unitPrice).toFixed(2));
    const line_cost = parseFloat((qty * unitCost).toFixed(2));
    const line_profit = parseFloat((line_revenue - line_cost).toFixed(2));
    return { line_revenue, line_cost, line_profit };
};

module.exports = { calculateProfit };