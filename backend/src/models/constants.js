const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Follow-up', 'Appointment', 'Won', 'Lost'];
const LEAD_SOURCES = ['Website', 'Referral', 'Walk-in', 'Property Portal', 'Social Media', 'Cold Call', 'Other'];
const PROPERTY_TYPES = ['Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Plot', 'Commercial', 'Other'];
const PURPOSES = ['Buy', 'Rent', 'Sell', 'Invest'];
const COUNTRIES = ['AE', 'PK'];
const CURRENCIES = ['AED', 'PKR', 'USD'];
const ACTIVITY_TYPES = ['created', 'updated', 'status_changed', 'assigned', 'note', 'call', 'task', 'recording'];
const TASK_STATUSES = ['open', 'done', 'cancelled'];
const TASK_PRIORITIES = ['low', 'normal', 'high'];
const CALL_OUTCOMES = [
  'No Answer', 'Busy', 'Voicemail', 'Wrong Number', 'Not Interested',
  'Callback Requested', 'Interested', 'Appointment Set', 'Other',
];
const CALL_DIRECTIONS = ['outbound', 'inbound'];
const APPOINTMENT_STATUSES = ['Scheduled', 'Completed', 'Cancelled', 'No Show'];

module.exports = {
  LEAD_STATUSES,
  LEAD_SOURCES,
  PROPERTY_TYPES,
  PURPOSES,
  COUNTRIES,
  CURRENCIES,
  ACTIVITY_TYPES,
  APPOINTMENT_STATUSES,
  CALL_OUTCOMES,
  CALL_DIRECTIONS,
  TASK_STATUSES,
  TASK_PRIORITIES,
};
