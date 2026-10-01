import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import IssueReport from './src/features/issueReport/issueReport.model.js';
import emailService from './src/utils/email.service.js';

async function test() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gated-community');
  
  const report = await IssueReport.findOne().sort({ createdAt: -1 }).populate('organisation').lean();
  console.log('Sending test report to naveenpv5886@gmail.com...');
  
  try {
    const success = await emailService.sendReportedIssueEmail({
      to: 'naveenpv5886@gmail.com',
      report: report,
      attachments: []
    });
    console.log('Send success:', success);
  } catch (err) {
    console.log('Error:', err);
  }

  process.exit(0);
}
test();
