import mongoose from 'mongoose';

const visitorLogSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    passId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VisitorPass',
      index: true,
    },
    guardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    gateName: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    entryType: {
      type: String,
      enum: ['PRE_APPROVED', 'WALK_IN'],
      required: true,
    },
    logStatus: {
      type: String,
      enum: ['PENDING', 'INSIDE', 'COMPLETED', 'REJECTED'],
      required: true,
      index: true,
    },
    snapshot: {
      visitorName: {
        type: String,
        trim: true,
      },
      phone: {
        type: String,
        trim: true,
      },
      idProofNumber: {
        type: String,
        trim: true,
      },
      vehicleNumber: {
        type: String,
        trim: true,
      },
    },
    checkInTime: {
      type: Date,
    },
    checkOutTime: {
      type: Date,
    },
    actionHistory: [
      {
        action: { type: String, enum: ['REQUESTED', 'APPROVED', 'REJECTED', 'CHECKED_IN', 'CHECKED_OUT'], required: true },
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        gateName: { type: String, trim: true, maxlength: 120 },
        occurredAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const VisitorLog = mongoose.model('VisitorLog', visitorLogSchema);
export default VisitorLog;
