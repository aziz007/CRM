const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { buildLeadFilter, parsePaging, escapeRegex } = require('../src/services/leadQuery');

const agent = { _id: new mongoose.Types.ObjectId(), role: 'agent' };
const admin = { _id: new mongoose.Types.ObjectId(), role: 'admin' };

test('agents are always restricted to their own leads, even if they ask for another agent', () => {
  const other = new mongoose.Types.ObjectId().toString();
  const filter = buildLeadFilter(agent, { assignedTo: other });
  assert.equal(String(filter.assignedTo), String(agent._id));
});

test('admins can filter by any assigned agent', () => {
  const other = new mongoose.Types.ObjectId().toString();
  const filter = buildLeadFilter(admin, { assignedTo: other });
  assert.equal(String(filter.assignedTo), other);
});

test('invalid status and country values are ignored rather than passed to the database', () => {
  const filter = buildLeadFilter(admin, { status: '$ne', country: 'XX' });
  assert.equal(filter.status, undefined);
  assert.equal(filter.country, undefined);
});

test('search term is escaped so regex characters cannot change the query', () => {
  const filter = buildLeadFilter(admin, { search: '.*' });
  assert.equal(filter.$or[0].firstName.source, '\\.\\*');
  assert.equal(escapeRegex('a+b'), 'a\\+b');
});

test('archived leads are always excluded', () => {
  assert.equal(buildLeadFilter(admin, {}).isArchived, false);
});

test('paging clamps limit and page', () => {
  assert.deepEqual(parsePaging({ page: '0', limit: '500' }), { page: 1, limit: 100, skip: 0 });
  assert.deepEqual(parsePaging({ page: '3', limit: '10' }), { page: 3, limit: 10, skip: 20 });
});
