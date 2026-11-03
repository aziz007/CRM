const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');

const app = createApp({
  jwtSecret: 'test-secret-that-is-at-least-32-characters-long',
  jwtExpiresIn: '1h',
  corsOrigin: 'http://localhost:4200',
});

async function withServer(fn) {
  const server = app.listen(0);
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

test('lead endpoints require authentication', async () => {
  await withServer(async (base) => {
    for (const path of ['/api/v1/leads', '/api/v1/users']) {
      const res = await fetch(`${base}${path}`);
      assert.equal(res.status, 401, path);
    }
  });
});
