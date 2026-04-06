import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    settings: {
      passwordMinLength: { type: Number, default: 8 },
      sessionTimeoutMinutes: { type: Number, default: 60 },
      theme: { type: String, enum: ['light', 'dark'], default: 'light' }
    }
  },
  { timestamps: true }
);

export const Organization = mongoose.model('Organization', organizationSchema);
