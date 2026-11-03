require('dotenv').config();

const required = ['MONGODB_URI', 'JWT_SECRET'];

function loadEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT) || 4000,
    mongoUri: process.env.MONGODB_URI,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:4200',
    storage: {
      endpoint: process.env.B2_ENDPOINT || '',
      region: process.env.B2_REGION || '',
      bucket: process.env.B2_BUCKET || '',
      keyId: process.env.B2_KEY_ID || '',
      applicationKey: process.env.B2_APPLICATION_KEY || '',
    },
  };
}

module.exports = { loadEnv };
