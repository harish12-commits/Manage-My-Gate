import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import IntegrationHub from '../features/integrationHub/integrationHub.model.js';
import { decrypt } from '../features/integrationHub/utils/crypto.util.js';

async function checkSmtpIntegration() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/manage-my-gate';
  await mongoose.connect(mongoUri);

  try {
    const integrations = await IntegrationHub.find({}).exec();
    console.log(`Found ${integrations.length} total integrations in IntegrationHub:`);

    for (const integ of integrations) {
      console.log(`- Provider: ${integ.provider}, Status: ${integ.status}, Label: ${integ.accountLabel}`);
      if (integ.provider === 'smtp') {
        const getCred = (key) => {
          const cred = integ.credentials.find((c) => c.key === key);
          return cred ? decrypt(cred.encryptedValue, cred.iv, cred.authTag) : null;
        };
        console.log(`  Host: ${getCred('host')}, Port: ${getCred('port')}, User: ${getCred('authUsername')}`);
      }
    }
  } catch (err) {
    console.error('Error checking integrations:', err);
  } finally {
    await mongoose.disconnect();
  }
}

checkSmtpIntegration();

