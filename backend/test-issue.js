import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import IssueReport from './src/features/issueReport/issueReport.model.js';
import User from './src/features/user/user.model.js';
import IssueReportConfig from './src/features/issueReportConfig/issueReportConfig.model.js';
import IntegrationHub from './src/features/integrationHub/integrationHub.model.js';

async function test() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gated-community');
  
  const latestReport = await IssueReport.findOne().sort({ createdAt: -1 }).lean();
  console.log('Latest Report created at:', latestReport?.createdAt);

  const config = await IssueReportConfig.findOne().lean();
  console.log('Platform Configured Email:', config?.platformAdminEmail);

  const platformAdmins = await User.find({ isPlatform: true }).select('email').lean();
  console.log('Platform Admins:', platformAdmins.map(u => u.email));

  const smtp = await IntegrationHub.findOne({ provider: 'smtp' }).lean();
  console.log('Any SMTP configured?', !!smtp);

  process.exit(0);
}
test();
