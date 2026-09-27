/**
 * Seeds an isolated database for the mobile → backend visitor management E2E suite.
 *
 * Usage: MONGODB_URI=mongodb://127.0.0.1:27017/mmg_visitor_e2e node tests/e2e/visitor/seedVisitorE2E.mjs <out.json>
 *
 * The target database is DROPPED first, so the script refuses to run unless the
 * database name contains "e2e".
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
import { syncPermissions } from '../../../src/utils/permissionSync.util.js';

export const E2E_PASSWORD = 'E2e@Test1234';

const ROLE_PERMISSIONS = {
  'Community Admin': ['visitor:admin', 'visitor:resident', 'visitor:guard', 'villas:read'],
  'Security Guard': ['visitor:guard', 'villas:read'],
  'Resident Owner': ['visitor:resident', 'villas:read'],
};

const COMMUNITIES = [
  {
    key: 'A',
    name: 'Visitor E2E Greens',
    domain: 'greens.visitor-e2e.test',
    phonePrefix: '90000',
    villas: ['A-101', 'A-102', 'A-103'],
    users: [
      { actor: 'adminA', role: 'Community Admin', name: 'Asha Admin' },
      { actor: 'guardA', role: 'Security Guard', name: 'Gopal Guard' },
      { actor: 'residentA', role: 'Resident Owner', name: 'Ravi Resident', villa: 'A-101' },
      { actor: 'residentB', role: 'Resident Owner', name: 'Bhavna Resident', villa: 'A-102' },
    ],
  },
  {
    key: 'B',
    name: 'Visitor E2E Other',
    domain: 'other.visitor-e2e.test',
    phonePrefix: '90001',
    villas: ['B-101'],
    users: [
      { actor: 'guardOther', role: 'Security Guard', name: 'Omar Guard' },
      { actor: 'residentOther', role: 'Resident Owner', name: 'Olga Resident', villa: 'B-101' },
    ],
  },
];

const assertE2EDatabase = (uri) => {
  const dbName = new URL(uri).pathname.replace(/^\//, '');
  if (!/e2e/i.test(dbName)) {
    throw new Error(`Refusing to seed database "${dbName}": name must contain "e2e".`);
  }
};

export async function seedVisitorE2E() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required.');
  assertE2EDatabase(uri);

  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();
  await syncPermissions();

  const permMap = Object.fromEntries((await Permission.find({}).lean()).map((p) => [p.name, p._id]));
  const password = await bcrypt.hash(E2E_PASSWORD, 10);
  const fixture = { password: E2E_PASSWORD, orgs: {}, villas: {}, actors: {} };

  for (const cfg of COMMUNITIES) {
    const org = await Organization.create({
      name: cfg.name,
      status: 'Active',
      organizationType: 'Residential',
      contactEmail: `contact@${cfg.domain}`,
      contactPhone: `+91${cfg.phonePrefix}00000`,
      timezone: 'Asia/Kolkata',
      allowedFeatures: ['villas', 'visitor', 'roles', 'users'],
      isPlatform: false,
    });
    fixture.orgs[cfg.key] = String(org._id);

    const roles = {};
    for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS)) {
      roles[roleName] = await Role.create({
        name: roleName,
        orgId: org._id,
        description: `${roleName} (visitor E2E)`,
        isTenantRole: roleName === 'Resident Owner',
      });
      const links = perms.filter((p) => permMap[p]).map((p) => ({ roleId: roles[roleName]._id, permissionId: permMap[p] }));
      const missing = perms.filter((p) => !permMap[p]);
      if (missing.length) throw new Error(`Permissions missing after sync: ${missing.join(', ')}`);
      await RolePermission.insertMany(links);
    }

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
      const email = `${spec.actor.toLowerCase()}@${cfg.domain}`;
      const user = await User.create({
        email,
        username: `${spec.actor.toLowerCase()}_e2e`,
        password,
        status: 'Active',
        name: spec.name,
        phone: `+91${cfg.phonePrefix}${String(phoneCounter++).padStart(5, '0')}`,
        emailVerified: true,
        phoneVerified: true,
        roles: [role._id],
        residencyType: villa ? 'Owner' : 'None',
        villaId: villa?._id || null,
      });

      await OrgMembership.create({
        userId: user._id,
        orgId: org._id,
        roleId: role._id,
        roleIds: [role._id],
        status: 'Active',
        villaId: villa?._id || null,
        residentType: villa ? 'Owner' : 'None',
        ...(villa ? { units: [{ villaId: villa._id, residentType: 'Owner' }] } : {}),
      });

      if (villa) {
        villa.residents.push({ userId: user._id, residencyType: 'Owner', isPrimary: true });
        villa.primaryResidentId = user._id;
        villa.ownerId = user._id;
        await villa.save();
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

  await mongoose.disconnect();
  return fixture;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  seedVisitorE2E()
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
