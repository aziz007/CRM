const mongoose = require('mongoose');

/**
 * Metadata for an uploaded call recording. The audio itself lives in private object storage.
 * Consent is recorded at upload time and cannot be uploaded without it.
 */
const recordingSchema = new mongoose.Schema(
  {
    call: { type: mongoose.Schema.Types.ObjectId, ref: 'Call', required: true, index: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    storageKey: { type: String, required: true, unique: true },
    originalName: { type: String, trim: true, maxlength: 255, default: '' },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 1 },
    durationSec: { type: Number, min: 0 },
    consent: {
      confirmed: { type: Boolean, required: true, validate: (v) => v === true },
      confirmedAt: { type: Date, required: true },
      confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    },
    uploadStatus: { type: String, enum: ['pending', 'uploaded', 'failed'], default: 'pending', index: true },
    uploadedAt: Date,
    processingStatus: { type: String, enum: ['not_started', 'queued', 'processing', 'done', 'failed'], default: 'not_started' },
  },
  { timestamps: true }
);

recordingSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v;
    delete ret.storageKey;
    return ret;
  },
});

module.exports = mongoose.model('Recording', recordingSchema);
