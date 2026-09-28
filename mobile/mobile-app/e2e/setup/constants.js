const path = require('path');

/**
 * Each E2E suite (visitor, amenity) gets its own port, database, seed script and
 * fixture cache so the suites never share state. The suite is chosen by the jest
 * config (`e2e/jest.<suite>.config.js`) through E2E_SUITE.
 */
const SUITES = {
  visitor: { port: 5099, db: 'mmg_visitor_e2e', seed: 'tests/e2e/visitor/seedVisitorE2E.mjs', cache: '.cache' },
  amenity: { port: 5098, db: 'mmg_amenity_e2e', seed: 'tests/e2e/amenity/seedAmenityE2E.mjs', cache: '.cache/amenity' },
};

const suite = process.env.E2E_SUITE || 'visitor';
const cfg = SUITES[suite];
if (!cfg) throw new Error(`Unknown E2E_SUITE "${suite}"`);

const port = Number(process.env.E2E_BACKEND_PORT || cfg.port);
const cacheDir = path.resolve(__dirname, '..', cfg.cache);

module.exports = {
  suite,
  port,
  apiUrl: `http://127.0.0.1:${port}/api/v1`,
  apiV2Url: `http://127.0.0.1:${port}/api/v2`,
  socketUrl: `http://127.0.0.1:${port}`,
  mongoUri: process.env.E2E_MONGODB_URI || `mongodb://127.0.0.1:27017/${cfg.db}`,
  backendDir: path.resolve(__dirname, '../../../../backend'),
  seedScript: cfg.seed,
  cacheDir,
  fixtureFile: path.join(cacheDir, 'fixture.json'),
  backendLogFile: path.join(cacheDir, 'backend.log'),
  backendPidFile: path.join(cacheDir, 'backend.pid'),
};
