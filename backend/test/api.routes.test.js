const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');

// These tests do not need a database: they cover routes that respond before any DB lookup.
const app = createApp({
  jwtSecret: 'test-secret-that-is-at-least-32-characters-long',
  jwtExpiresIn: '1h',
  corsOrigin: 'http://localhost:4200',
});

async function withServer(fn) {
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    server.close();
  }
}

test('health endpoint responds', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
  });
});

test('login rejects a malformed body before touching the database', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: '' }),
    });
    assert.equal(res.status, 400);
  });
});

test('protected endpoint rejects requests without a token', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/v1/auth/me`);
    assert.equal(res.status, 401);
  });
});

test('unknown routes return 404 JSON', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/does-not-exist`);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'Not found' });
  });
});
