import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

import { sendEmail } from './backend/src/utils/email.utils.js';
import IntegrationHub from './backend/src/features/integrationHub/integrationHub.model.js';

async function test() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gated-community');
  console.log('Connected');

  const integrations = await IntegrationHub.find({ provider: 'smtp' }).lean();
  console.log('SMTP Integrations:', integrations.length);

  console.log('Done');
  process.exit(0);
}
test();
