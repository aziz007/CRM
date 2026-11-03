const mongoose = require('mongoose');
const { ACTIVITY_TYPES } = require('./constants');

// Audit trail for a lead: creation, edits, status changes, assignments and notes.
const activitySchema = new mongoose.Schema(
  {
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    summary: { type: String, required: true, maxlength: 500 },
    details: { type: mongoose.Schema.Types.Mixed, default: undefined },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activitySchema.index({ lead: 1, createdAt: -1 });

activitySchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Activity', activitySchema);
