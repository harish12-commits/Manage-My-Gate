/**
 * Fresh local database: DROP -> migrate (indexes + permissions + platform bootstrap) -> seed.
 *
 *   node scripts/reset_and_seed_local.mjs --yes
 *
 * Safety: refuses to run unless the target is a local MongoDB (localhost / 127.0.0.1) and
 * NODE_ENV is not production. Without --yes it only prints what it would do.
 *
 * Login accounts created (password for demo users: Test@1234):
 *   Super admin     : SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD from backend/.env
 *   Community admin : admin@mygate.com
 *   Residents       : owner1@mygate.com, owner2@mygate.com, tenant1@mygate.com, tenant2@mygate.com
 *   Guard           : guard1@mygate.com
 */
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { readdirSync, statSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');

// config.js loads backend/.env and validates required variables
const { default: config } = await import(pathToFileURL(path.join(backendRoot, 'src/config/config.js')).href);

const DEMO_PASSWORD = 'Test@1234';
const confirmed = process.argv.includes('--yes');

// --- Safety guard -----------------------------------------------------------
const uri = config.mongodb.uri;
const hostMatch = uri.match(/^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/i);
const hosts = (hostMatch ? hostMatch[1] : '').split(',').map((h) => h.replace(/:\d+$/, '').toLowerCase());
const isLocal = hosts.length > 0 && hosts.every((h) => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(h));
const dbName = (uri.match(/\/([^/?]+)(?:\?|$)/) || [])[1];

if (config.nodeEnv === 'production' || !isLocal) {
  console.error(`REFUSING to run: target "${hosts.join(',')}" / NODE_ENV="${config.nodeEnv}" is not a local development database.`);
  process.exit(1);
}
if (!dbName) {
  console.error('REFUSING to run: MONGODB_URI has no database name.');
  process.exit(1);
}
if (!confirmed) {
  console.log(`DRY RUN. This would DROP database "${dbName}" on ${hosts.join(',')} and re-seed it.`);
  console.log('Re-run with --yes to proceed.');
  process.exit(0);
}

// --- Load every model so indexes can be built --------------------------------
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const full = path.join(dir, f);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const modelFiles = walk(path.join(backendRoot, 'src/features')).filter((f) => /\.model\.js$/.test(f));
for (const f of modelFiles) {
  try {
    await import(pathToFileURL(f).href);
  } catch (err) {
    console.warn(`  (skipped ${path.relative(backendRoot, f)}: ${err.message})`);
  }
}
const model = async (rel) => (await import(pathToFileURL(path.join(backendRoot, 'src/features', rel)).href)).default;

const step = (msg) => console.log(`\n==> ${msg}`);

try {
  step(`Connecting to ${hosts.join(',')} / ${dbName}`);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });

  // 1. Wipe ---------------------------------------------------------------
  step(`Dropping database "${dbName}"`);
  await mongoose.connection.dropDatabase();

  // 2. Migrate: create collections + indexes from the current schemas -----------
  step('Migrating: creating collections and syncing indexes');
  let indexed = 0;
  for (const m of Object.values(mongoose.models)) {
    try {
      await m.createCollection().catch(() => {});
      await m.syncIndexes();
      indexed += 1;
    } catch (err) {
      console.warn(`  index sync failed for ${m.modelName}: ${err.message}`);
    }
  }
  console.log(`  ${indexed}/${Object.keys(mongoose.models).length} models synced`);

  // 3. Migrate: permissions, platform org, Platform Super Admin role + user -----
  step('Bootstrapping permissions, platform organization and super admin');
  const { syncPermissions } = await import(pathToFileURL(path.join(backendRoot, 'src/utils/permissionSync.util.js')).href);
  await syncPermissions();

  // 4. Seed: master pricing plans ---------------------------------------------
  step('Seeding master pricing plans');
  const MasterPricing = await model('masterPricing/masterPricing.model.js');
  await MasterPricing.insertMany([
    { planCode: 'FEAT_AMENITIES', name: 'Amenities & Booking', type: 'FEATURE_ADDON', pricingModel: 'FLAT', basePrice: 500, unitPrice: 0, billingInterval: 'MONTHLY', features: ['Facility Reservation', 'Payment Gateway Integration', 'Usage Analytics'], status: 'ACTIVE', maxAgentDiscountPercent: 10, setupFee: 0, freeTrialDuration: 0 },
    { planCode: 'FEAT_NOTICE_BOARD', name: 'Digital Notice Board', type: 'FEATURE_ADDON', pricingModel: 'FLAT', basePrice: 200, unitPrice: 0, billingInterval: 'MONTHLY', features: ['Announcements', 'Push Notifications', 'Read Receipts'], status: 'ACTIVE', maxAgentDiscountPercent: 5, setupFee: 0, freeTrialDuration: 0 },
    { planCode: 'FEAT_VISITOR_MGMT', name: 'Visitor Management', type: 'UNIT_ADDON', pricingModel: 'PER_UNIT', basePrice: 1000, unitPrice: 5, billingInterval: 'MONTHLY', features: ['QR Code Entry', 'Pre-approval', 'Gate Pass Generation', 'Delivery Tracking'], status: 'ACTIVE', maxAgentDiscountPercent: 15, setupFee: 500, freeTrialDuration: 0 },
  ]);

  // 5. Seed: demo community ----------------------------------------------------
  step('Seeding demo community, roles, users, villas and memberships');
  const [Organization, Role, User, Villa, OrgMembership] = await Promise.all([
    model('organization/organization.model.js'),
    model('role/role.model.js'),
    model('user/user.model.js'),
    model('villa/villa.model.js'),
    model('orgMembership/orgMembership.model.js'),
  ]);

  const org = await Organization.create({
    name: 'Srihariparthasarathi Community',
    status: 'Active',
    organizationType: 'Residential',
    allowedFeatures: ['billing', 'villas', 'visitor', 'complaints', 'amenities'],
    isPlatform: false,
  });

  const mkRole = (name, description, isTenantRole) => Role.create({ name, orgId: org._id, description, isTenantRole });
  const roleAdmin = await mkRole('Community Admin', 'Community Administrator with full billing privileges', false);
  const roleOwner = await mkRole('Resident Owner', 'Villa Owner residing in the community', true);
  const roleTenant = await mkRole('Resident Tenant', 'Tenant renting a villa in the community', true);
  const roleGuard = await mkRole('Security Guard', 'Security Guard patrolling the community gates', false);

  const hashed = await bcrypt.hash(DEMO_PASSWORD, 12);
  const mkUser = (username, name, phone, role, residencyType) =>
    User.create({ email: `${username === 'admin' ? 'admin' : username}@mygate.com`, username, password: hashed, status: 'Active', name, phone, roles: [role._id], residencyType });

  const admin = await mkUser('admin', 'Community Admin', '+919999999991', roleAdmin, 'None');
  const owner1 = await mkUser('owner1', 'Rajesh Kumar (Owner 1)', '+919999999992', roleOwner, 'Resident Owner');
  const owner2 = await mkUser('owner2', 'Vikram Singh (Owner 2)', '+919999999993', roleOwner, 'Resident Owner');
  const tenant1 = await mkUser('tenant1', 'Rahul Mehta (Tenant 1)', '+919999999994', roleTenant, 'Tenant');
  const tenant2 = await mkUser('tenant2', 'Aisha Khan (Tenant 2)', '+919999999995', roleTenant, 'Tenant');
  const guard = await mkUser('guard1', 'Bahadur Singh (Guard 1)', '+919999999996', roleGuard, 'Staff');

  const villaA101 = await Villa.create({
    orgId: org._id, unitNumber: 'Villa A-101', blockOrBuilding: 'Block A', type: 'Villa', status: 'Occupied',
    primaryResidentId: owner1._id,
    residents: [{ userId: owner1._id, residencyType: 'Resident Owner', isPrimary: true }],
  });
  const villaA102 = await Villa.create({
    orgId: org._id, unitNumber: 'Villa A-102', blockOrBuilding: 'Block A', type: 'Villa', status: 'Occupied',
    primaryResidentId: tenant1._id,
    residents: [
      { userId: owner2._id, residencyType: 'Non-Resident Owner', isPrimary: false },
      { userId: tenant1._id, residencyType: 'Tenant', isPrimary: true },
    ],
  });
  const villaB201 = await Villa.create({
    orgId: org._id, unitNumber: 'Villa B-201', blockOrBuilding: 'Block B', type: 'Villa', status: 'Occupied',
    primaryResidentId: tenant2._id,
    residents: [
      { userId: owner1._id, residencyType: 'Non-Resident Owner', isPrimary: false },
      { userId: tenant2._id, residencyType: 'Tenant', isPrimary: true },
    ],
  });
  await User.updateOne({ _id: owner1._id }, { $set: { villaId: villaA101._id } });
  await User.updateOne({ _id: tenant1._id }, { $set: { villaId: villaA102._id } });
  await User.updateOne({ _id: tenant2._id }, { $set: { villaId: villaB201._id } });

  const membership = (user, role, residentType, villa) => ({
    userId: user._id, orgId: org._id, roleId: role._id, roleIds: [role._id], residentType, ...(villa ? { villaId: villa._id } : {}),
  });
  await OrgMembership.create([
    membership(admin, roleAdmin, 'None'),
    membership(owner1, roleOwner, 'Owner', villaA101),
    membership(owner2, roleOwner, 'Owner', villaA102),
    membership(tenant1, roleTenant, 'Tenant', villaA102),
    membership(tenant2, roleTenant, 'Tenant', villaB201),
    membership(guard, roleGuard, 'None'),
  ]);

  // 6. Re-run bootstrap so the new Community Admin role gets its baseline permissions
  step('Mapping baseline permissions to the new community roles');
  await syncPermissions();

  // Summary ------------------------------------------------------------------------
  step('Done. Document counts:');
  const counts = await Promise.all(
    ['organizations', 'roles', 'users', 'villas', 'orgmemberships', 'permissions', 'masterpricings'].map(async (c) => {
      try { return `${c}: ${await mongoose.connection.collection(c).countDocuments()}`; } catch { return `${c}: n/a`; }
    })
  );
  console.log('  ' + counts.join('\n  '));
  console.log(`\nSuper admin: ${process.env.SUPER_ADMIN_EMAIL || 'admin@enterprise.com'}  |  demo users password: ${DEMO_PASSWORD}`);
} catch (err) {
  console.error('\nFAILED:', err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
