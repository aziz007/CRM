const mongoose = require('mongoose');
const { APPOINTMENT_STATUSES } = require('./constants');

const appointmentSchema = new mongoose.Schema(
  {
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    scheduledAt: { type: Date, required: true, index: true },
    status: { type: String, enum: APPOINTMENT_STATUSES, default: 'Scheduled' },
    location: { type: String, trim: true, maxlength: 200, default: '' },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Appointment', appointmentSchema);
