/**
 * Mobile UI → real backend E2E suite. Run with `npm run test:e2e:visitor`.
 * Only native boundaries (router, camera, secure storage, safe area) are mocked;
 * the Redux store, thunks, apiClient and socket client are the real app code.
 */
const base = require('../package.json').jest;

module.exports = {
  ...base,
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/visitor/**/*.e2e.test.ts?(x)'],
  testPathIgnorePatterns: ['/node_modules/'],
  setupFiles: ['<rootDir>/e2e/setup/env.js'],
  setupFilesAfterEnv: [...base.setupFilesAfterEnv, '<rootDir>/e2e/setup/afterEnv.tsx'],
  globalSetup: '<rootDir>/e2e/setup/globalSetup.js',
  globalTeardown: '<rootDir>/e2e/setup/globalTeardown.js',
  testTimeout: 60000,
  maxWorkers: 1,
};
