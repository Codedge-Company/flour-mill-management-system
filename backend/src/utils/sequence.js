const Counter = require('../models/Counter');

const generateSequence = async (prefix) => {
    const counter = await Counter.findOneAndUpdate(
        { _id: prefix },
        { $inc: { value: 1 } },
        { new: true, upsert: true }
    );
    const padded = String(counter.value).padStart(5, '0');
    return `${prefix}-${padded}`;
};

module.exports = { generateSequence };