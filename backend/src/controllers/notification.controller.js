const notificationService = require('../services/notification.service');

exports.getAllNotifications = async (req, res, next) => { try { res.json({ success: true, data: await notificationService.getAll() }); } catch (e) { next(e); } };
exports.getUnreadNotifications = async (req, res, next) => { try { const data = await notificationService.getUnread(); res.json({ success: true, count: data.length, data }); } catch (e) { next(e); } };
exports.getNotificationById = async (req, res, next) => { try { res.json({ success: true, data: await notificationService.getById(req.params.id) }); } catch (e) { next(e); } };
exports.createNotification = async (req, res, next) => { try { res.status(201).json({ success: true, data: await notificationService.create(req.body) }); } catch (e) { next(e); } };
exports.markAsRead = async (req, res, next) => { try { res.json({ success: true, data: await notificationService.markAsRead(req.params.id) }); } catch (e) { next(e); } };
exports.markAllAsRead = async (req, res, next) => { try { await notificationService.markAllAsRead(); res.json({ success: true, message: 'All notifications marked as read' }); } catch (e) { next(e); } };
exports.deleteNotification = async (req, res, next) => { try { await notificationService.remove(req.params.id); res.json({ success: true, message: 'Notification deleted' }); } catch (e) { next(e); } };