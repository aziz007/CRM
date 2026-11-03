const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const UPLOAD_URL_TTL_SECONDS = 10 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

/**
 * Private object storage using Backblaze B2's S3-compatible API.
 * Objects are never public. Clients get short-lived signed URLs only.
 */
function createStorage(config, { client } = {}) {
  const s3 =
    client ||
    new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: { accessKeyId: config.keyId, secretAccessKey: config.applicationKey },
      forcePathStyle: true,
    });

  function assertConfigured() {
    const missing = ['endpoint', 'region', 'bucket', 'keyId', 'applicationKey'].filter((k) => !config[k]);
    if (missing.length) {
      const err = new Error(`Recording storage is not configured (missing ${missing.join(', ')})`);
      err.status = 503;
      throw err;
    }
  }

  return {
    async createUploadUrl({ key, mimeType, sizeBytes }) {
      assertConfigured();
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: mimeType,
        ContentLength: sizeBytes,
      });
      const url = await getSignedUrl(s3, command, { expiresIn: UPLOAD_URL_TTL_SECONDS, signableHeaders: new Set(['content-type', 'content-length']) });
      return { url, expiresInSeconds: UPLOAD_URL_TTL_SECONDS };
    },

    /** Confirms the object exists and matches the declared size and type. */
    async verifyObject({ key, sizeBytes, mimeType }) {
      assertConfigured();
      const head = await s3.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
      const sizeOk = Number(head.ContentLength) === Number(sizeBytes);
      const typeOk = !head.ContentType || head.ContentType.split(';')[0] === mimeType;
      return { exists: true, sizeOk, typeOk };
    },

    async createDownloadUrl({ key, fileName }) {
      assertConfigured();
      const command = new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${String(fileName || 'recording').replace(/[^\w.-]/g, '_')}"`,
      });
      const url = await getSignedUrl(s3, command, { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
      return { url, expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS };
    },

    async deleteObject({ key }) {
      assertConfigured();
      await s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
  };
}

module.exports = { createStorage, UPLOAD_URL_TTL_SECONDS, DOWNLOAD_URL_TTL_SECONDS };
