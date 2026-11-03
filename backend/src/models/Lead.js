const mongoose = require('mongoose');
const {
  LEAD_STATUSES,
  LEAD_SOURCES,
  PROPERTY_TYPES,
  PURPOSES,
  COUNTRIES,
  CURRENCIES,
} = require('./constants');

const leadSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, trim: true, maxlength: 80, default: '' },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
    country: { type: String, enum: COUNTRIES, required: true },
    location: { type: String, trim: true, maxlength: 120, default: '' },
    purpose: { type: String, enum: PURPOSES, default: 'Buy' },
    propertyType: { type: String, enum: PROPERTY_TYPES, default: 'Apartment' },
    budgetMin: { type: Number, min: 0 },
    budgetMax: { type: Number, min: 0 },
    currency: { type: String, enum: CURRENCIES, default: 'AED' },
    source: { type: String, enum: LEAD_SOURCES, default: 'Other' },
    status: { type: String, enum: LEAD_STATUSES, default: 'New' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, maxlength: 5000, default: '' },
    lastContactedAt: Date,
    isArchived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

leadSchema.index({ phone: 1 });
leadSchema.index({ status: 1, assignedTo: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ firstName: 'text', lastName: 'text', phone: 'text', email: 'text', location: 'text' });

leadSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Lead', leadSchema);
