import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['org_admin', 'manager', 'member'], default: 'member' },
    isActive: { type: Boolean, default: true },
    avatarUrl: { type: String, default: '' },
    lastLogin: { type: Date, default: null },
    preferences: {
      emailNotifications: { type: Boolean, default: true },
      projectUpdates: { type: Boolean, default: true },
      defaultProjectView: { type: String, enum: ['list', 'card'], default: 'list' },
      sortPreference: { type: String, default: 'newest' },
      theme: { type: String, enum: ['light', 'dark'], default: 'light' }
    }
  },
  { timestamps: true }
);

userSchema.index({ organizationId: 1, email: 1 }, { unique: true });

export const User = mongoose.model('User', userSchema);
