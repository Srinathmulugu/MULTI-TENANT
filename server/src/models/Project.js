import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Completed'],
      default: 'Pending',
      index: true
    },
    progressPercentage: { type: Number, default: 0, min: 0, max: 100 },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    memberIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    submissionStatus: {
      type: String,
      enum: ['Not Submitted', 'Submitted', 'Approved', 'Rejected'],
      default: 'Not Submitted',
      index: true
    },
    submissionVersion: { type: Number, default: 0 },
    submissionNote: { type: String, default: '' },
    submissionFileName: { type: String, default: '' },
    submissionOriginalName: { type: String, default: '' },
    submissionFilePath: { type: String, default: '' },
    submissionSubmittedAt: { type: Date, default: null },
    submissionReviewedAt: { type: Date, default: null },
    submissionReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    submissionReviewNote: { type: String, default: '' },
    submissionHistory: [
      {
        version: { type: Number, required: true },
        note: { type: String, default: '' },
        originalName: { type: String, default: '' },
        fileName: { type: String, default: '' },
        filePath: { type: String, default: '' },
        size: { type: Number, default: 0 },
        mimeType: { type: String, default: '' },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        uploadedAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

projectSchema.index({ organizationId: 1, createdAt: -1 });

export const Project = mongoose.model('Project', projectSchema);
