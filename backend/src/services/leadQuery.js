const mongoose = require('mongoose');
const { LEAD_STATUSES, LEAD_SOURCES, PROPERTY_TYPES, PURPOSES, COUNTRIES } = require('../models/constants');

const MAX_LIMIT = 100;

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds the Mongo filter for the lead list.
 * Agents are always limited to their own leads. Admins may filter by any agent.
 */
function buildLeadFilter(user, query) {
  const filter = { isArchived: false };

  if (user.role === 'agent') {
    filter.assignedTo = user._id;
  } else if (query.assignedTo) {
    filter.assignedTo = new mongoose.Types.ObjectId(query.assignedTo);
  }

  if (query.status && LEAD_STATUSES.includes(query.status)) {
    filter.status = query.status;
  }
  if (query.country && COUNTRIES.includes(query.country)) {
    filter.country = query.country;
  }
  if (query.source && LEAD_SOURCES.includes(query.source)) {
    filter.source = query.source;
  }
  if (query.propertyType && PROPERTY_TYPES.includes(query.propertyType)) {
    filter.propertyType = query.propertyType;
  }
  if (query.purpose && PURPOSES.includes(query.purpose)) {
    filter.purpose = query.purpose;
  }
  if (query.search) {
    const term = escapeRegex(String(query.search).trim().slice(0, 100));
    if (term) {
      const pattern = new RegExp(term, 'i');
      filter.$or = [
        { firstName: pattern },
        { lastName: pattern },
        { phone: pattern },
        { email: pattern },
        { location: pattern },
      ];
    }
  }
  return filter;
}

function parsePaging(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  updated: { updatedAt: -1 },
  name: { firstName: 1, lastName: 1 },
};

function parseSort(sort) {
  return SORTS[sort] || SORTS.newest;
}

module.exports = { buildLeadFilter, parsePaging, parseSort, escapeRegex };
