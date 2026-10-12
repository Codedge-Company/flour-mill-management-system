// src/routes/dailySheet.routes.js
// Mount it WITH your existing auth middleware, next to the machine-logs router:
//   app.use('/api/daily-sheet', <yourAuthMiddleware>, require('./routes/dailySheet.routes'));
const router = require('express').Router();
const c = require('../controllers/dailySheet.controller');

// fixed paths first, so "empty-bags" is not read as a :date
router.get('/empty-bags', c.listEmptyBags);
router.put('/empty-bags/:packTypeId', c.setEmptyBags);

router.get('/:date', c.get);                       // load a day
router.put('/:date', c.save);                      // save the whole sheet
router.post('/:date/send-summary', c.sendSummary); // end-of-day WhatsApp

module.exports = router;
