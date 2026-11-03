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

test('call endpoints require authentication', async () => {
  await withServer(async (base) => {
    const cases = [
      ['GET', '/api/v1/calls'],
      ['POST', '/api/v1/calls/start'],
      ['POST', '/api/v1/calls'],
      ['POST', '/api/v1/calls/import'],
    ];
    for (const [method, path] of cases) {
      const init = { method, headers: { 'content-type': 'application/json' } };
      if (method !== 'GET') init.body = '{}';
      const res = await fetch(`${base}${path}`, init);
      assert.equal(res.status, 401, `${method} ${path}`);
    }
  });
});
