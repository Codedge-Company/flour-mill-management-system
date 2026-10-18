// routes/dailyDigest.routes.js  (admin only, same auth pattern as customerPriceRule.routes.js)
const router = require('express').Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRole } = require('../middlewares/role.middleware');
const digest = require('../services/dailyDigest.service');

router.use(authenticate, authorizeRole('ADMIN'));

// PDF only, nothing is sent: GET /api/daily-digest/2026-10-18/preview
router.get('/:date/preview', async (req, res, next) => {
  try {
    const pdf = await digest.previewPdf(req.params.date);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Daily-Report-${req.params.date}.pdf"`);
    res.send(pdf);
  } catch (e) { next(e); }
});

// Send it to the admin WhatsApp right now: POST /api/daily-digest/2026-10-18/send
router.post('/:date/send', async (req, res, next) => {
  try { res.json({ success: true, data: await digest.sendDigestNow(req.params.date) }); }
  catch (e) { next(e); }
});

module.exports = router;
