const express = require('express');
const router = express.Router();
const { getWhatsAppQr } = require('../services/whatsapp.service');

router.get('/qr', (req, res) => res.json(getWhatsAppQr()));

module.exports = router;