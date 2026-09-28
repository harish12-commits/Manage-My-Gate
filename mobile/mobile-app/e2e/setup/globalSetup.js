/**
 * Boots a real backend against an isolated, freshly seeded database and signs every
 * seeded actor in once through the real login endpoint. The login payloads are cached
 * in the fixture so suites can switch actors without tripping the auth rate limiter.
 */
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');
const E2E = require('./constants');
require('./httpNoReuse');

const waitForBackend = async (timeoutMs = 60000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${E2E.apiUrl}/visitor-pass/public/000000`);
      if (res.status > 0) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Backend did not start on port ${E2E.port}. See ${E2E.backendLogFile}`);
};

const login = async (email, password) => {
  const res = await fetch(`${E2E.apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Client-Type': 'APP' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok || !body?.data?.token) {
    throw new Error(`E2E login failed for ${email}: ${res.status} ${body?.message}`);
  }
  return body.data;
};

module.exports = async () => {
  fs.mkdirSync(E2E.cacheDir, { recursive: true });

  try {
    await fetch(`${E2E.apiUrl}/visitor-pass/public/000000`);
    throw new Error(`Port ${E2E.port} is already in use. Stop the process using it before running the E2E suite.`);
  } catch (err) {
    if (String(err.message).startsWith('Port ')) throw err;
  }

  const env = {
    ...process.env,
    PORT: String(E2E.port),
    NODE_ENV: 'test',
    MONGODB_URI: E2E.mongoUri,
  };

  execFileSync(process.execPath, ['tests/e2e/visitor/seedVisitorE2E.mjs', E2E.fixtureFile], {
    cwd: E2E.backendDir,
    env,
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  const logFd = fs.openSync(E2E.backendLogFile, 'w');
  const backend = spawn(process.execPath, ['server.js'], {
    cwd: E2E.backendDir,
    env,
    stdio: ['ignore', logFd, logFd],
  });
  fs.writeFileSync(E2E.backendPidFile, String(backend.pid));
  globalThis.__VISITOR_E2E_BACKEND__ = backend;

  await waitForBackend();

  const fixture = JSON.parse(fs.readFileSync(E2E.fixtureFile, 'utf8'));
  fixture.sessions = {};
  for (const [actor, info] of Object.entries(fixture.actors)) {
    fixture.sessions[actor] = await login(info.email, fixture.password);
  }
  fs.writeFileSync(E2E.fixtureFile, JSON.stringify(fixture, null, 2));
};
