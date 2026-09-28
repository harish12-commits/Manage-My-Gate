import mongoose, { Schema } from 'mongoose';

const blacklistSchema = new Schema(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    phone: {
      type: String,
      trim: true
    },
    idProofNumber: {
      type: String,
      trim: true,
      uppercase: true,
      index: true
    },
    plate: {
      type: String,
      trim: true,
      uppercase: true,
      index: true
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    createdById: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

export const Blacklist = mongoose.model('Blacklist', blacklistSchema);
export default Blacklist;
