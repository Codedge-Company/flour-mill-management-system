const express = require('express');
const cors = require('cors');
const routes = require('./routes/index');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('/', (req, res) => res.json({ message: 'Matheesha Flour Mill API is running' }));

app.use(errorHandler);

module.exports = app;