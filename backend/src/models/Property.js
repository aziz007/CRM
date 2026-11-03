const mongoose = require('mongoose');
const { PROPERTY_TYPES, COUNTRIES, CURRENCIES } = require('./constants');

// Listings that leads can be matched to. Full listing management comes later.
const propertySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    reference: { type: String, trim: true, maxlength: 60, unique: true, sparse: true },
    country: { type: String, enum: COUNTRIES, required: true },
    location: { type: String, trim: true, maxlength: 120, default: '' },
    propertyType: { type: String, enum: PROPERTY_TYPES, default: 'Apartment' },
    price: { type: Number, min: 0 },
    currency: { type: String, enum: CURRENCIES, default: 'AED' },
    bedrooms: { type: Number, min: 0 },
    isAvailable: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Property', propertySchema);
