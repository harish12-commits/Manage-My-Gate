import mongoose from 'mongoose';

/**
 * MessageTemplate Schema
 * Scoped per organization, supporting email, SMS, and WhatsApp alerts dynamically.
 */
const messageTemplateSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    type: {
      type: String,
      required: [true, 'Template channel type is required (e.g., email, sms, whatsapp)'],
      trim: true,
    },
    purpose: {
      type: String,
      required: [true, 'Template purpose is required'],
      enum: ['user_invitation', 'invoice_generated', 'invoice_reminder', 'invoice_overdue', 'invoice_receipt', 'default'],
      default: 'default',
      trim: true,
    },
    subject: {
      type: String,
      trim: true,
      maxlength: [150, 'Subject cannot exceed 150 characters'],
      default: '',
    },
    cc: {
      type: String,
      trim: true,
      default: '',
    },
    bcc: {
      type: String,
      trim: true,
      default: '',
    },
    body: {
      type: String,
      required: [true, 'Template body content is required'],
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce that an organization can have at most one template setup per provider/channel type and purpose
messageTemplateSchema.index({ orgId: 1, type: 1, purpose: 1 }, { unique: true });

export const MessageTemplate = mongoose.model('MessageTemplate', messageTemplateSchema);
export default MessageTemplate;
