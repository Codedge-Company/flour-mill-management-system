require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes/index');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// CORS
app.use(cors({
  origin: ['http://localhost:4200', 'http://127.0.0.1:4200'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);
app.get('/', (req, res) => res.json({ message: 'Matheesha Flour Mill API v1.0' }));

// Error handler last
app.use(errorHandler);

module.exports = app;