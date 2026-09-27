const fs = require('fs');
const E2E = require('./constants');

module.exports = async () => {
  const backend = globalThis.__VISITOR_E2E_BACKEND__;
  if (backend && backend.exitCode === null) {
    backend.kill();
    return;
  }
  if (fs.existsSync(E2E.backendPidFile)) {
    const pid = Number(fs.readFileSync(E2E.backendPidFile, 'utf8'));
    try {
      process.kill(pid);
    } catch {
      // already stopped
    }
  }
};
