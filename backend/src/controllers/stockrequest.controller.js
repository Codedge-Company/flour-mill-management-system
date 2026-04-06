const stockRequestService = require('../services/stockrequest.service');
const { notifyPackingDone } = require('../services/whatsapp.service');

exports.createStockRequest = async (req, res, next) => {
    try {
        const userId = req.user?._id ?? req.user?.id ?? null;
        const data = await stockRequestService.create(req.body, userId);
        res.status(201).json({ success: true, data });
    } catch (e) {
        next(e);
    }
};

exports.getAllStockRequests = async (req, res, next) => {
    try {
        const { pack_type_id, status } = req.query;
        const data = await stockRequestService.getAll({ pack_type_id, status });
        res.json({ success: true, data });
    } catch (e) {
        next(e);
    }
};

exports.getStockRequestById = async (req, res, next) => {
    try {
        const data = await stockRequestService.getById(req.params.id);
        res.json({ success: true, data });
    } catch (e) {
        next(e);
    }
};

exports.updateStatus = async (req, res, next) => {
    try {
        const { status, operatorName } = req.body;

        const data = await stockRequestService.updateStatus(
            req.params.id,
            status,
            operatorName
        );

        if (status === 'FULFILLED') {
            notifyPackingDone({
                packName: data.pack_name ?? data.packName ?? 'Unknown',
                weightKg: data.weight_kg ?? data.weightKg ?? 0,
                qty: data.qty ?? 0,
                operatorName: data.operator_name ?? operatorName ?? 'Unknown',
                time: new Date(),
            }).catch(err =>
                console.error('[WhatsApp] notifyPackingDone failed:', err.message)
            );
        }

        res.json({ success: true, data });
    } catch (e) {
        next(e);
    }
};

/** PATCH /:id  — update quantity only (must still be PENDING or APPROVED) */
exports.updateQty = async (req, res, next) => {
    try {
        const { qty } = req.body;
        const data = await stockRequestService.updateQty(req.params.id, qty);
        res.json({ success: true, data });
    } catch (e) {
        next(e);
    }
};

exports.deleteStockRequest = async (req, res, next) => {
    try {
        await stockRequestService.remove(req.params.id);
        res.json({ success: true, message: 'Stock request deleted' });
    } catch (e) {
        next(e);
    }
};