const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { createApp } = require('../src/app');
const { buildTaskFilter, parseDate } = require('../src/services/taskQuery');

const agent = { _id: new mongoose.Types.ObjectId(), role: 'agent' };
const admin = { _id: new mongoose.Types.ObjectId(), role: 'admin' };

test('agents only see tasks assigned to them', () => {
  const filter = buildTaskFilter(agent, { assignedTo: new mongoose.Types.ObjectId().toString() });
  assert.equal(String(filter.assignedTo), String(agent._id));
});

test('overdue bucket shows only open tasks due before now', () => {
  const now = new Date('2026-11-03T12:00:00Z');
  const filter = buildTaskFilter(admin, { bucket: 'overdue' }, now);
  assert.equal(filter.status, 'open');
  assert.equal(filter.dueAt.$lt.getTime(), now.getTime());
});

test('today bucket uses the day boundaries sent by the client', () => {
  const filter = buildTaskFilter(admin, {
    bucket: 'today',
    dayStart: '2026-11-03T00:00:00+05:00',
    dayEnd: '2026-11-04T00:00:00+05:00',
  });
  assert.equal(filter.dueAt.$gte.toISOString(), '2026-11-02T19:00:00.000Z');
  assert.equal(filter.dueAt.$lt.toISOString(), '2026-11-03T19:00:00.000Z');
});

test('default status is open and "all" removes the status filter', () => {
  assert.equal(buildTaskFilter(admin, {}).status, 'open');
  assert.equal(buildTaskFilter(admin, { status: 'all' }).status, undefined);
});

test('invalid dates are ignored', () => {
  assert.equal(parseDate('not-a-date'), null);
});

test('task endpoints require authentication', async () => {
  const app = createApp({
    jwtSecret: 'test-secret-that-is-at-least-32-characters-long',
    jwtExpiresIn: '1h',
    corsOrigin: 'http://localhost:4200',
  });
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const path of ['/api/v1/tasks', '/api/v1/tasks/summary']) {
      const res = await fetch(`${base}${path}`);
      assert.equal(res.status, 401, path);
    }
  } finally {
    server.close();
  }
});
