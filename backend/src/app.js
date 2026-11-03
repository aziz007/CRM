const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { createAuthMiddleware } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errors');
const { createAuthRouter } = require('./routes/auth');
const { createLeadsRouter } = require('./routes/leads');
const { createUsersRouter } = require('./routes/users');
const { createCallsRouter } = require('./routes/calls');
const { createTasksRouter } = require('./routes/tasks');
const { createRecordingsRouter } = require('./routes/recordings');
const { createStorage } = require('./services/storage');

function createApp(config, deps = {}) {
  const storage = deps.storage || createStorage(config.storage || {});
  const app = express();
  const { requireAuth, requireRole } = createAuthMiddleware(config.jwtSecret);

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin, credentials: false }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  const api = express.Router();
  api.use('/auth', createAuthRouter({ jwtSecret: config.jwtSecret, jwtExpiresIn: config.jwtExpiresIn, requireAuth }));

  api.use('/users', createUsersRouter({ requireAuth, requireRole }));
  api.use('/leads', createLeadsRouter({ requireAuth, requireRole }));
  api.use('/calls', createCallsRouter({ requireAuth }));
  api.use('/tasks', createTasksRouter({ requireAuth }));
  api.use('/recordings', createRecordingsRouter({ requireAuth, storage }));

  // Future routes (AI assessment, dashboard) mount here.
  app.use('/api/v1', api);

  app.locals.requireRole = requireRole;

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
