import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gated_community';

async function run() {
  console.log('Connecting to MongoDB:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log('Topology type:', mongoose.connection.client?.topology?.description?.type);

  const Organization = (await import('../src/features/organization/organization.model.js')).default;
  const User = (await import('../src/features/user/user.model.js')).default;
  const walletService = (await import('../src/features/wallet/wallet.service.js')).default;
  const { Wallet } = await import('../src/features/wallet/wallet.model.js');

  const allOrgs = await Organization.find({});
  console.log('\nAll Organizations:');
  for (const o of allOrgs) {
    console.log(`- Org: ${o.name} | ID: ${o._id}`);
  }

  const allUsers = await User.find({});
  console.log(`\nAll Users (${allUsers.length}):`);
  for (const u of allUsers) {
    console.log(`- User: ${u.name} (${u.email || u.phone}) | Role: ${u.role} | ID: ${u._id} | orgId: ${u.orgId || u.communityId}`);
  }

  const nexusOrg = allOrgs.find(o => o.name && o.name.toLowerCase().includes('nexus')) || allOrgs[0];

  for (const u of allUsers) {
    const targetOrgId = u.orgId || u.communityId || (nexusOrg ? nexusOrg._id : null);
    if (!targetOrgId) continue;

    console.log(`\nCrediting ₹5 to user ${u.name} (${u._id}) in org ${targetOrgId}...`);
    try {
      await walletService.creditWallet({
        userId: u._id,
        orgId: targetOrgId,
        amount: 5,
        referenceType: 'Recharge',
        referenceId: u._id,
        idempotencyKey: `admin-topup-5inr-${u._id}-${Date.now()}`,
        paymentMethod: 'admin_adjustment',
        description: 'Admin ₹5 Wallet Credit',
      });
      const w = await Wallet.findOne({ userId: u._id, orgId: targetOrgId });
      console.log(`✅ Successfully added ₹5! User: ${u.name}, New Wallet Balance: ₹${w?.balance}`);
    } catch (err) {
      console.error(`Failed crediting user ${u.name}:`, err.stack || err);
    }
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

run().catch(err => {
  console.error('Error running script:', err);
  process.exit(1);
});
