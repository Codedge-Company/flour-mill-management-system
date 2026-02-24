const { generateSequence } = require('./sequence');

const generateCustomerId = async () => generateSequence('CUS');

module.exports = { generateCustomerId };