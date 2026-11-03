const jwt = require('jsonwebtoken');
const User = require('../models/User');

function createAuthMiddleware(jwtSecret) {
  async function requireAuth(req, res, next) {
    try {
      const header = req.headers.authorization || '';
      const [scheme, token] = header.split(' ');
      if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
      const user = await User.findById(payload.sub);
      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'Account is not active' });
      }

      req.user = user;
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  function requireRole(...roles) {
    return (req, res, next) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'You do not have permission to do this' });
      }
      return next();
    };
  }

  return { requireAuth, requireRole };
}

module.exports = { createAuthMiddleware };
