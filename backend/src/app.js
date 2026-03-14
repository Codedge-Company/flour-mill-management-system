// backend/app.js
require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const routes       = require('./routes/index');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(cors({
  origin: ['http://localhost:4200', 'http://127.0.0.1:4200', 'https://flour-mill-management-system-nine.vercel.app','https://www.matheeshaflourmill.lk'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);
app.get('/', (req, res) => res.json({ message: 'Matheesha Flour Mill API v1.0' }));

app.use(errorHandler);

module.exports = app;   // ← only export, no app.listen() here
