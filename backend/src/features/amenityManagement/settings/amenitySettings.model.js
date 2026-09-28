import mongoose from 'mongoose';

/**
 * Community-wide amenity rules (one document per organization). Facility-level
 * fields win where a facility defines them; these are the community defaults.
 */
const amenitySettingsSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      unique: true,
    },
    quota: {
      // Household booking allowance per facility, in minutes per period.
      enabled: { type: Boolean, default: true },
      period: { type: String, enum: ['MONTHLY'], default: 'MONTHLY' },
      limitMinutes: { type: Number, default: 2400, min: [60, 'Quota must be at least 60 minutes'] },
      // Stays, loans and events run for days, so they get a larger allowance.
      longDurationLimitMinutes: { type: Number, default: 43200, min: [60, 'Quota must be at least 60 minutes'] },
    },
    approvalTimeoutHours: {
      type: Number,
      default: 24,
      min: [1, 'Approval timeout must be at least 1 hour'],
      max: [720, 'Approval timeout cannot exceed 30 days'],
    },
    checkInEarlyMinutes: {
      type: Number,
      default: 15,
      min: [0, 'Early check-in window cannot be negative'],
      max: [240, 'Early check-in window cannot exceed 4 hours'],
    },
    noShowGraceMinutes: {
      type: Number,
      default: 30,
      min: [0, 'No-show grace cannot be negative'],
      max: [1440, 'No-show grace cannot exceed 24 hours'],
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'amenity_management_settings',
  }
);

export const AmenitySettings = mongoose.model('AmenitySettings', amenitySettingsSchema);
export default AmenitySettings;
