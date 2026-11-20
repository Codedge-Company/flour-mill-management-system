# Advance feature — small edits to existing files

Replace-whole files (copy over): 
- backend/src/models/Payment.js            (adds `source`)
- backend/src/models/CustomerAdvance.js    (NEW)
- backend/src/services/advance.service.js  (NEW)
- backend/src/services/payment.service.js
- backend/src/controllers/customer.controller.js
- backend/src/routes/customer.routes.js

Edit in place (below): payment.controller.js, payment.routes.js, sales.service.js, printer.service.js, dailyDigest.service.js

---------------------------------------------------------------------
## 1. controllers/payment.controller.js  — add at the bottom
```js
exports.applyAdvance = async (req, res, next) => {
  try {
    const data = await paymentService.applyAdvance({ ...req.body, customer_id: req.params.customer_id }, req.user);
    res.json({ success: true, data });
  } catch (e) { next(e); }
};
```

## 2. routes/payment.routes.js — add right under the existing `router.post('/customer/:customer_id', ...)` line
```js
router.post('/customer/:customer_id/apply-advance', authorizeRole('ADMIN'), ctrl.applyAdvance);
```

---------------------------------------------------------------------
## 3. services/sales.service.js

### 3a. imports — under `const Payment = require('../models/Payment');` add
```js
const advanceService = require('./advance.service');
```

### 3b. createSale signature — REPLACE
```js
const createSale = async ({ customer_id, payment_method, sale_datetime, items, use_default_price = false }, user) => {
```
WITH
```js
const createSale = async ({ customer_id, payment_method, sale_datetime, items, use_default_price = false, advance_amount = 0 }, user) => {
```

### 3c. REPLACE
```js
    const total_profit = parseFloat((total_revenue - total_cost).toFixed(2));
    const sale_no = await generateSequence('SALE');
```
WITH
```js
    const total_profit = parseFloat((total_revenue - total_cost).toFixed(2));

    // Using the customer's advance on this sale (CREDIT sales only) - checked BEFORE anything is saved
    const advanceToUse = Number(advance_amount) || 0;
    if (advanceToUse > 0) {
        if (payment_method !== 'CREDIT')
            throw Object.assign(new Error('Advance can only be used on CREDIT sales'), { statusCode: 422 });
        if (advanceToUse > total_revenue + 0.001)
            throw Object.assign(new Error('Advance amount is more than the sale total'), { statusCode: 422 });
        const available = await advanceService.getBalance(customer_id);
        if (advanceToUse > available + 0.001)
            throw Object.assign(new Error(`Advance amount exceeds the customer's advance balance (LKR ${available.toFixed(2)})`), { statusCode: 422 });
    }

    const sale_no = await generateSequence('SALE');
```

### 3d. REPLACE (end of createSale, the return just above `// ── Mark as Paid`)
```js
    return Sale.findById(sale._id)
        .populate('customer_id', 'customer_code name phone')
        .populate('items.pack_type_id', 'pack_name weight_kg');
};

// ── Mark as Paid
```
WITH
```js
    if (advanceToUse > 0) {
        try {
            // lazy require: payment.service is only needed here
            await require('./payment.service').applyAdvance(
                { customer_id, amount: advanceToUse, sale_ids: [sale._id], notifyCustomer: false }, user
            );
        } catch (err) {
            // the sale itself is saved; it simply stays pending and the advance is untouched
            console.error('[Advance] could not apply advance to', sale.sale_no, '-', err.message);
        }
    }

    return Sale.findById(sale._id)
        .populate('customer_id', 'customer_code name phone')
        .populate('items.pack_type_id', 'pack_name weight_kg');
};

// ── Mark as Paid
```

### 3e. cancelSale — REPLACE
```js
    await Payment.deleteMany({ sale_id: id });
    sale.status = 'CANCELLED';
```
WITH
```js
    await advanceService.releaseForSale(id);   // advance used on this sale goes back to the customer
    await Payment.deleteMany({ sale_id: id });
    sale.status = 'CANCELLED';
```

### 3f. remove — REPLACE
```js
    await Payment.deleteMany({ sale_id: id });
    await Sale.findByIdAndDelete(id);
```
WITH
```js
    await advanceService.releaseForSale(id);
    await Payment.deleteMany({ sale_id: id });
    await Sale.findByIdAndDelete(id);
```

---------------------------------------------------------------------
## 4. services/printer.service.js
Replace the WHOLE `function buildReceiptPdfFile(...) { ... }` (from `function buildReceiptPdfFile` down to just before `module.exports`) with the contents of `printer.buildReceiptPdfFile.js`.

---------------------------------------------------------------------
## 5. services/dailyDigest.service.js  (advance paid in = money received; advance USED is not)

### 5a. in `collect()` under `const User = require('../models/User');` add
```js
  const CustomerAdvance = require('../models/CustomerAdvance');
```

### 5b. REPLACE
```js
  const [log, sheet, sales, payments] = await Promise.all([
```
WITH
```js
  const [log, sheet, sales, payments, deposits] = await Promise.all([
```

### 5c. REPLACE
```js
    Payment.find({ payment_date: { $gte: start, $lt: end } })
      .populate('customer_id', 'name').populate('sale_id', 'sale_no').sort({ payment_date: 1 }).lean(),
```
WITH
```js
    Payment.find({ payment_date: { $gte: start, $lt: end }, source: { $ne: 'ADVANCE' } })
      .populate('customer_id', 'name').populate('sale_id', 'sale_no').sort({ payment_date: 1 }).lean(),
    CustomerAdvance.find({ type: 'DEPOSIT', entry_date: { $gte: start, $lt: end } })
      .populate('customer_id', 'name').sort({ entry_date: 1 }).lean(),
```

### 5d. REPLACE the `payments: { ... },` block inside `const data = {`
```js
    payments: {
      list: payments.map((p) => ({
        no: p.payment_no, time: p.payment_date, customer: p.customer_id?.name || '-',
        saleNo: p.sale_id?.sale_no || '-', amount: p.amount || 0,
      })),
      count: payments.length,
      total: sum(payments, (p) => p.amount),
    },
```
WITH
```js
    payments: (() => {
      const list = [
        ...payments.map((p) => ({
          no: p.payment_no, time: p.payment_date, customer: p.customer_id?.name || '-',
          saleNo: p.sale_id?.sale_no || '-', amount: p.amount || 0,
        })),
        ...deposits.map((d) => ({
          no: d.receipt_no, time: d.entry_date, customer: d.customer_id?.name || '-',
          saleNo: 'Advance', amount: d.amount || 0,
        })),
      ].sort((a, b) => new Date(a.time) - new Date(b.time));
      return { list, count: list.length, total: sum(list, (x) => x.amount) };
    })(),
```

### 5e. REPLACE   `section('Payments received (credit sales)');`
WITH            `section('Payments received (credit sales and advances)');`
