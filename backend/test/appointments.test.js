const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');

const app = createApp({
  jwtSecret: 'test-secret-that-is-at-least-32-characters-long',
  jwtExpiresIn: '1h',
  corsOrigin: 'http://localhost:4200',
});

test('appointment and property endpoints require authentication', async () => {
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const path of ['/api/v1/appointments', '/api/v1/properties']) {
      const res = await fetch(`${base}${path}`);
      assert.equal(res.status, 401, path);
    }
  } finally {
    server.close();
  }
});
