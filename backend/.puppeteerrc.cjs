const { join } = require('path');

module.exports = {
  // We manage Chrome ourselves via `@puppeteer/browsers` in the postinstall script
  skipDownload: true,
};