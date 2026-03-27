const s = require('../services/user.service');
exports.getAllUsers = async (req, res, next) => { try { res.json({ success: true, data: await s.getAll() }); } catch (e) { next(e); } };
exports.getUserById = async (req, res, next) => { try { res.json({ success: true, data: await s.getById(req.params.id) }); } catch (e) { next(e); } };
exports.createUser = async (req, res, next) => { try { res.status(201).json({ success: true, data: await s.create(req.body) }); } catch (e) { next(e); } };
exports.updateUser = async (req, res, next) => { try { res.json({ success: true, data: await s.update(req.params.id, req.body) }); } catch (e) { next(e); } };
exports.deleteUser = async (req, res, next) => { try { await s.remove(req.params.id); res.json({ success: true, message: 'User deleted' }); } catch (e) { next(e); } };

exports.getUsersByRoles = async (req, res, next) => {
    try {
        const { roles } = req.query;
        if (!roles) {
            return res.status(400).json({ success: false, message: 'roles query param is required' });
        }
        const data = await s.getByRoles(roles);
        res.json({ success: true, data });
    } catch (e) {
        next(e);
    }
};