// Usage: npm run storage:check
// Confirms the B2 bucket is reachable, then uploads, verifies, downloads and deletes a small test object.
require('dotenv').config();
const { createStorage } = require('../services/storage');
const { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

async function main() {
  const config = {
    endpoint: process.env.B2_ENDPOINT,
    region: process.env.B2_REGION,
    bucket: process.env.B2_BUCKET,
    keyId: process.env.B2_KEY_ID,
    applicationKey: process.env.B2_APPLICATION_KEY,
  };
  const storage = createStorage(config);
  const key = `healthcheck/${Date.now()}.txt`;
  const body = Buffer.from('crm storage check');

  const s3 = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.keyId, secretAccessKey: config.applicationKey },
    forcePathStyle: true,
  });

  // 1. Signed upload link, then upload with it (the same path the app's browser uploads use).
  const { url } = await storage.createUploadUrl({ key, mimeType: 'text/plain', sizeBytes: body.length });
  const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'text/plain', 'Content-Length': String(body.length) }, body });
  if (!put.ok) throw new Error(`Signed upload failed: HTTP ${put.status}`);
  console.log('1/4 signed upload accepted');

  // 2. Verify size and type, the same check the complete step uses.
  const check = await storage.verifyObject({ key, sizeBytes: body.length, mimeType: 'text/plain' });
  if (!check.sizeOk) throw new Error('Size check failed');
  console.log('2/4 object verified');

  // 3. Signed download link.
  const dl = await storage.createDownloadUrl({ key, fileName: 'check.txt' });
  const got = await fetch(dl.url);
  if (!got.ok || (await got.text()) !== body.toString()) throw new Error('Signed download failed or content differs');
  console.log('3/4 signed download matches');

  // 4. Clean up.
  await storage.deleteObject({ key });
  console.log('4/4 test object deleted');
  console.log('OK: B2 storage is working.');
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  if (err.$metadata) console.error('HTTP status:', err.$metadata.httpStatusCode);
  process.exit(1);
});
