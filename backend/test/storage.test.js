const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createStorage } = require('../src/services/storage');
const { isAllowedMimeType, buildStorageKey, safeOriginalName, MAX_RECORDING_BYTES } = require('../src/services/recordingRules');

const fakeConfig = {
  endpoint: 'https://s3.example-region.backblazeb2.com',
  region: 'example-region',
  bucket: 'crm-recordings-test',
  keyId: 'test-key-id',
  applicationKey: 'test-application-key',
};

test('creates a signed upload URL offline, scoped to the bucket and key', async () => {
  const storage = createStorage(fakeConfig);
  const { url, expiresInSeconds } = await storage.createUploadUrl({
    key: 'recordings/abc/2026/11/file.m4a',
    mimeType: 'audio/mp4',
    sizeBytes: 1000,
  });
  assert.match(url, /crm-recordings-test/);
  assert.match(url, /X-Amz-Signature=/);
  assert.equal(expiresInSeconds, 600);
});

test('signed download link is short-lived', async () => {
  const storage = createStorage(fakeConfig);
  const { url, expiresInSeconds } = await storage.createDownloadUrl({ key: 'recordings/abc/x.mp3', fileName: 'call 1.mp3' });
  assert.match(url, /X-Amz-Expires=300/);
  assert.equal(expiresInSeconds, 300);
});

test('storage refuses to run when credentials are missing', async () => {
  const storage = createStorage({ ...fakeConfig, keyId: '' });
  await assert.rejects(
    () => storage.createUploadUrl({ key: 'k', mimeType: 'audio/mpeg', sizeBytes: 1 }),
    (err) => err.status === 503 && /keyId/.test(err.message)
  );
});

test('only audio formats are accepted', () => {
  assert.equal(isAllowedMimeType('audio/mpeg'), true);
  assert.equal(isAllowedMimeType('application/x-msdownload'), false);
  assert.equal(isAllowedMimeType('text/html'), false);
  assert.equal(isAllowedMimeType('__proto__'), false);
});

test('storage keys are generated server-side and ignore client file names', () => {
  const key = buildStorageKey({ agentId: '64b000000000000000000001', mimeType: 'audio/mpeg', now: new Date('2026-11-03T00:00:00Z') });
  assert.match(key, /^recordings\/64b000000000000000000001\/2026\/11\/[0-9a-f-]{36}\.mp3$/);
  assert.equal(key.includes('..'), false);
});

test('original file names are sanitized', () => {
  assert.equal(safeOriginalName('../../etc/passwd'), '.._.._etc_passwd');
  assert.equal(safeOriginalName('call (1).mp3'), 'call (1).mp3');
});

test('size limit is 50 MB', () => {
  assert.equal(MAX_RECORDING_BYTES, 50 * 1024 * 1024);
});

test('recording endpoints require authentication', async () => {
  const { createApp } = require('../src/app');
  const app = createApp({
    jwtSecret: 'test-secret-that-is-at-least-32-characters-long',
    jwtExpiresIn: '1h',
    corsOrigin: 'http://localhost:4200',
    storage: fakeConfig,
  }, { storage: createStorage(fakeConfig) });
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const res = await fetch(`${base}/api/v1/recordings/upload-url`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});
