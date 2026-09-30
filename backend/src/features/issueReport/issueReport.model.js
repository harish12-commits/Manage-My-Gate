import mongoose from 'mongoose';
import { REPORT_TYPES, REPORT_MODULES } from './issueReport.constants.js';

const { Schema } = mongoose;

const attachmentSchema = new Schema(
  {
    url: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { _id: false }
);

const technicalContextSchema = new Schema(
  {
    appVersion: { type: String, trim: true, maxlength: 50, default: '' },
    platform: { type: String, trim: true, maxlength: 30, default: '' },
    deviceModel: { type: String, trim: true, maxlength: 100, default: '' },
    osVersion: { type: String, trim: true, maxlength: 50, default: '' },
  },
  { _id: false }
);

const reporterSnapshotSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    role: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const organisationSnapshotSchema = new Schema(
  {
    organisationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const issueReportSchema = new Schema(
  {
    reportNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    reporter: {
      type: reporterSnapshotSchema,
      required: true,
    },
    organisation: {
      type: organisationSnapshotSchema,
      required: true,
    },
    reportType: {
      type: String,
      required: true,
      enum: Object.values(REPORT_TYPES),
      index: true,
    },
    feature: {
      type: String,
      required: true,
      enum: Object.values(REPORT_MODULES),
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 5000,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    technicalContext: {
      type: technicalContextSchema,
      default: () => ({}),
    },
    source: {
      type: String,
      default: 'MOBILE_APP',
      trim: true,
    },
    clientRequestId: {
      type: String,
      sparse: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'issue_reports',
  }
);

// Targeted indexes for high-frequency queries and platform dashboard sorting
issueReportSchema.index({ 'organisation.organisationId': 1, createdAt: -1 });
issueReportSchema.index({ 'reporter.userId': 1, createdAt: -1 });
issueReportSchema.index({ reportType: 1, feature: 1, createdAt: -1 });
issueReportSchema.index({ createdAt: -1 });
issueReportSchema.index(
  {
    title: 'text',
    description: 'text',
    reportNumber: 'text',
    'reporter.name': 'text',
    'reporter.email': 'text',
  },
  { name: 'idx_issue_report_text_search' }
);

export const IssueReport =
  mongoose.models.IssueReport || mongoose.model('IssueReport', issueReportSchema, 'issue_reports');

export default IssueReport;
