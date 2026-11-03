const crypto = require('crypto');
const path = require('path');

const MAX_RECORDING_BYTES = 50 * 1024 * 1024;

// Audio types phone recorders and common converters produce.
const ALLOWED_MIME_TYPES = {
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/aac': '.aac',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/webm': '.webm',
  'audio/3gpp': '.3gp',
  'audio/amr': '.amr',
};

function isAllowedMimeType(mimeType) {
  return Object.prototype.hasOwnProperty.call(ALLOWED_MIME_TYPES, mimeType);
}

/**
 * Object keys never use the uploaded file name, so a crafted name cannot
 * change the path or overwrite another recording.
 */
function buildStorageKey({ agentId, mimeType, now = new Date() }) {
  const ext = ALLOWED_MIME_TYPES[mimeType] || '.bin';
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const id = crypto.randomUUID();
  return path.posix.join('recordings', String(agentId), String(yyyy), mm, `${id}${ext}`);
}

function safeOriginalName(name) {
  return String(name || '').replace(/[^\w .()-]/g, '_').slice(0, 255);
}

module.exports = {
  MAX_RECORDING_BYTES,
  ALLOWED_MIME_TYPES,
  isAllowedMimeType,
  buildStorageKey,
  safeOriginalName,
};
