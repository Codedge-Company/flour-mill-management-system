const bcrypt = require('bcryptjs');
const User = require('../models/User');

const getAll = () => User.find().select('-password_hash').sort({ created_at: -1 });

const getById = async (id) => {
    const user = await User.findById(id).select('-password_hash');
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    return user;
};

const create = async ({ full_name, username, password, role }) => {
    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({ full_name, username, password_hash, role });
    const { password_hash: _, ...data } = user.toObject();
    return data;
};

const update = async (id, { full_name, username, password, role }) => {
    const user = await User.findById(id);
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    if (full_name) user.full_name = full_name;
    if (username) user.username = username;
    if (role) user.role = role;
    if (password) user.password_hash = await bcrypt.hash(password, 10);
    await user.save();
    const { password_hash, ...data } = user.toObject();
    return data;
};

const remove = async (id) => {
    const user = await User.findByIdAndDelete(id);
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
};

module.exports = { getAll, getById, create, update, remove };