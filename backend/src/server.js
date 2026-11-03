const { loadEnv } = require('./config/env');
const { connectDatabase } = require('./config/database');
const { createApp } = require('./app');

async function start() {
  const config = loadEnv();
  await connectDatabase(config.mongoUri);

  const app = createApp(config);
  app.listen(config.port, () => {
    console.log(`CRM API listening on port ${config.port} (${config.nodeEnv})`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
