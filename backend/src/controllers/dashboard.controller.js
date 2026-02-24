const dashboardService = require('../services/dashboard.service');

exports.getSummary = async (req, res, next) => {
    try {
        const data = await dashboardService.getSummary();
        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
};