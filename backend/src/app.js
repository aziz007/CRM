const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { createAuthMiddleware } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errors');
const { createAuthRouter } = require('./routes/auth');
const { createLeadsRouter } = require('./routes/leads');
const { createUsersRouter } = require('./routes/users');

function createApp(config) {
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

  // Future routes (calls, tasks, recordings, dashboard) mount here.
  app.use('/api/v1', api);

  app.locals.requireRole = requireRole;

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
