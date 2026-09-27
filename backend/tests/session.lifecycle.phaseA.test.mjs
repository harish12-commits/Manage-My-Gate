import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

import app from '../index.js';
import config from '../src/config/config.js';
import User from '../src/features/user/user.model.js';
import Session from '../src/features/session/session.model.js';
import sessionService from '../src/features/session/session.services.js';
import { signToken } from '../src/utils/jwt.utils.js';

describe('NAHOM Phase A — Session Lifecycle & Community-Based Route Integration Tests', () => {
  let server;
  let baseUrl;
  let port;

  let userA;
  let userB;
  let inactiveUser;

  let tokenUserA;
  let tokenUserB;
  let tokenInactiveUser;

  let sessionA1;
  let sessionA2;
  let sessionB1;

  before(async () => {
    try {
      const mongoUri = config.mongodb?.uri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/manage_my_gate_dev';
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(mongoUri);
      }

      // Spin up ephemeral test HTTP server using the real Express app instance
      server = http.createServer(app);
      await new Promise((resolve) => server.listen(0, resolve));
      port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;

    const timestamp = Date.now();

    // Seed test users (community-based users)
    userA = await User.create({
      email: `session_user_a_${timestamp}@test.com`,
      username: `session_a_${timestamp}`,
      password: 'HashedPassword123!',
      status: 'Active',
      role: 'Resident',
    });

    userB = await User.create({
      email: `session_user_b_${timestamp}@test.com`,
      username: `session_b_${timestamp}`,
      password: 'HashedPassword123!',
      status: 'Active',
      role: 'Resident',
    });

    inactiveUser = await User.create({
      email: `session_inactive_${timestamp}@test.com`,
      username: `session_inactive_${timestamp}`,
      password: 'HashedPassword123!',
      status: 'Suspended',
      role: 'Resident',
    });

    // Generate JWT tokens
    tokenUserA = signToken({ id: userA._id, email: userA.email, role: userA.role });
    tokenUserB = signToken({ id: userB._id, email: userB.email, role: userB.role });
    tokenInactiveUser = signToken({ id: inactiveUser._id, email: inactiveUser.email, role: inactiveUser.role });
    } catch(err) {
      console.error('ERROR IN BEFORE HOOK:', err);
      throw err;
    }
  });

  after(async () => {
    // Cleanup seeded test records
    try {
      if (userA) {
        await User.deleteOne({ _id: userA._id });
        await Session.deleteMany({ userId: userA._id });
      }
      if (userB) {
        await User.deleteOne({ _id: userB._id });
        await Session.deleteMany({ userId: userB._id });
      }
      if (inactiveUser) {
        await User.deleteOne({ _id: inactiveUser._id });
        await Session.deleteMany({ userId: inactiveUser._id });
      }
    } catch (e) {
      // ignore cleanup errors
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('1. Authentication & Security Middleware Boundaries', () => {
    it('should reject unauthenticated requests to GET /api/v1/session with 401', async () => {
      const res = await fetch(`${baseUrl}/api/v1/session`);
      const body = await res.json();

      assert.equal(res.status, 401);
      assert.equal(body.success, false);
      assert.match(body.message, /Access denied|token/i);
    });

    it('should reject requests with an invalid/forged JWT token with 401', async () => {
      const res = await fetch(`${baseUrl}/api/v1/session`, {
        headers: { Authorization: 'Bearer invalid.token.payload' },
      });
      const body = await res.json();

      assert.equal(res.status, 401);
      assert.equal(body.success, false);
      assert.match(body.message, /Invalid|token/i);
    });

    it('should reject requests from an inactive user account with 401', async () => {
      const res = await fetch(`${baseUrl}/api/v1/session`, {
        headers: { Authorization: `Bearer ${tokenInactiveUser}` },
      });
      const body = await res.json();

      assert.equal(res.status, 401);
      assert.equal(body.success, false);
      assert.match(body.message, /inactive/i);
    });
  });

  describe('2. Session Retrieval & Route Mounting Verification', () => {
    it('should seed sessions for User A and User B', async () => {
      await sessionService.createSession(userA._id, {
        deviceName: 'Pixel 9 Pro',
        browser: 'Mobile Safari',
        os: 'Android 15',
        ipAddress: '192.168.1.100',
      });

      await sessionService.createSession(userA._id, {
        deviceName: 'MacBook Pro M3',
        browser: 'Chrome 128',
        os: 'macOS 15',
        ipAddress: '192.168.1.101',
      });

      await sessionService.createSession(userB._id, {
        deviceName: 'iPhone 16 Pro',
        browser: 'Mobile Safari',
        os: 'iOS 18',
        ipAddress: '192.168.2.200',
      });

      const sessionsA = await Session.find({ userId: userA._id, status: 'Active' });
      assert.equal(sessionsA.length, 2);
      sessionA1 = sessionsA[0];
      sessionA2 = sessionsA[1];

      const sessionsB = await Session.find({ userId: userB._id, status: 'Active' });
      assert.equal(sessionsB.length, 1);
      sessionB1 = sessionsB[0];
    });

    it('should retrieve active sessions via GET /api/v1/session', async () => {
      const res = await fetch(`${baseUrl}/api/v1/session`, {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.sessions));
      assert.equal(body.sessions.length, 2);
      assert.ok(Array.isArray(body.data), 'body.data should mirror sessions for standard responseHandler');

      // Verify privacy: hashed refreshToken must NEVER be exposed to client
      assert.equal(body.sessions[0].refreshToken, undefined);
      assert.equal(body.sessions[1].refreshToken, undefined);
    });

    it('should support plural route alias GET /api/v1/sessions', async () => {
      const res = await fetch(`${baseUrl}/api/v1/sessions`, {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.sessions.length, 2);
    });

    it('should support un-versioned root route GET /api/session', async () => {
      const res = await fetch(`${baseUrl}/api/session`, {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.sessions.length, 2);
    });
  });

  describe('3. Session Revocation & Access Control Boundaries', () => {
    it('should reject malformed session ID format with 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/session/not-a-valid-id`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.equal(body.success, false);
      assert.match(body.message, /invalid.*id/i);
    });

    it('should return 404 when attempting to revoke non-existent session ID', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await fetch(`${baseUrl}/api/v1/session/${fakeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      const body = await res.json();

      assert.equal(res.status, 404);
      assert.equal(body.success, false);
      assert.match(body.message, /not found/i);
    });

    it('should prevent User A from revoking User B session (cross-user boundary)', async () => {
      // User A attempts to delete session belonging to User B
      const res = await fetch(`${baseUrl}/api/v1/session/${sessionB1._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      const body = await res.json();

      // Must fail with 404 because session does not exist under User A's ownership
      assert.equal(res.status, 404);
      assert.equal(body.success, false);

      // Verify User B session remains Active in database
      const freshB = await Session.findById(sessionB1._id);
      assert.equal(freshB.status, 'Active');
    });

    it('should successfully revoke own session via DELETE /api/v1/session/:id', async () => {
      const res = await fetch(`${baseUrl}/api/v1/session/${sessionA1._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.match(body.message, /revoked successfully/i);

      // Verify DB state
      const updated = await Session.findById(sessionA1._id);
      assert.equal(updated.status, 'Revoked');

      // Verify GET /session now only returns 1 active session
      const listRes = await fetch(`${baseUrl}/api/v1/session`, {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      const listBody = await listRes.json();
      assert.equal(listBody.sessions.length, 1);
      assert.equal(listBody.sessions[0]._id.toString(), sessionA2._id.toString());
    });

    it('should successfully revoke all active sessions via DELETE /api/v1/session/all', async () => {
      const res = await fetch(`${baseUrl}/api/v1/session/all`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.match(body.message, /all sessions revoked/i);

      // Verify GET /session returns 0 active sessions for User A
      const listRes = await fetch(`${baseUrl}/api/v1/session`, {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      const listBody = await listRes.json();
      assert.equal(listBody.sessions.length, 0);

      // Verify User B's active session is STILL ACTIVE (isolation preserved)
      const listBRes = await fetch(`${baseUrl}/api/v1/session`, {
        headers: { Authorization: `Bearer ${tokenUserB}` },
      });
      const listBBody = await listBRes.json();
      assert.equal(listBBody.sessions.length, 1);
      assert.equal(listBBody.sessions[0]._id.toString(), sessionB1._id.toString());
    });
  });

  describe('4. Community Architecture & Zero-Tenant Invariance', () => {
    it('should verify requests succeed without any x-tenant-id or tenant context headers', async () => {
      // Re-create a session for User A
      await sessionService.createSession(userA._id, { deviceName: 'Clean Community Device' });

      // Request without any tenant headers
      const res = await fetch(`${baseUrl}/api/v1/session`, {
        headers: {
          Authorization: `Bearer ${tokenUserA}`,
        },
      });
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.sessions.length, 1);
      assert.equal(body.sessions[0].deviceName, 'Clean Community Device');
    });
  });
});
