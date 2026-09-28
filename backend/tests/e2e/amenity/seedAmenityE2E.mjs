/**
 * Seeds an isolated database for the mobile → backend amenity management E2E suite.
 *
 * Usage: MONGODB_URI=mongodb://127.0.0.1:27017/mmg_amenity_e2e node tests/e2e/amenity/seedAmenityE2E.mjs <out.json>
 *
 * The target database is DROPPED first, so the script refuses to run unless the
 * database name contains "e2e". Facilities are created through the real facility
 * service so archetype side effects (sub-room / inventory resources, legacy mirror)
 * match production.
 */
import fs from 'fs';
import { pathToFileURL } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

import Organization from '../../../src/features/organization/organization.model.js';
import Role from '../../../src/features/role/role.model.js';
import User from '../../../src/features/user/user.model.js';
import Villa from '../../../src/features/villa/villa.model.js';
import OrgMembership from '../../../src/features/orgMembership/orgMembership.model.js';
import { Permission } from '../../../src/features/permission/permission.model.js';
import { RolePermission } from '../../../src/features/rolePermission/rolePermission.model.js';
import { Wallet } from '../../../src/features/wallet/wallet.model.js';
import { syncPermissions } from '../../../src/utils/permissionSync.util.js';
import { DEFAULT_ROLE_PERMISSIONS } from '../../../src/features/organization/defaultRolePermissions.js';
import amenityFacilityService from '../../../src/features/amenityManagement/facilities/amenityFacility.service.js';
import { AmenityResource } from '../../../src/features/amenityManagement/resources/amenityResource.model.js';

export const E2E_PASSWORD = 'E2e@Test1234';

// Amenity tiers mirror the Role Builder tiers (mobile useRoleForm.ts AMENITY_V2_TIER_PERMISSIONS).
const AMENITY_ADMIN = ['amenities', 'admin_calander', 'maintenance', 'settings', 'dashboard', 'ledgers'].map((a) => `amenities:${a}`);
const AMENITY_RESIDENT = ['discover', 'my_booking', 'wallet'].map((a) => `amenities:${a}`);
const AMENITY_GUARD = ['scanner', 'security_logs'].map((a) => `amenities:${a}`);

const ROLE_PERMISSIONS = {
  'Community Admin': [...AMENITY_ADMIN, ...AMENITY_RESIDENT, ...AMENITY_GUARD, 'billing:action_center', 'villas:read'],
  // Non-"admin" role name: exercises permission-based admin scope instead of the name bypass.
  'Amenity Manager': [...AMENITY_ADMIN, 'villas:read'],
  // Tenant and guard roles use exactly what a newly created community gets.
  'Security Guard': [...DEFAULT_ROLE_PERMISSIONS['Security Guard']],
  'Resident Owner': [...DEFAULT_ROLE_PERMISSIONS['Resident Owner']],
  'Family Member': [...DEFAULT_ROLE_PERMISSIONS['Family Member']],
};

// A tenant role as communities created before the permission fix have it: it still
// carries the admin-only grant. The backend's boot-time self-heal must strip it.
const LEGACY_TENANT_ROLE = { name: 'Resident Tenant', perms: [...DEFAULT_ROLE_PERMISSIONS['Resident Tenant'], 'amenities:amenities'] };

void AMENITY_RESIDENT;

const COMMUNITIES = [
  {
    key: 'A',
    name: 'Amenity E2E Greens',
    domain: 'greens.amenity-e2e.test',
    phonePrefix: '91000',
    villas: ['A-101', 'A-102', 'A-103'],
    users: [
      { actor: 'adminA', role: 'Community Admin', name: 'Asha Admin' },
      { actor: 'managerA', role: 'Amenity Manager', name: 'Manoj Manager' },
      { actor: 'guardA', role: 'Security Guard', name: 'Gopal Guard' },
      { actor: 'residentA', role: 'Resident Owner', name: 'Ravi Resident', villa: 'A-101', residency: 'Owner', wallet: 5000 },
      { actor: 'familyA', role: 'Family Member', name: 'Fathima Family', villa: 'A-101', residency: 'Family', wallet: 0 },
      { actor: 'residentB', role: 'Resident Owner', name: 'Bhavna Resident', villa: 'A-102', residency: 'Owner', wallet: 1000 },
      // Resident here, Community Admin in B: probes cross-community permission leaks.
      { actor: 'crossAdmin', role: 'Resident Owner', name: 'Kiran Cross', villa: 'A-103', residency: 'Owner', wallet: 500, alsoAdminIn: 'B' },
    ],
  },
  {
    key: 'B',
    name: 'Amenity E2E Other',
    domain: 'other.amenity-e2e.test',
    phonePrefix: '91001',
    villas: ['B-101'],
    users: [
      { actor: 'adminOther', role: 'Community Admin', name: 'Omkar Admin' },
      { actor: 'guardOther', role: 'Security Guard', name: 'Omar Guard' },
      { actor: 'residentOther', role: 'Resident Owner', name: 'Olga Resident', villa: 'B-101', residency: 'Owner', wallet: 5000 },
    ],
  },
];

const allDays = (openTime, closeTime) =>
  [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, openTime, closeTime, isOpen: true }));

const REFUND_50_BEFORE_24H = { isAllowed: true, refundCutoffHours: 24, refundPercentage: 50 };

// One facility per archetype (plus a free and a draft variant) in community A, one in B.
const FACILITIES = [
  {
    key: 'pool', orgKey: 'A', archetype: 'SHARED_CAPACITY', name: 'Swimming Pool', code: 'POOL', category: 'Pool & Spa',
    maxCapacity: 10, maxHeadcountPerReservation: 4, slotDurationMinutes: 60, operatingHours: allDays('06:00', '22:00'),
    pricingConfig: { pricingType: 'HOURLY', baseRate: 100, currency: 'INR' }, cancellationPolicy: REFUND_50_BEFORE_24H,
  },
  {
    key: 'gym', orgKey: 'A', archetype: 'SHARED_CAPACITY', name: 'Fitness Gym', code: 'GYM', category: 'Fitness',
    maxCapacity: 20, maxHeadcountPerReservation: 2, slotDurationMinutes: 60, operatingHours: allDays('05:00', '23:00'),
    pricingConfig: { pricingType: 'FREE', baseRate: 0, currency: 'INR' },
  },
  {
    key: 'court', orgKey: 'A', archetype: 'EXCLUSIVE_HOURLY', name: 'Tennis Court', code: 'COURT', category: 'Sports',
    maxCapacity: 1, maxHeadcountPerReservation: 4, slotDurationMinutes: 60, setupBufferMinutes: 10, advanceBookingDays: 7,
    operatingHours: allDays('06:00', '22:00'),
    pricingConfig: { pricingType: 'HOURLY', baseRate: 300, currency: 'INR' }, cancellationPolicy: REFUND_50_BEFORE_24H,
  },
  {
    key: 'hall', orgKey: 'A', archetype: 'EVENT_SPACE', name: 'Party Hall', code: 'HALL', category: 'Event Space',
    maxCapacity: 100, maxHeadcountPerReservation: 100, slotDurationMinutes: 720, requiresApproval: true,
    minNoticeHours: 24, advanceBookingDays: 30, operatingHours: allDays('06:00', '22:00'),
    pricingConfig: { pricingType: 'FIXED_EVENT', baseRate: 5000, securityDeposit: 2000, currency: 'INR' },
    cancellationPolicy: REFUND_50_BEFORE_24H,
  },
  {
    key: 'rooms', orgKey: 'A', archetype: 'ROOM_RESOURCE', name: 'Meeting Rooms', code: 'ROOMS', category: 'Workspace',
    maxCapacity: 10, slotDurationMinutes: 60, isMultiResourceFacility: true, operatingHours: allDays('08:00', '20:00'),
    subRooms: [{ id: 'ROOM-A', name: 'Room A', capacity: 6 }, { id: 'ROOM-B', name: 'Room B', capacity: 10 }],
    pricingConfig: { pricingType: 'HOURLY', baseRate: 200, currency: 'INR' },
  },
  {
    key: 'tools', orgKey: 'A', archetype: 'INVENTORY_TOOLS', name: 'Tool Kit', code: 'TOOLS', category: 'General',
    maxCapacity: 3, availableStock: 3, maxLoanHours: 4, requiresInspection: true, slotDurationMinutes: 240,
    operatingHours: allDays('08:00', '20:00'), pricingConfig: { pricingType: 'FREE', baseRate: 0, currency: 'INR' },
  },
  {
    key: 'draft', orgKey: 'A', archetype: 'EVENT_SPACE', name: 'Draft Lounge', code: 'DRAFT', category: 'Event Space',
    isDraft: true, status: 'DRAFT', maxCapacity: 40, slotDurationMinutes: 720, operatingHours: allDays('06:00', '22:00'),
    pricingConfig: { pricingType: 'FIXED_EVENT', baseRate: 1500, currency: 'INR' },
  },
  {
    key: 'poolOther', orgKey: 'B', archetype: 'SHARED_CAPACITY', name: 'Other Pool', code: 'POOL', category: 'Pool & Spa',
    maxCapacity: 10, maxHeadcountPerReservation: 4, slotDurationMinutes: 60, operatingHours: allDays('06:00', '22:00'),
    pricingConfig: { pricingType: 'HOURLY', baseRate: 100, currency: 'INR' },
  },
];

const assertE2EDatabase = (uri) => {
  const dbName = new URL(uri).pathname.replace(/^\//, '');
  if (!/e2e/i.test(dbName)) {
    throw new Error(`Refusing to seed database "${dbName}": name must contain "e2e".`);
  }
};

export async function seedAmenityE2E() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required.');
  assertE2EDatabase(uri);

  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();
  await syncPermissions();

  const permMap = Object.fromEntries((await Permission.find({}).lean()).map((p) => [p.name, p._id]));
  const password = await bcrypt.hash(E2E_PASSWORD, 10);
  const fixture = { password: E2E_PASSWORD, orgs: {}, villas: {}, facilities: {}, actors: {} };
  const rolesByOrg = {};
  const extraMemberships = [];

  for (const cfg of COMMUNITIES) {
    const org = await Organization.create({
      name: cfg.name,
      status: 'Active',
      organizationType: 'Residential',
      contactEmail: `contact@${cfg.domain}`,
      contactPhone: `+91${cfg.phonePrefix}00000`,
      timezone: 'Asia/Kolkata',
      allowedFeatures: ['villas', 'amenities', 'billing', 'roles', 'users'],
      isPlatform: false,
    });
    fixture.orgs[cfg.key] = String(org._id);

    const roleNames = [...new Set(cfg.users.map((u) => u.role))];
    const roles = {};
    for (const roleName of roleNames) {
      const perms = ROLE_PERMISSIONS[roleName];
      roles[roleName] = await Role.create({
        name: roleName,
        orgId: org._id,
        description: `${roleName} (amenity E2E)`,
        isTenantRole: roleName === 'Resident Owner' || roleName === 'Family Member',
      });
      // Like organization creation (getPermissionIds), unknown non-amenity names are
      // dropped; amenity permissions must all exist.
      const missing = perms.filter((p) => !permMap[p] && p.startsWith('amenities:'));
      if (missing.length) throw new Error(`Permissions missing after sync: ${missing.join(', ')}`);
      await RolePermission.insertMany(perms.filter((p) => permMap[p]).map((p) => ({ roleId: roles[roleName]._id, permissionId: permMap[p] })));
    }

    if (cfg.key === 'A') {
      const legacy = await Role.create({ name: LEGACY_TENANT_ROLE.name, orgId: org._id, description: 'Legacy tenant role (amenity E2E)', isTenantRole: true });
      await RolePermission.insertMany(LEGACY_TENANT_ROLE.perms.filter((p) => permMap[p]).map((p) => ({ roleId: legacy._id, permissionId: permMap[p] })));
    }

    rolesByOrg[cfg.key] = roles;

    const villas = {};
    for (const unitNumber of cfg.villas) {
      villas[unitNumber] = await Villa.create({
        orgId: org._id,
        unitNumber,
        blockOrBuilding: `Block ${cfg.key}`,
        type: 'Villa',
        status: 'Occupied',
        residents: [],
      });
      fixture.villas[unitNumber] = String(villas[unitNumber]._id);
    }

    let phoneCounter = 10;
    for (const spec of cfg.users) {
      const role = roles[spec.role];
      const villa = spec.villa ? villas[spec.villa] : null;
      const residency = villa ? spec.residency : 'None';
      const email = `${spec.actor.toLowerCase()}@${cfg.domain}`;
      const user = await User.create({
        email,
        username: `${spec.actor.toLowerCase()}_amenity_e2e`,
        password,
        status: 'Active',
        name: spec.name,
        phone: `+91${cfg.phonePrefix}${String(phoneCounter++).padStart(5, '0')}`,
        emailVerified: true,
        phoneVerified: true,
        roles: [role._id],
        residencyType: residency,
        villaId: villa?._id || null,
      });

      await OrgMembership.create({
        userId: user._id,
        orgId: org._id,
        roleId: role._id,
        roleIds: [role._id],
        status: 'Active',
        villaId: villa?._id || null,
        residentType: residency,
        ...(villa ? { units: [{ villaId: villa._id, residentType: residency }] } : {}),
      });

      if (villa) {
        const isPrimary = residency === 'Owner';
        villa.residents.push({ userId: user._id, residencyType: residency, isPrimary });
        if (isPrimary) {
          villa.primaryResidentId = user._id;
          villa.ownerId = user._id;
        }
        await villa.save();
      }

      if (spec.alsoAdminIn) extraMemberships.push({ userId: user._id, orgKey: spec.alsoAdminIn });

      if (spec.wallet !== undefined) {
        await Wallet.create({ orgId: org._id, userId: user._id, balance: spec.wallet });
      }

      fixture.actors[spec.actor] = {
        id: String(user._id),
        email,
        name: spec.name,
        role: spec.role,
        orgKey: cfg.key,
        orgId: String(org._id),
        villaId: villa ? String(villa._id) : null,
        villaNumber: spec.villa || null,
      };
    }
  }

  for (const { userId, orgKey } of extraMemberships) {
    const role = rolesByOrg[orgKey]['Community Admin'];
    await OrgMembership.create({ userId, orgId: fixture.orgs[orgKey], roleId: role._id, roleIds: [role._id], status: 'Active' });
  }

  for (const spec of FACILITIES) {
    const { key, orgKey, ...data } = spec;
    const facility = await amenityFacilityService.createFacility({
      ...data,
      orgId: fixture.orgs[orgKey],
      location: `${data.name}, Block ${orgKey}`,
      description: `${data.name} (amenity E2E)`,
      timezone: 'Asia/Kolkata',
    });
    const resources = await AmenityResource.find({ facilityId: facility._id, isDeleted: { $ne: true } }).sort({ name: 1 }).lean();
    fixture.facilities[key] = {
      id: String(facility._id),
      code: facility.code,
      name: facility.name,
      archetype: facility.archetype,
      orgKey,
      resourceIds: resources.map((r) => String(r._id)),
    };
  }

  await mongoose.disconnect();
  return fixture;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  seedAmenityE2E()
    .then((fixture) => {
      const out = process.argv[2];
      if (out) fs.writeFileSync(out, JSON.stringify(fixture, null, 2));
      else console.log(JSON.stringify(fixture, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
