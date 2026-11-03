const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhone } = require('../src/utils/phone');

test('normalizes UAE and Pakistan numbers with spaces and dashes', () => {
  assert.equal(normalizePhone('+971 50 123 4567'), '+971501234567');
  assert.equal(normalizePhone('+92-300-1234567'), '+923001234567');
});

test('converts 00 international prefix to +', () => {
  assert.equal(normalizePhone('00971501234567'), '+971501234567');
});

test('rejects local numbers without a country code', () => {
  assert.equal(normalizePhone('0501234567'), null);
});

test('rejects numbers with too few or too many digits', () => {
  assert.equal(normalizePhone('+123'), null);
  assert.equal(normalizePhone('+1234567890123456'), null);
});

test('rejects non-string input', () => {
  assert.equal(normalizePhone(undefined), null);
  assert.equal(normalizePhone(12345678), null);
});
