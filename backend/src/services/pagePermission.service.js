const PagePermission = require('../models/PagePermission');
const { PAGES } = require('../constants/pages');

const ROLES = ['ADMIN', 'SALES', 'MACHINE_OPERATOR', 'PACKING_OPERATOR'];

const getAll = async () => {
    const existing = await PagePermission.find();
    const map = new Map(existing.map(p => [p.role, p]));

    const results = [];
    for (const role of ROLES) {
        let doc = map.get(role);
        if (!doc) {
            const defaultPages = role === 'ADMIN' ? PAGES.map(p => p.key) : [];
            doc = await PagePermission.create({ role, pages: defaultPages });
        }
        results.push(doc);
    }
    return results;
};

const updateMatrix = async (matrix) => {
    // matrix: [{ role, pages: [] }, ...]
    const ops = matrix.map(({ role, pages }) => ({
        updateOne: { filter: { role }, update: { $set: { pages } }, upsert: true },
    }));
    await PagePermission.bulkWrite(ops);
    return getAll();
};

const getByRole = async (role) => {
    if (role === 'ADMIN') return PAGES.map(p => p.key);
    const doc = await PagePermission.findOne({ role });
    return doc ? doc.pages : [];
};

module.exports = { getAll, updateMatrix, getByRole, PAGES };