const salesService = require('../services/sales.service');

// Replace getAllSales with paginated version
exports.getAllSales = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 0;
        const size = parseInt(req.query.size) || 20;
        const filters = req.query;

        const pagedSales = await salesService.getAllPaginated(page, size, filters);
        res.json({
            success: true,
            data: pagedSales
        });
    } catch (e) {
        next(e);
    }
};

exports.getSaleById = async (req, res, next) => { try { res.json({ success: true, data: await salesService.getById(req.params.id) }); } catch (e) { next(e); } };
exports.createSale = async (req, res, next) => { try { res.status(201).json({ success: true, data: await salesService.createSale(req.body, req.user) }); } catch (e) { next(e); } };
exports.cancelSale = async (req, res, next) => { try { res.json({ success: true, data: await salesService.cancelSale(req.params.id) }); } catch (e) { next(e); } };
exports.deleteSale = async (req, res, next) => { try { await salesService.remove(req.params.id); res.json({ success: true, message: 'Sale deleted permanently' }); } catch (e) { next(e); } };
