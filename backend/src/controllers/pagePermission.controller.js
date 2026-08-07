const s = require('../services/pagePermission.service');

exports.getPages = (req, res) => {
    res.json({ success: true, data: s.PAGES });
};

exports.getAllPermissions = async (req, res, next) => {
    try { res.json({ success: true, data: await s.getAll() }); } catch (e) { next(e); }
};

exports.updatePermissions = async (req, res, next) => {
    try {
        const { matrix } = req.body;
        if (!Array.isArray(matrix)) {
            return res.status(400).json({ success: false, message: 'matrix array is required' });
        }
        res.json({ success: true, data: await s.updateMatrix(matrix) });
    } catch (e) { next(e); }
};

exports.getMyPermissions = async (req, res, next) => {
    try { res.json({ success: true, data: await s.getByRole(req.user.role) }); } catch (e) { next(e); }
};