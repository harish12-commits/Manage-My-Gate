import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import crypto from 'crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

import app from '../index.js';
import config from '../src/config/config.js';
import User from '../src/features/user/user.model.js';
import Organization from '../src/features/organization/organization.model.js';

import {
  AmenityFacility,
  AmenityResource,
  AmenitySlotAllocation,
  AmenityAllocationLedger,
  AmenityReservationHold,
  AmenityReservation,
  AmenityQuotaAllocation,
  AmenityAccessPass,
  AmenityMaintenanceBlock,
  AmenityOutboxEvent,
  AmenityIdempotencyRecord,
  AmenityCounter,
} from '../src/features/amenityManagement/index.js';

// Legacy models to ensure isolation
import LegacyAmenity from '../src/features/amenity/amenity.model.js';
import LegacyAmenityBooking from '../src/features/amenityBooking/amenityBooking.model.js';
import LegacyBooking from '../src/features/booking/booking.model.js';

describe('Amenity Management Phase 4C — API Layer Integration Suite', () => {
  let server;
  let baseUrl;

  let testOrg;
  let otherOrg;
  let adminUser;
  let residentUser;
  let residentBUser;
  let otherOrgUser;
  let otherOrgAdminUser;

  let adminToken;
  let residentToken;
  let residentBToken;
  let otherOrgToken;
  let otherOrgAdminToken;
  let noOrgToken;

  function signWebhookPayload(payload) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'default_webhook_secret_key';
    return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  }

  before(async () => {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    // Spin up ephemeral HTTP server
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api/v2/amenity-management`;

    // 1. Seed Test Organizations
    testOrg = await Organization.create({
      name: `Test Org 4C ${Date.now()}`,
      organizationType: 'Residential',
      status: 'Active',
      timezone: 'UTC',
    });

    otherOrg = await Organization.create({
      name: `Other Org 4C ${Date.now()}`,
      organizationType: 'Residential',
      status: 'Active',
      timezone: 'UTC',
    });

    // 2. Seed Test Users
    const timestamp = Date.now();
    adminUser = await User.create({
      email: `admin4c_${timestamp}@test.com`,
      username: `admin4c_${timestamp}`,
      password: 'hashedpassword123',
      status: 'Active',
      role: 'Community Admin',
    });

    // 2b. Seed Resident Role and Amenity Discovery/Booking Permissions
    const Role = (await import('../src/features/role/role.model.js')).default;
    const Permission = (await import('../src/features/permission/permission.model.js')).default;
    const RolePermission = (await import('../src/features/rolePermission/rolePermission.model.js')).default;

    const residentRole = await Role.create({
      name: 'Resident',
      description: 'Resident Role for testing',
      orgId: testOrg._id,
    });

    let permDiscover = await Permission.findOne({ name: 'amenities:discover' });
    if (!permDiscover) {
      permDiscover = await Permission.create({ feature: 'amenities', action: 'discover', name: 'amenities:discover' });
    }
    let permBooking = await Permission.findOne({ name: 'amenities:my_booking' });
    if (!permBooking) {
      permBooking = await Permission.create({ feature: 'amenities', action: 'my_booking', name: 'amenities:my_booking' });
    }

    await RolePermission.create([
      { roleId: residentRole._id, permissionId: permDiscover._id },
      { roleId: residentRole._id, permissionId: permBooking._id },
    ]);

    residentUser = await User.create({
      email: `resident4c_${timestamp}@test.com`,
      username: `resident4c_${timestamp}`,
      password: 'hashedpassword123',
      status: 'Active',
      role: 'Resident',
    });

    residentBUser = await User.create({
      email: `residentB4c_${timestamp}@test.com`,
      username: `residentB4c_${timestamp}`,
      password: 'hashedpassword123',
      status: 'Active',
      role: 'Resident',
    });

    otherOrgUser = await User.create({
      email: `other4c_${timestamp}@test.com`,
      username: `other4c_${timestamp}`,
      password: 'hashedpassword123',
      status: 'Active',
      role: 'Resident',
    });

    otherOrgAdminUser = await User.create({
      email: `otheradmin4c_${timestamp}@test.com`,
      username: `otheradmin4c_${timestamp}`,
      password: 'hashedpassword123',
      status: 'Active',
      role: 'Community Admin',
    });

    // 3. Generate Signed JWTs
    adminToken = jwt.sign(
      { id: adminUser._id.toString(), email: adminUser.email, role: 'Community Admin', orgId: testOrg._id.toString() },
      config.jwt.secret,
      { expiresIn: '2h' }
    );

    residentToken = jwt.sign(
      {
        id: residentUser._id.toString(),
        email: residentUser.email,
        role: 'Resident',
        roleId: residentRole._id.toString(),
        orgId: testOrg._id.toString(),
      },
      config.jwt.secret,
      { expiresIn: '2h' }
    );

    residentBToken = jwt.sign(
      {
        id: residentBUser._id.toString(),
        email: residentBUser.email,
        role: 'Resident',
        roleId: residentRole._id.toString(),
        orgId: testOrg._id.toString(),
      },
      config.jwt.secret,
      { expiresIn: '2h' }
    );

    otherOrgToken = jwt.sign(
      { id: otherOrgUser._id.toString(), email: otherOrgUser.email, role: 'Resident', orgId: otherOrg._id.toString() },
      config.jwt.secret,
      { expiresIn: '2h' }
    );

    otherOrgAdminToken = jwt.sign(
      { id: otherOrgAdminUser._id.toString(), email: otherOrgAdminUser.email, role: 'Community Admin', orgId: otherOrg._id.toString() },
      config.jwt.secret,
      { expiresIn: '2h' }
    );

    noOrgToken = jwt.sign(
      { id: residentUser._id.toString(), email: residentUser.email, role: 'Resident', roleId: residentRole._id.toString() },
      config.jwt.secret,
      { expiresIn: '2h' }
    );
  });

  after(async () => {
    // Close HTTP server
    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
    }

    // Clean up created entities
    const orgIds = [testOrg._id, otherOrg._id];
    await Promise.all([
      AmenityFacility.deleteMany({ orgId: { $in: orgIds } }),
      AmenityResource.deleteMany({ orgId: { $in: orgIds } }),
      AmenitySlotAllocation.deleteMany({ orgId: { $in: orgIds } }),
      AmenityAllocationLedger.deleteMany({ orgId: { $in: orgIds } }),
      AmenityReservationHold.deleteMany({ orgId: { $in: orgIds } }),
      AmenityReservation.deleteMany({ orgId: { $in: orgIds } }),
      AmenityQuotaAllocation.deleteMany({ orgId: { $in: orgIds } }),
      AmenityAccessPass.deleteMany({ orgId: { $in: orgIds } }),
      AmenityMaintenanceBlock.deleteMany({ orgId: { $in: orgIds } }),
      AmenityOutboxEvent.deleteMany({ orgId: { $in: orgIds } }),
      AmenityIdempotencyRecord.deleteMany({ orgId: { $in: orgIds } }),
      AmenityCounter.deleteMany({ orgId: { $in: orgIds } }),
      Organization.deleteMany({ _id: { $in: orgIds } }),
      User.deleteMany({ _id: { $in: [adminUser._id, residentUser._id, residentBUser._id, otherOrgUser._id, otherOrgAdminUser._id] } }),
    ]);

    await mongoose.disconnect();
  });

  // Shared variables between test steps
  let sharedFacilityId;
  let sharedResourceId;
  let eventFacilityId;
  let createdHoldId;
  let createdReservationId;
  let accessPassToken;
  let eventResvId;
  let maintenanceBlockId;

  // =========================================================================
  // 1. Authentication & Security Middleware
  // =========================================================================
  describe('1. Authentication & Correlation ID Handling', () => {
    it('unauthenticated request should be rejected with 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/facilities`);
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.success, false);
    });

    it('authenticated request should propagate X-Request-ID and succeed', async () => {
      const customRequestId = `req-test-${Date.now()}`;
      const res = await fetch(`${baseUrl}/facilities`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'x-organization-id': testOrg._id.toString(),
          'x-request-id': customRequestId,
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-request-id'), customRequestId);
      const body = await res.json();
      assert.equal(body.success, true);
    });
  });

  // =========================================================================
  // 2. Tenant Isolation & RBAC Protection
  // =========================================================================
  describe('2. Tenant Isolation & RBAC Protection', () => {
    it('request without tenant context header should fail with 400 or 403', async () => {
      // Missing tenant context in both token and header -> 400
      const resNoOrg = await fetch(`${baseUrl}/facilities`, {
        headers: {
          Authorization: `Bearer ${noOrgToken}`,
        },
      });
      assert.equal(resNoOrg.status, 400);

      // Cross-tenant access attempt to foreign org -> 403
      const resCrossTenant = await fetch(`${baseUrl}/facilities`, {
        headers: {
          Authorization: `Bearer ${residentToken}`,
          'x-organization-id': otherOrg._id.toString(),
        },
      });
      assert.equal(resCrossTenant.status, 403);
    });

    it('resident user should be forbidden (403) from creating facility without admin permissions', async () => {
      const res = await fetch(`${baseUrl}/facilities`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${residentToken}`,
          'x-organization-id': testOrg._id.toString(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Unauthorized Gym',
          code: 'UNAUTH-GYM',
          archetype: 'SHARED_CAPACITY',
        }),
      });

      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.success, false);
    });
  });

  // =========================================================================
  // 3. Validation Layer Enforcement
  // =========================================================================
  describe('3. Validation Layer & Error Middleware', () => {
    it('should reject invalid body with 400 and detailed validation errors', async () => {
      const res = await fetch(`${baseUrl}/facilities`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'x-organization-id': testOrg._id.toString(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Missing required name, code, archetype
          description: 'Malformed payload',
        }),
      });

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.ok(Array.isArray(body.details));
      assert.ok(body.details.some((e) => e.field === 'name'));
    });

    it('should reject invalid MongoID path param with 400', async () => {
      const res = await fetch(`${baseUrl}/facilities/invalid-mongo-id-123`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'x-organization-id': testOrg._id.toString(),
        },
      });

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.success, false);
    });
  });

  // =========================================================================
  // 4. Facility Endpoints CRUD
  // =========================================================================
  describe('4. Facility Endpoints CRUD', () => {
    it('should create an amenity facility (POST /facilities)', async () => {
      const facilityPayload = {
        name: 'Olympic Swimming Pool',
        code: `POOL-${Date.now().toString().slice(-4)}`,
        archetype: 'SHARED_CAPACITY',
        maxCapacity: 25,
        pricingConfig: {
          pricingType: 'HOURLY',
          baseRate: 150,
          taxPercentage: 18,
          securityDeposit: 200,
          currency: 'INR',
        },
      };

      const res = await fetch(`${baseUrl}/facilities`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'x-organization-id': testOrg._id.toString(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(facilityPayload),
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.name, 'Olympic Swimming Pool');
      assert.equal(body.data.archetype, 'SHARED_CAPACITY');
      sharedFacilityId = body.data._id;
    });

    it('should create an event space facility with approval workflow', async () => {
      const eventPayload = {
        name: 'Grand Banquet Lawn',
        code: `LAWN-${Date.now().toString().slice(-4)}`,
        archetype: 'EVENT_SPACE',
        maxCapacity: 200,
        requiresApproval: true,
        pricingConfig: {
          pricingType: 'FIXED_EVENT',
          baseRate: 10000,
          taxPercentage: 18,
          securityDeposit: 5000,
          currency: 'INR',
        },
        approvalWorkflow: {
          requireAdminApproval: true,
          approvalTimeoutHours: 48,
          depositRequired: true,
        },
      };

      const res = await fetch(`${baseUrl}/facilities`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'x-organization-id': testOrg._id.toString(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventPayload),
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.success, true);
      eventFacilityId = body.data._id;
    });

    it('should list facilities with pagination (GET /facilities)', async () => {
      const res = await fetch(`${baseUrl}/facilities?page=1&limit=5`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'x-organization-id': testOrg._id.toString(),
        },
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data.data));
      assert.ok(body.data.total >= 2);
      assert.equal(body.data.page, 1);
      assert.equal(body.data.limit, 5);
      assert.ok(body.data.totalPages >= 1);
    });

    it('should retrieve single facility by ID (GET /facilities/:facilityId)', async () => {
      const res = await fetch(`${baseUrl}/facilities/${sharedFacilityId}`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'x-organization-id': testOrg._id.toString(),
        },
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data._id, sharedFacilityId);
    });

    it('should update facility details (PATCH /facilities/:facilityId)', async () => {
      const res = await fetch(`${baseUrl}/facilities/${sharedFacilityId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'x-organization-id': testOrg._id.toString(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: 'Heated indoor swimming pool',
          maxCapacity: 30,
        }),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data.description, 'Heated indoor swimming pool');
      assert.equal(body.data.maxCapacity, 30);
    });
  });

  // =========================================================================
  // 5. Resource Endpoints CRUD
  // =========================================================================
  describe('5. Resource Endpoints CRUD', () => {
    it('should create a sub-resource under facility (POST /resources)', async () => {
      const resourcePayload = {
        facilityId: sharedFacilityId,
        name: 'Lane 1 (Lap Swimming)',
        code: 'LANE-1',
        identifier: 'LANE-1',
        resourceType: 'LANE',
        setupBufferMinutes: 10,
        teardownBufferMinutes: 10,
        slotDurationMinutes: 60,
      };

      const res = await fetch(`${baseUrl}/resources`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'x-organization-id': testOrg._id.toString(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resourcePayload),
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.name, 'Lane 1 (Lap Swimming)');
      sharedResourceId = body.data._id;
    });

    it('should list resources for facility (GET /resources/facility/:facilityId)', async () => {
      const res = await fetch(`${baseUrl}/resources/facility/${sharedFacilityId}`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'x-organization-id': testOrg._id.toString(),
        },
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(Array.isArray(body.data));
      assert.equal(body.data[0]._id, sharedResourceId);
    });

    it('should update resource (PATCH /resources/:resourceId)', async () => {
      const res = await fetch(`${baseUrl}/resources/${sharedResourceId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'x-organization-id': testOrg._id.toString(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          setupBufferMinutes: 15,
        }),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data.setupBufferMinutes, 15);
    });
  });

  // =========================================================================
  // 6. Availability & Pricing Endpoints
  // =========================================================================
  describe('6. Availability & Pricing Domain Endpoints', () => {
    it('should check archetype-aware availability (GET /availability)', async () => {
      const start = new Date(Date.now() + 86400000); // tomorrow
      const end = new Date(start.getTime() + 3600000);

      const params = new URLSearchParams({
        facilityId: sharedFacilityId,
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
        requestedQuantity: '2',
      });

      const res = await fetch(`${baseUrl}/availability?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${residentToken}`,
          'x-organization-id': testOrg._id.toString(),
        },
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.isAvailable, true);
      assert.ok(body.data.maxCapacity >= 25);
    });

    it('should reject invalid time range in availability check with 400', async () => {
      const start = new Date(Date.now() + 86400000);
      const end = new Date(start.getTime() - 3600000); // end before start!

      const params = new URLSearchParams({
        facilityId: sharedFacilityId,
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
      });

      const res = await fetch(`${baseUrl}/availability?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${residentToken}`,
          'x-organization-id': testOrg._id.toString(),
        },
      });

      assert.equal(res.status, 400);
    });

    it('should calculate pricing snapshot (POST /pricing/calculate)', async () => {
      const start = new Date(Date.now() + 86400000);
      const end = new Date(start.getTime() + 7200000); // 2 hours

      const res = await fetch(`${baseUrl}/pricing/calculate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${residentToken}`,
          'x-organization-id': testOrg._id.toString(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          facilityId: sharedFacilityId,
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
          headcount: 2,
        }),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(body.data.totalAmount > 0);
      assert.equal(body.data.currency, 'INR');
    });
  });

  // =========================================================================
  // 7. Ephemeral Holds & Idempotency
  // =========================================================================
  describe('7. Ephemeral Holds & Idempotency Protection', () => {
    it('should create an ephemeral hold with Idempotency header (POST /holds)', async () => {
      const start = new Date(Date.now() + 172800000); // in 2 days
      const end = new Date(start.getTime() + 3600000);
      const idempotencyKey = `HOLD-IDEMP-${Date.now()}`;

      const payload = {
        facilityId: sharedFacilityId,
        requestedStartDateTime: start.toISOString(),
        requestedEndDateTime: end.toISOString(),
        headcount: 2,
      };

      const res1 = await fetch(`${baseUrl}/holds`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${residentToken}`,
          'x-organization-id': testOrg._id.toString(),
          'Content-Type': 'application/json',
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      assert.equal(res1.status, 201);
      const body1 = await res1.json();
      assert.equal(body1.success, true);
      assert.ok(body1.data.hold._id);
      createdHoldId = body1.data.hold._id;

      // Repeat request with exact same idempotency key and payload -> must replay cached response
      const res2 = await fetch(`${baseUrl}/holds`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${residentToken}`,
          'x-organization-id': testOrg._id.toString(),
          'Content-Type': 'application/json',
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      assert.equal(res2.status, 201);
      const body2 = await res2.json();
      assert.equal(body2.data.hold._id, createdHoldId);

      // Repeat request with same idempotency key but modified payload -> must reject with 409 Conflict
      const res3 = await fetch(`${baseUrl}/holds`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${residentToken}`,
          'x-organization-id': testOrg._id.toString(),
          'Content-Type': 'application/json',
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({ ...payload, headcount: 10 }),
      });

      assert.equal(res3.status, 409);
    });

    it('should retrieve hold details (GET /holds/:holdId)', async () => {
      const res = await fetch(`${baseUrl}/holds/${createdHoldId}`, {
        headers: {
          Authorization: `Bearer ${residentToken}`,
          'x-organization-id': testOrg._id.toString(),
        },
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data._id, createdHoldId);
      assert.equal(body.data.status, 'ACTIVE');
    });
  });

  // =========================================================================
  // 8. Reservation Lifecycle (Confirm, Numbering, Cancel)
  // =========================================================================
  describe('8. Reservation Lifecycle & Confirmation', () => {
    it('should confirm reservation from hold with RES-YYYYMM-000001 sequence (POST /reservations/confirm)', async () => {
      const res = await fetch(`${baseUrl}/reservations/confirm`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${residentToken}`,
          'x-organization-id': testOrg._id.toString(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          holdId: createdHoldId,
          paymentReference: 'PAY-REF-API-101',
          notes: 'Weekend morning swim',
        }),
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.reservation.bookingStatus, 'CONFIRMED');
      assert.equal(body.data.reservation.paymentStatus, 'PAID');
      assert.match(body.data.reservation.reservationNumber, /^RES-\d{6}-\d{6}$/);
      assert.ok(body.data.rawToken); // pass raw token returned
      createdReservationId = body.data.reservation._id;
      accessPassToken = body.data.rawToken;
    });

    it('should retrieve reservation by sequential human number (GET /reservations/number/:resNo)', async () => {
      const resv = await AmenityReservation.findById(createdReservationId);
      const res = await fetch(`${baseUrl}/reservations/number/${resv.reservationNumber}`, {
        headers: {
          Authorization: `Bearer ${residentToken}`,
          'x-organization-id': testOrg._id.toString(),
        },
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data._id, createdReservationId);
    });

    it('should cancel confirmed reservation and release allocations (POST /reservations/:id/cancel)', async () => {
      const res = await fetch(`${baseUrl}/reservations/${createdReservationId}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${residentToken}`,
          'x-organization-id': testOrg._id.toString(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'Change of travel plans',
        }),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data.bookingStatus, 'CANCELLED');
    });
  });

  // =========================================================================
  // 9. Maker-Checker Event Approval Invariant
  // =========================================================================
  describe('9. Maker-Checker Event Approval Invariant', () => {
    let eventHoldId;

    it('should create event hold and pending approval reservation', async () => {
      const start = new Date(Date.now() + 259200000); // in 3 days
      const end = new Date(start.getTime() + 14400000); // 4 hours

      // 1. Create Hold
      const holdRes = await fetch(`${baseUrl}/holds`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${residentToken}`,
          'x-organization-id': testOrg._id.toString(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          facilityId: eventFacilityId,
          requestedStartDateTime: start.toISOString(),
          requestedEndDateTime: end.toISOString(),
          headcount: 50,
          holdType: 'ADMIN_REVIEW',
        }),
      });
      assert.equal(holdRes.status, 201);
      const holdBody = await holdRes.json();
      eventHoldId = holdBody.data.hold._id;

      // 2. Confirm into PENDING_APPROVAL
      const confRes = await fetch(`${baseUrl}/reservations/confirm`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${residentToken}`,
          'x-organization-id': testOrg._id.toString(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          holdId: eventHoldId,
          notes: 'Community birthday party',
        }),
      });

      assert.equal(confRes.status, 201);
      const confBody = await confRes.json();
      assert.equal(confBody.data.reservation.bookingStatus, 'PENDING_APPROVAL');
      assert.equal(confBody.data.reservation.approvalStatus, 'PENDING_REVIEW');
      assert.equal(confBody.data.reservation.accessStatus, 'NOT_APPLICABLE');
      assert.ok(!confBody.data.pass); // NO pass generated
      eventResvId = confBody.data.reservation._id;
    });

    it('CRITICAL INVARIANT: admin approval alone MUST NOT generate pass when payment is pending', async () => {
      const reviewRes = await fetch(`${baseUrl}/reservations/${eventResvId}/review`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'x-organization-id': testOrg._id.toString(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'APPROVE',
        }),
      });

      assert.equal(reviewRes.status, 200);
      const reviewBody = await reviewRes.json();
      assert.equal(reviewBody.data.approvalStatus, 'APPROVED');
      assert.equal(reviewBody.data.paymentStatus, 'PENDING');
      assert.equal(reviewBody.data.bookingStatus, 'PENDING_APPROVAL');
      assert.equal(reviewBody.data.accessStatus, 'NOT_APPLICABLE');

      // Verify NO passes exist in DB
      const passes = await AmenityAccessPass.find({ reservationId: eventResvId });
      assert.equal(passes.length, 0);
    });

    it('payment webhook on approved reservation confirms booking and issues access pass', async () => {
      const payload = {
        orgId: testOrg._id.toString(),
        reservationId: eventResvId,
        paymentReference: 'GATEWAY-TXN-EVENT-999',
        status: 'PAID',
        paymentAmount: 11800,
      };
      const signature = signWebhookPayload(payload);
      const webhookRes = await fetch(`${baseUrl}/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signature,
        },
        body: JSON.stringify(payload),
      });

      assert.equal(webhookRes.status, 200);
      const webhookBody = await webhookRes.json();
      assert.equal(webhookBody.data.reservation.bookingStatus, 'CONFIRMED');
      assert.equal(webhookBody.data.reservation.paymentStatus, 'PAID');
      assert.equal(webhookBody.data.reservation.accessStatus, 'PASS_GENERATED');
      assert.ok(webhookBody.data.pass);
      assert.ok(webhookBody.data.rawToken);
    });
  });

  // =========================================================================
  // 10. Late Payment Webhook Invariant (No Resurrection)
  // =========================================================================
  describe('10. Late Payment Webhook Invariant', () => {
    it('CRITICAL INVARIANT: late payment on expired hold schedules refund without resurrection', async () => {
      // 1. Create a hold with past requested time
      const deadHold = await AmenityReservationHold.create({
        orgId: testOrg._id,
        facilityId: sharedFacilityId,
        residentId: residentUser._id,
        unitId: new mongoose.Types.ObjectId(),
        requestedStartDateTime: new Date(Date.now() - 3600000),
        requestedEndDateTime: new Date(Date.now() - 1800000),
        effectiveStartDateTime: new Date(Date.now() - 3600000),
        effectiveEndDateTime: new Date(Date.now() - 1800000),
        status: 'EXPIRED',
        expiresAt: new Date(Date.now() - 60000),
      });

      // 2. Late webhook arrives
      const payload = {
        orgId: testOrg._id.toString(),
        holdId: deadHold._id.toString(),
        paymentReference: 'LATE-TXN-API-555',
        status: 'PAID',
        paymentAmount: 500,
      };
      const signature = signWebhookPayload(payload);
      const webhookRes = await fetch(`${baseUrl}/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signature,
        },
        body: JSON.stringify(payload),
      });

      assert.equal(webhookRes.status, 200);
      const webhookBody = await webhookRes.json();
      assert.equal(webhookBody.data.reservation.bookingStatus, 'CANCELLED');
      assert.equal(webhookBody.data.reservation.paymentStatus, 'REFUND_PENDING');
      assert.equal(webhookBody.data.reservation.accessStatus, 'NOT_APPLICABLE');

      // Verify REFUND_DISPATCH_REQUIRED outbox event
      const refundEvent = await AmenityOutboxEvent.findOne({
        orgId: testOrg._id,
        eventType: 'REFUND_DISPATCH_REQUIRED',
        'payload.paymentReference': 'LATE-TXN-API-555',
      });
      assert.ok(refundEvent);
    });
  });

  // =========================================================================
  // 11. Access Passes & Gate Anti-Replay Operations
  // =========================================================================
  describe('11. Turnstile Check-In & Anti-Replay Protection', () => {
    let freshPassToken;

    before(async () => {
      // Create a confirmed reservation with an active pass
      const start = new Date(Date.now() + 3600000);
      const end = new Date(start.getTime() + 3600000);

      const hold = await AmenityReservationHold.create({
        orgId: testOrg._id,
        facilityId: sharedFacilityId,
        residentId: residentUser._id,
        unitId: new mongoose.Types.ObjectId(),
        requestedStartDateTime: start,
        requestedEndDateTime: end,
        effectiveStartDateTime: start,
        effectiveEndDateTime: end,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 600000),
      });

      const confRes = await fetch(`${baseUrl}/reservations/confirm`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${residentToken}`,
          'x-organization-id': testOrg._id.toString(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          holdId: hold._id.toString(),
          paymentReference: 'PASS-TEST-PAY-001',
        }),
      });
      const confBody = await confRes.json();
      freshPassToken = confBody.data.rawToken;

      // Ensure pass validity window encompasses current timestamp for gate check-in
      await AmenityAccessPass.findOneAndUpdate(
        { reservationId: confBody.data.reservation._id },
        {
          validFrom: new Date(Date.now() - 60000),
          validUntil: new Date(Date.now() + 3600000),
        }
      );
    });

    it('should validate and record first turnstile check-in (POST /passes/check-in)', async () => {
      const res = await fetch(`${baseUrl}/passes/check-in`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'x-organization-id': testOrg._id.toString(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rawToken: freshPassToken,
          gateId: 'GATE-NORTH-TURNSTILE-1',
        }),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(body.data.checkInTimestamp);
      assert.equal(body.data.gateId, 'GATE-NORTH-TURNSTILE-1');
    });

    it('CRITICAL SECURITY: second check-in must be rejected with 409 Anti-Replay Violation', async () => {
      const res = await fetch(`${baseUrl}/passes/check-in`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'x-organization-id': testOrg._id.toString(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rawToken: freshPassToken,
          gateId: 'GATE-NORTH-TURNSTILE-1',
        }),
      });

      assert.equal(res.status, 409);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.match(body.message, /Anti-replay violation/i);
    });

    it('should record check-out with inspection details (POST /passes/check-out)', async () => {
      const res = await fetch(`${baseUrl}/passes/check-out`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'x-organization-id': testOrg._id.toString(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rawToken: freshPassToken,
          inspectionDetails: {
            isDamaged: false,
            damageNotes: 'All equipment in good order',
          },
        }),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(body.data.checkOutTimestamp);
      assert.equal(body.data.inspectionDetails.damageNotes, 'All equipment in good order');
    });
  });

  // =========================================================================
  // 12. Maintenance Blackout Management
  // =========================================================================
  describe('12. Maintenance Blackout Operations', () => {
    it('should schedule a maintenance block (POST /maintenance)', async () => {
      const start = new Date(Date.now() + 604800000); // in 7 days
      const end = new Date(start.getTime() + 86400000); // 24 hours

      const res = await fetch(`${baseUrl}/maintenance`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'x-organization-id': testOrg._id.toString(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          facilityId: sharedFacilityId,
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
          isCompleteClosure: true,
          reason: 'Annual tile resurfacing and filter maintenance',
        }),
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.block.reason, 'Annual tile resurfacing and filter maintenance');
      maintenanceBlockId = body.data.block._id;
    });

    it('should retrieve overlapping maintenance blocks (GET /maintenance/overlapping)', async () => {
      const start = new Date(Date.now() + 604800000);
      const end = new Date(start.getTime() + 3600000);

      const params = new URLSearchParams({
        facilityId: sharedFacilityId,
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
      });

      const res = await fetch(`${baseUrl}/maintenance/overlapping?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'x-organization-id': testOrg._id.toString(),
        },
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(Array.isArray(body.data));
      assert.equal(body.data[0]._id, maintenanceBlockId);
    });

    it('should update maintenance block status (PATCH /maintenance/:blockId/status)', async () => {
      const res = await fetch(`${baseUrl}/maintenance/${maintenanceBlockId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'x-organization-id': testOrg._id.toString(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'IN_PROGRESS',
        }),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data.status, 'IN_PROGRESS');
    });
  });

  // =========================================================================
  // 13. Strict Legacy Isolation Assertion
  // =========================================================================
  describe('13. Strict Legacy Isolation Assertion', () => {
    it('legacy collections remain 100% untouched and retain original schema invariants', async () => {
      assert.equal(LegacyAmenity.collection.name, 'amenities');
      assert.equal(LegacyAmenityBooking.collection.name, 'amenitybookings');
      assert.equal(LegacyBooking.collection.name, 'bookings');

      const legacyAmenityCount = await LegacyAmenity.countDocuments({ organizationId: testOrg._id });
      const legacyBookingCount = await LegacyAmenityBooking.countDocuments({ organizationId: testOrg._id });
      assert.equal(legacyAmenityCount, 0);
      assert.equal(legacyBookingCount, 0);
    });
  });

  // =========================================================================
  // 14. Security & API Hardening Audit (Phase 4C.1)
  // =========================================================================
  describe('14. Security & API Hardening Audit (Phase 4C.1)', () => {
    // -----------------------------------------------------------------------
    // 14.1 Cross-Tenant Isolation & Resource Boundaries
    // -----------------------------------------------------------------------
    describe('14.1 Cross-Tenant Isolation & Resource Boundaries', () => {
      it('should reject otherOrg access to facility belonging to testOrg with 404', async () => {
        const res = await fetch(`${baseUrl}/facilities/${sharedFacilityId}`, {
          headers: {
            Authorization: `Bearer ${otherOrgAdminToken}`,
            'x-organization-id': otherOrg._id.toString(),
          },
        });
        assert.equal(res.status, 404);
        const body = await res.json();
        assert.equal(body.success, false);
      });

      it('should reject otherOrg access to reservation belonging to testOrg with 404', async () => {
        const res = await fetch(`${baseUrl}/reservations/${createdReservationId}`, {
          headers: {
            Authorization: `Bearer ${otherOrgAdminToken}`,
            'x-organization-id': otherOrg._id.toString(),
          },
        });
        assert.equal(res.status, 404);
        const body = await res.json();
        assert.equal(body.success, false);
      });

      it('should reject otherOrg cancellation of reservation belonging to testOrg with 404', async () => {
        const res = await fetch(`${baseUrl}/reservations/${createdReservationId}/cancel`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${otherOrgAdminToken}`,
            'x-organization-id': otherOrg._id.toString(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: 'Malicious cross-tenant cancellation' }),
        });
        assert.equal(res.status, 404);
        const body = await res.json();
        assert.equal(body.success, false);
      });

      it('should reject otherOrg access to passes belonging to testOrg reservation with 404', async () => {
        const res = await fetch(`${baseUrl}/passes/reservation/${createdReservationId}`, {
          headers: {
            Authorization: `Bearer ${otherOrgAdminToken}`,
            'x-organization-id': otherOrg._id.toString(),
          },
        });
        assert.equal(res.status, 404);
        const body = await res.json();
        assert.equal(body.success, false);
      });

      it('should reject otherOrg update to maintenance block belonging to testOrg with 404', async () => {
        const res = await fetch(`${baseUrl}/maintenance/${maintenanceBlockId}/status`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${otherOrgAdminToken}`,
            'x-organization-id': otherOrg._id.toString(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'CANCELLED' }),
        });
        assert.equal(res.status, 404);
        const body = await res.json();
        assert.equal(body.success, false);
      });
    });

    // -----------------------------------------------------------------------
    // 14.2 Reservation Ownership & Least-Privilege Boundaries
    // -----------------------------------------------------------------------
    describe('14.2 Reservation Ownership & Least-Privilege Boundaries', () => {
      it('should reject resident B attempting to view resident A reservation with 403', async () => {
        const res = await fetch(`${baseUrl}/reservations/${createdReservationId}`, {
          headers: {
            Authorization: `Bearer ${residentBToken}`,
            'x-organization-id': testOrg._id.toString(),
          },
        });
        assert.equal(res.status, 403);
        const body = await res.json();
        assert.equal(body.success, false);
      });

      it('should reject resident B attempting to cancel resident A reservation with 403', async () => {
        const res = await fetch(`${baseUrl}/reservations/${createdReservationId}/cancel`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${residentBToken}`,
            'x-organization-id': testOrg._id.toString(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: 'Snoop cancellation' }),
        });
        assert.equal(res.status, 403);
        const body = await res.json();
        assert.equal(body.success, false);
      });

      it('should reject resident B attempting to view passes for resident A reservation with 403', async () => {
        const res = await fetch(`${baseUrl}/passes/reservation/${createdReservationId}`, {
          headers: {
            Authorization: `Bearer ${residentBToken}`,
            'x-organization-id': testOrg._id.toString(),
          },
        });
        assert.equal(res.status, 403);
        const body = await res.json();
        assert.equal(body.success, false);
      });

      it('should scope reservation listing to authenticated resident and ignore spoofed query residentId', async () => {
        const res = await fetch(`${baseUrl}/reservations?residentId=${residentUser._id.toString()}`, {
          headers: {
            Authorization: `Bearer ${residentBToken}`,
            'x-organization-id': testOrg._id.toString(),
          },
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.success, true);
        assert.equal(body.data.data.length, 0);
      });
    });

    // -----------------------------------------------------------------------
    // 14.3 State Injection & Parameter Sanitization Boundaries
    // -----------------------------------------------------------------------
    describe('14.3 State Injection & Parameter Sanitization Boundaries', () => {
      it('should sanitize client-injected status and expiry when creating hold', async () => {
        const start = new Date(Date.now() + 86400000);
        const end = new Date(start.getTime() + 3600000);
        const res = await fetch(`${baseUrl}/holds`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${residentToken}`,
            'x-organization-id': testOrg._id.toString(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            facilityId: sharedFacilityId,
            requestedStartDateTime: start.toISOString(),
            requestedEndDateTime: end.toISOString(),
            status: 'CONFIRMED',
            expiresAt: new Date(2099, 1, 1).toISOString(),
          }),
        });

        assert.equal(res.status, 201);
        const body = await res.json();
        assert.equal(body.data.hold.status, 'ACTIVE');
        const expiryYear = new Date(body.data.hold.expiresAt).getFullYear();
        assert.notEqual(expiryYear, 2099);
      });

      it('should sanitize mass assignment of system fields on facility update', async () => {
        const res = await fetch(`${baseUrl}/facilities/${sharedFacilityId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'x-organization-id': testOrg._id.toString(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orgId: otherOrg._id.toString(),
            concurrencyVersion: 9999,
            isDeleted: true,
            name: 'Hardened Sanitized Olympic Pool',
          }),
        });

        assert.equal(res.status, 200);
        const facilityInDb = await AmenityFacility.findById(sharedFacilityId);
        assert.equal(facilityInDb.orgId.toString(), testOrg._id.toString());
        assert.equal(facilityInDb.isDeleted, false);
        assert.notEqual(facilityInDb.concurrencyVersion, 9999);
        assert.equal(facilityInDb.name, 'Hardened Sanitized Olympic Pool');
      });
    });

    // -----------------------------------------------------------------------
    // 14.4 Pass Cryptographic Security & Anti-Replay Verification
    // -----------------------------------------------------------------------
    describe('14.4 Pass Cryptographic Security & Anti-Replay Verification', () => {
      it('should never store raw pass token in database (only SHA-256 hash stored)', async () => {
        const rawFound = await AmenityAccessPass.findOne({ rawToken: accessPassToken });
        assert.equal(rawFound, null);

        const expectedHash = crypto.createHash('sha256').update(accessPassToken).digest('hex');
        const passDoc = await AmenityAccessPass.findOne({ passTokenHash: expectedHash });
        assert.ok(passDoc);
        assert.equal(passDoc.passTokenHash, expectedHash);
      });

      it('should confirm arbitrary pass issuance endpoint does NOT exist', async () => {
        const passFeature = await import('../src/features/amenityManagement/index.js');
        const passRouter = passFeature.amenityAccessPassRouter;
        const registeredRoutes = passRouter.stack
          .filter((l) => l.route)
          .map((l) => `${Object.keys(l.route.methods).join(',').toUpperCase()} ${l.route.path}`);

        assert.equal(registeredRoutes.some((r) => r.includes('issue') || r.includes('create') || r === 'POST /'), false);
      });
    });

    // -----------------------------------------------------------------------
    // 14.5 Payment Webhook Security (Attacks A–E)
    // -----------------------------------------------------------------------
    describe('14.5 Payment Webhook Security', () => {
      // The V2 amenity webhook was removed: it accepted a custom, non-gateway payload
      // (unauthenticated when RAZORPAY_WEBHOOK_SECRET was unset) that could mark any
      // reservation PAID. Gateway callbacks are settled only by /api/webhooks/razorpay.
      for (const [label, headers] of [
        ['unsigned', {}],
        ['correctly signed', { 'x-razorpay-signature': null }],
      ]) {
        it(`${label} V2 amenity webhook call can no longer mark a reservation paid`, async () => {
          const payload = {
            orgId: testOrg._id.toString(),
            reservationId: eventResvId,
            status: 'PAID',
            paymentReference: `REMOVED-WEBHOOK-${label}`,
            paymentAmount: 11800,
          };
          const before = await AmenityReservation.findById(eventResvId).lean();
          const res = await fetch(`${baseUrl}/payments/webhook`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(headers['x-razorpay-signature'] === null
                ? { 'x-razorpay-signature': signWebhookPayload(payload) }
                : headers),
            },
            body: JSON.stringify(payload),
          });
          assert.ok([401, 404].includes(res.status), `unexpected status ${res.status}`);
          const after = await AmenityReservation.findById(eventResvId).lean();
          assert.equal(after?.paymentStatus, before?.paymentStatus);
        });
      }
    });

    // -----------------------------------------------------------------------
    // 14.6 Cross-Tenant Idempotency Key Isolation
    // -----------------------------------------------------------------------
    describe('14.6 Cross-Tenant Idempotency Key Isolation', () => {
      it('should isolate idempotency keys between tenants so identical key creates independent records', async () => {
        const sharedKey = `SEC-IDEMP-${Date.now()}`;
        const timestamp = Date.now().toString().slice(-4);

        const payload1 = {
          name: `Org1 Facility ${timestamp}`,
          code: `O1${timestamp}`,
          archetype: 'EXCLUSIVE_HOURLY',
        };

        const payload2 = {
          name: `Org2 Facility ${timestamp}`,
          code: `O2${timestamp}`,
          archetype: 'EXCLUSIVE_HOURLY',
        };

        // Tenant 1 execution with sharedKey
        const res1 = await fetch(`${baseUrl}/facilities`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'x-organization-id': testOrg._id.toString(),
            'Content-Type': 'application/json',
            'x-idempotency-key': sharedKey,
          },
          body: JSON.stringify(payload1),
        });
        assert.equal(res1.status, 201);
        const body1 = await res1.json();

        // Tenant 2 execution with EXACT same sharedKey
        const res2 = await fetch(`${baseUrl}/facilities`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${otherOrgAdminToken}`,
            'x-organization-id': otherOrg._id.toString(),
            'Content-Type': 'application/json',
            'x-idempotency-key': sharedKey,
          },
          body: JSON.stringify(payload2),
        });
        assert.equal(res2.status, 201);
        const body2 = await res2.json();

        // Independent entities must have different IDs and orgIds
        assert.notEqual(body1.data._id, body2.data._id);
        assert.equal(body1.data.orgId, testOrg._id.toString());
        assert.equal(body2.data.orgId, otherOrg._id.toString());

        // Verify two separate idempotency records exist in database with tenant-scoped _id
        const record1 = await AmenityIdempotencyRecord.findById(`IDEMP:${testOrg._id}:${sharedKey}`);
        const record2 = await AmenityIdempotencyRecord.findById(`IDEMP:${otherOrg._id}:${sharedKey}`);
        assert.ok(record1);
        assert.ok(record2);
      });
    });

    // -----------------------------------------------------------------------
    // 14.7 Information Leakage & Error Sanitization
    // -----------------------------------------------------------------------
    describe('14.7 Information Leakage & Error Sanitization', () => {
      it('should not leak internal stack traces in production error responses', async () => {
        const prevEnv = config.nodeEnv;
        try {
          config.nodeEnv = 'production';
          const res = await fetch(`${baseUrl}/facilities/invalid-mongo-id`, {
            headers: {
              Authorization: `Bearer ${adminToken}`,
              'x-organization-id': testOrg._id.toString(),
            },
          });
          assert.equal(res.status, 400);
          const body = await res.json();
          assert.equal(body.success, false);
          assert.equal(body.stack, undefined);
        } finally {
          config.nodeEnv = prevEnv;
        }
      });
    });
  });
});
