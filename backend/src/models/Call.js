const mongoose = require('mongoose');
const { CALL_OUTCOMES, CALL_DIRECTIONS } = require('./constants');

/**
 * A call made or received by an agent, linked to a lead.
 * - pending: click-to-call started, outcome not yet logged
 * - logged:  agent recorded the outcome
 * verificationStatus is 'verified' only when a device call-log entry confirms the call.
 */
const callSchema = new mongoose.Schema(
  {
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    direction: { type: String, enum: CALL_DIRECTIONS, default: 'outbound' },
    startedAt: { type: Date, required: true, index: true },
    endedAt: Date,
    durationSec: { type: Number, default: 0, min: 0, max: 86400 },
    outcome: { type: String, enum: [...CALL_OUTCOMES, null], default: null },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
    status: { type: String, enum: ['pending', 'logged'], default: 'pending', index: true },
    source: { type: String, enum: ['app', 'device_import'], default: 'app' },
    verificationStatus: { type: String, enum: ['unverified', 'verified'], default: 'unverified', index: true },
    possibleDuplicate: { type: Boolean, default: false },
    duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Call' },
  },
  { timestamps: true }
);

callSchema.index({ lead: 1, agent: 1, startedAt: 1 });

callSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Call', callSchema);
