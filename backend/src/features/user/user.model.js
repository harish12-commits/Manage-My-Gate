import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    emailVerified: {
      type: Boolean,
      default: true,
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: function() {
        return this.status === 'Active';
      },
    },
    status: {
      type: String,
      enum: ['Pending Verification', 'Active', 'Suspended', 'Blocked', 'Deleted'],
      default: 'Pending Verification',
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    privacyPolicyAcceptedAt: {
      type: Date,
      default: null,
    },
    name: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      set: (v) => (v === null || v === '' ? undefined : v),
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
    },
    avatar: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    work: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    hometown: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },

    // --- LEGACY BACKWARD-COMPATIBILITY FIELDS ---
    // NOTE (GAP-04): The canonical source of truth for multi-tenant gated community data is OrgMembership
    // (OrgMembership.roleIds, OrgMembership.units, OrgMembership.residentType, OrgMembership.status).
    // The root fields below are maintained strictly as backward-compatible caches for legacy single-tenant
    // consumers, directory queries, and older clients. They MUST NOT be used for multi-tenant authorization.
    villaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Villa',
      default: null,
    },
    residencyType: {
      type: String,
      default: 'None',
    },
    roles: {
      type: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
        index: true,
      }],
      default: [],
    },
    // Directory Privacy Settings
    showPhoneInDirectory: {
      type: Boolean,
      default: true,
    },
    allowDirectoryMessages: {
      type: Boolean,
      default: true,
    },
    allowIntercomCalls: {
      type: Boolean,
      default: true,
    },
    hideFromDirectory: {
      type: Boolean,
      default: false,
    },
    interests: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: { phone: { $type: 'string', $gt: '' } },
  }
);

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
