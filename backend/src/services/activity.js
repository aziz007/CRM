const Activity = require('../models/Activity');

async function recordActivity({ leadId, userId, type, summary, details }) {
  return Activity.create({ lead: leadId, user: userId, type, summary, details });
}

module.exports = { recordActivity };
