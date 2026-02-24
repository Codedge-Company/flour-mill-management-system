const authService = require('../services/auth.service');
exports.login = async (req, res, next) => { try { res.json({ success: true, data: await authService.login(req.body) }); } catch (e) { next(e); } };
exports.getMe = (req, res) => res.json({ success: true, data: req.user });