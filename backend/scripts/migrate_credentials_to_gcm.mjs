/**
 * Re-encrypts stored integration credentials from legacy AES-256-CBC (no integrity check)
 * to AES-256-GCM (authenticated).  Safe to re-run; already-GCM entries are skipped.
 *
 *   node scripts/migrate_credentials_to_gcm.mjs          # dry run (counts only)
 *   node scripts/migrate_credentials_to_gcm.mjs --apply  # write changes
 *
 * Back up the database first.
 */
import mongoose from 'mongoose';
import config from '../src/config/config.js';
import IntegrationHub from '../src/features/integrationHub/integrationHub.model.js';
import { decrypt, encryptGCM } from '../src/features/integrationHub/utils/crypto.util.js';

const apply = process.argv.includes('--apply');
await mongoose.connect(config.mongodb.uri);

let connections = 0;
let entries = 0;
try {
  const docs = await IntegrationHub.find({ 'credentials.0': { $exists: true } });
  for (const doc of docs) {
    let changed = false;
    const field = doc.credentials ? 'credentials' : 'encryptedCredentials';
    for (const cred of doc[field] || []) {
      if (cred.authTag) continue;
      const plain = decrypt(cred.encryptedValue, cred.iv);
      const enc = encryptGCM(plain);
      cred.encryptedValue = enc.encryptedValue;
      cred.iv = enc.iv;
      cred.authTag = enc.authTag;
      entries += 1;
      changed = true;
    }
    if (changed) {
      connections += 1;
      if (apply) await doc.save();
    }
  }
  console.log(`${apply ? 'Migrated' : 'Would migrate'} ${entries} credential(s) across ${connections} connection(s).`);
  if (!apply) console.log('Dry run only. Re-run with --apply to write.');
} finally {
  await mongoose.disconnect();
}
