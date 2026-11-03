const mongoose = require('mongoose');

/** Returns true if the user may view or change the lead. */
function canAccessLead(user, lead) {
  if (user.role === 'admin') {
    return true;
  }
  return String(lead.assignedTo) === String(user._id);
}

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
}

module.exports = { canAccessLead, isValidId };
