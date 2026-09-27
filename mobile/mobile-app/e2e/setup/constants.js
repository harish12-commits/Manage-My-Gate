const path = require('path');

const port = Number(process.env.E2E_BACKEND_PORT || 5099);
const cacheDir = path.resolve(__dirname, '../.cache');

module.exports = {
  port,
  apiUrl: `http://127.0.0.1:${port}/api/v1`,
  socketUrl: `http://127.0.0.1:${port}`,
  mongoUri: process.env.E2E_MONGODB_URI || 'mongodb://127.0.0.1:27017/mmg_visitor_e2e',
  backendDir: path.resolve(__dirname, '../../../../backend'),
  cacheDir,
  fixtureFile: path.join(cacheDir, 'fixture.json'),
  backendLogFile: path.join(cacheDir, 'backend.log'),
  backendPidFile: path.join(cacheDir, 'backend.pid'),
};
