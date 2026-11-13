const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/config');

// admin keeps JWT_EXPIRES_IN (default 7d); other staff stay signed in for 30 days
const STAFF_EXPIRES_IN = process.env.JWT_EXPIRES_IN_STAFF || '30d';

const signToken = (user) =>
    jwt.sign({ user_id: user._id, role: user.role }, JWT_SECRET, {
        expiresIn: user.role === 'ADMIN' ? JWT_EXPIRES_IN : STAFF_EXPIRES_IN,
    });

const login = async ({ username, password }) => {
    const user = await User.findOne({ username });
    if (!user) throw Object.assign(new Error('Invalid username or password'), { statusCode: 401 });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw Object.assign(new Error('Invalid username or password'), { statusCode: 401 });

    const token = signToken(user);
    const { password_hash, ...userData } = user.toObject();
    return { token, user: userData };
};

// New token for an already logged-in user (called when the app opens), so an
// active user never gets logged out.
const refresh = async (user) => ({ token: signToken(user) });

module.exports = { login, refresh };