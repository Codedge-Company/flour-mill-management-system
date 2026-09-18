const salesService = require('../services/sales.service');
const printerService = require('../services/printer.service');
const invoicePrinterService = require('../services/invoicePrinter.service');
const InvoiceLink = require('../models/InvoiceLink');
const path = require('path');

const RECEIPT_PRINTER_NAME = process.env.RECEIPT_PRINTER_NAME || '80 Printer Series';
const INVOICE_PRINTER_NAME = process.env.INVOICE_PRINTER_NAME || 'A4 Printer';

// ── In-memory store for one-time invoice download links ────────────────────
// token -> { filePath, filename, expiresAt }. Simple Map is fine here since
// links are short-lived (24h) and this is a single-instance server; if you
// ever run multiple instances behind a load balancer, move this to Redis
// or the DB so all instances can serve the same token.
const invoiceLinkStore = new Map();

exports.getAllSales = async (req, res, next) => {
    try {
        const page    = parseInt(req.query.page) || 0;
        const size    = parseInt(req.query.size) || 20;
        const filters = req.query;
        res.json({ success: true, data: await salesService.getAllPaginated(page, size, filters) });
    } catch (e) { next(e); }
};

exports.getSaleById = async (req, res, next) => {
    try { res.json({ success: true, data: await salesService.getById(req.params.id) }); }
    catch (e) { next(e); }
};

exports.createSale = async (req, res, next) => {
    try {
        const payload = {
            ...req.body,
            use_default_price: req.body.use_default_price ?? false,
        };
        const sale = await salesService.createSale(payload, req.user);

        printerService.printSale(sale, 'thermal', { printerName: RECEIPT_PRINTER_NAME })
            .catch(err => console.error('[Print] Receipt failed:', err.message));

        if (sale.customer_id && typeof sale.customer_id === 'object') {
            invoicePrinterService.printInvoiceSilently(sale, sale.customer_id, { printerName: INVOICE_PRINTER_NAME })
                .catch(err => console.error('[Print] Invoice failed:', err.message));
        }

        // ── WhatsApp notifications ──
        salesService.notifySaleCreated(sale)
            .catch(err => console.error('[WhatsApp] Sale notify failed:', err.message));

        if (sale.customer_id && typeof sale.customer_id === 'object') {
            salesService.sendInvoiceToCustomer(sale, sale.customer_id)
                .catch(err => console.error('[WhatsApp] Invoice send to customer failed:', err.message));
        }

        res.status(201).json({ success: true, data: sale });
    } catch (e) {
        if (e.code === 'NO_CUSTOMER_PRICE_RULE') {
            return res.status(409).json({ success: false, code: e.code, message: e.message });
        }
        next(e);
    }
};

exports.updateSale = async (req, res, next) => {
    try { res.json({ success: true, data: await salesService.updateSale(req.params.id, req.body) }); }
    catch (e) { next(e); }
};

exports.cancelSale = async (req, res, next) => {
    try { res.json({ success: true, data: await salesService.cancelSale(req.params.id) }); }
    catch (e) { next(e); }
};

exports.deleteSale = async (req, res, next) => {
    try {
        await salesService.remove(req.params.id);
        res.json({ success: true, message: 'Sale deleted permanently' });
    } catch (e) { next(e); }
};

exports.markAsPaid = async (req, res, next) => {
    try { res.json({ success: true, data: await salesService.markAsPaid(req.params.id) }); }
    catch (e) { next(e); }
};

// ── Manual reprint (used by "Print Receipt / Print Invoice" buttons) ───────
exports.reprintReceipt = async (req, res, next) => {
    try {
        const sale = await salesService.getById(req.params.id);
        const result = await printerService.printSale(sale, 'thermal', { printerName: RECEIPT_PRINTER_NAME });
        res.json({ success: result.success, data: result });
    } catch (e) { next(e); }
};

exports.reprintInvoice = async (req, res, next) => {
    try {
        const sale = await salesService.getById(req.params.id);
        const customer = sale.customer_id;
        const result = await invoicePrinterService.printInvoiceSilently(sale, customer, { printerName: INVOICE_PRINTER_NAME });
        res.json({ success: true, data: result });
    } catch (e) { next(e); }
};

exports.printStoreRoomReceipt = async (req, res, next) => {
    try {
        const sale = await salesService.getById(req.params.id);
        const result = await printerService.printStoreRoomReceipt(sale, { printerName: RECEIPT_PRINTER_NAME });
        res.json({ success: result.success, data: result });
    } catch (e) { next(e); }
};

exports.printDeliveryNote = async (req, res, next) => {
    try {
        const { vehicleNo } = req.body;
        if (!vehicleNo) {
            return res.status(422).json({ success: false, message: 'vehicleNo is required' });
        }
        const sale = await salesService.getById(req.params.id);
        const result = await printerService.printDeliveryNote(sale, vehicleNo, { printerName: RECEIPT_PRINTER_NAME });
        res.json({ success: result.success, data: result });
    } catch (e) { next(e); }
};

// ── Serve a generated invoice PDF by one-time token (sent via WhatsApp link) ─
exports.downloadInvoiceByToken = async (req, res) => {
    const entry = await InvoiceLink.findOne({ token: req.params.token });
    if (!entry || Date.now() > entry.expires_at.getTime()) {
        return res.status(404).send('Link expired or not found.');
    }
    const fullPath = path.join(__dirname, '../../tmp', entry.file_path);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${entry.filename}"`);
    res.sendFile(fullPath, (err) => {
        if (err) console.error('[Invoice Download] sendFile failed:', err.message);
    });
};