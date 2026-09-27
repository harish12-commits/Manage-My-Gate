import mongoose from 'mongoose';

const visitorPassSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    villaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Villa',
      required: false,
      index: true,
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: false,
      index: true,
    },
    passType: {
      type: String,
      enum: ['GUEST', 'DELIVERY', 'CAB', 'SERVICE', 'ADMIN_GUEST'],
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED'],
      default: 'PENDING',
      required: true,
      index: true,
    },
    statusHistory: [
      {
        fromStatus: { type: String, trim: true },
        toStatus: { type: String, trim: true, required: true },
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String, trim: true, maxlength: 500 },
        occurredAt: { type: Date, default: Date.now },
      },
    ],
    isPrivate: {
      type: Boolean,
      default: false,
    },
    isIdProofPass: {
      type: Boolean,
      default: false,
    },
    isGroupPass: {
      type: Boolean,
      default: false,
    },
    purpose: {
      type: String,
      trim: true,
    },
    groupGuests: [
      {
        name: {
          type: String,
          trim: true,
        },
        phone: {
          type: String,
          trim: true,
        },
      },
    ],
    visitorDetails: {
      name: {
        type: String,
        trim: true,
      },
      phone: {
        type: String,
        trim: true,
      },
      idProofType: {
        type: String,
        trim: true,
      },
      idProofNumber: {
        type: String,
        trim: true,
      },
    },
    vehicleDetails: {
      vendor: {
        type: String,
        trim: true,
      },
      number: {
        type: String,
        trim: true,
        uppercase: true,
      },
      vehicleType: {
        type: String,
        trim: true,
        uppercase: true,
      },
    },
    deliveryDetails: {
      partner: {
        type: String,
        trim: true,
      },
      orderId: {
        type: String,
        trim: true,
      },
      packageCount: {
        type: Number,
        default: 1,
      },
      deliveryAction: {
        type: String,
        trim: true,
      },
      instructions: {
        type: String,
        trim: true,
      },
    },
    serviceDetails: {
      category: {
        type: String,
        trim: true,
      },
      notes: {
        type: String,
        trim: true,
      },
    },
    validity: {
      startDate: {
        type: Date,
        required: true,
      },
      endDate: {
        type: Date,
        required: true,
      },
      timeWindowStart: {
        type: String,
        trim: true,
      },
      timeWindowEnd: {
        type: String,
        trim: true,
      },
      timeWindows: [
        {
          start: {
            type: String,
            trim: true,
          },
          end: {
            type: String,
            trim: true,
          },
        },
      ],
      allowedDays: [
        {
          type: Number,
        },
      ],
    },
    usageLimit: {
      maxUses: {
        type: Number,
        default: 1,
      },
      currentUses: {
        type: Number,
        default: 0,
      },
    },
    linkedComplaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      index: true,
    }
  },
  {
    timestamps: true,
  }
);

export const VisitorPass = mongoose.model('VisitorPass', visitorPassSchema);
export default VisitorPass;
