/**
 * Mobile UI → real backend E2E suite for amenity management. Run with
 * `npm run test:e2e:amenity`. Same harness as the visitor suite, isolated on its
 * own port and database (see e2e/setup/constants.js).
 */
process.env.E2E_SUITE = 'amenity';

const visitor = require('./jest.e2e.config');

module.exports = {
  ...visitor,
  testMatch: ['<rootDir>/e2e/amenity/**/*.e2e.test.ts?(x)'],
};
