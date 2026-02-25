const dashboardService = require('../services/dashboard.service');

const getDashboardData = async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const data = await dashboardService.getData(dateFrom, dateTo);
    res.json(data);
  } catch (e) {
    next(e);
  }
};

const getSummary = async (req, res, next) => {
  try {
    const data = await dashboardService.getSummary();
    res.json(data);
  } catch (e) {
    next(e);
  }
};

module.exports = { getDashboardData, getSummary };
