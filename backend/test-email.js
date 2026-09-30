import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { sendEmail } from './src/utils/email.utils.js';

async function test() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gated-community');
  console.log('Connected');

  console.log('Sending direct test email...');
  const sent = await sendEmail(null, 'test@example.com', 'Test Subject', '<p>Test Body</p>');
  console.log('Email sent result:', sent);
  
  process.exit(0);
}
test();
