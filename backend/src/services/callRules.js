const Call = require('../models/Call');

const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;
const IMPORT_MATCH_WINDOW_MS = 10 * 60 * 1000;

/** Finds another call by the same agent to the same lead close to the given start time. */
async function findNearbyCall({ leadId, agentId, startedAt, windowMs, excludeId }) {
  const from = new Date(startedAt.getTime() - windowMs);
  const to = new Date(startedAt.getTime() + windowMs);
  const filter = { lead: leadId, agent: agentId, startedAt: { $gte: from, $lte: to } };
  if (excludeId) filter._id = { $ne: excludeId };
  return Call.findOne(filter).sort({ startedAt: 1 });
}

module.exports = { findNearbyCall, DUPLICATE_WINDOW_MS, IMPORT_MATCH_WINDOW_MS };
