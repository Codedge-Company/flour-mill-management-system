const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/config');

const login = async ({ username, password }) => {
    const user = await User.findOne({ username });
    if (!user) throw Object.assign(new Error('Invalid username or password'), { statusCode: 401 });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw Object.assign(new Error('Invalid username or password'), { statusCode: 401 });

    const token = jwt.sign({ user_id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const { password_hash, ...userData } = user.toObject();
    return { token, user: userData };
};

module.exports = { login };