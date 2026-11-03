// Usage: node src/utils/createAdmin.js
// Reads ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, ADMIN_COUNTRY (AE or PK) from the environment.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { connectDatabase } = require('../config/database');

async function main() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, ADMIN_COUNTRY } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_NAME || !ADMIN_COUNTRY) {
    throw new Error('Set ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME and ADMIN_COUNTRY (AE or PK)');
  }
  if (ADMIN_PASSWORD.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters');
  }

  await connectDatabase(process.env.MONGODB_URI);
  const existing = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
  if (existing) {
    console.log('An account with that email already exists. No changes made.');
  } else {
    await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash: await User.hashPassword(ADMIN_PASSWORD),
      role: 'admin',
      country: ADMIN_COUNTRY,
    });
    console.log(`Admin created: ${ADMIN_EMAIL}`);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
