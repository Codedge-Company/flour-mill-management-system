const errorHandler = (err, req, res, next) => {
    console.error(`[ERROR] ${err.message}`);

    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(409).json({ success: false, message: `Duplicate value for field: ${field}` });
    }
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(e => e.message).join(', ');
        return res.status(422).json({ success: false, message });
    }
    if (err.name === 'CastError') {
        return res.status(400).json({ success: false, message: `Invalid ID format` });
    }

    const status = err.statusCode || 500;
    res.status(status).json({ success: false, message: err.message || 'Internal server error' });
};

module.exports = errorHandler;