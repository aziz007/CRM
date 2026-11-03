/**
 * Normalizes a phone number to "+<digits>" form so duplicates can be detected.
 * Accepts formats such as "+971 50 123 4567", "00971-50-1234567", "(0300) 1234567".
 * Returns null when the input has too few or too many digits.
 * Local numbers without a country code cannot be resolved reliably, so they are rejected.
 */
function normalizePhone(input) {
  if (typeof input !== 'string') {
    return null;
  }
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');
  if (!hasPlus && digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (!hasPlus) {
    return null;
  }
  if (digits.length < 8 || digits.length > 15) {
    return null;
  }
  return `+${digits}`;
}

module.exports = { normalizePhone };
