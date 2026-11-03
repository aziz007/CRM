/**
 * Builds the filter for task lists.
 * Agents only see tasks assigned to them. Admins can view any agent's tasks.
 *
 * Due buckets are computed from times the client sends (dayStart, dayEnd, weekEnd),
 * so "today" follows the user's own timezone rather than the server's.
 */
function buildTaskFilter(user, query, now = new Date()) {
  const filter = {};

  if (user.role === 'agent') {
    filter.assignedTo = user._id;
  } else if (query.assignedTo) {
    filter.assignedTo = query.assignedTo;
  }
  if (query.lead) filter.lead = query.lead;

  const status = query.status || 'open';
  if (status === 'all') {
    // no status filter
  } else if (['open', 'done', 'cancelled'].includes(status)) {
    filter.status = status;
  }

  const dayStart = parseDate(query.dayStart);
  const dayEnd = parseDate(query.dayEnd);
  const weekEnd = parseDate(query.weekEnd);

  switch (query.bucket) {
    case 'overdue':
      filter.dueAt = { $lt: now };
      filter.status = 'open';
      break;
    case 'today':
      if (dayStart && dayEnd) filter.dueAt = { $gte: dayStart, $lt: dayEnd };
      break;
    case 'upcoming':
      if (dayEnd && weekEnd) filter.dueAt = { $gte: dayEnd, $lt: weekEnd };
      else if (dayEnd) filter.dueAt = { $gte: dayEnd };
      break;
    default:
      break;
  }
  return filter;
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

module.exports = { buildTaskFilter, parseDate };
