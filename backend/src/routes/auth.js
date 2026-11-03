const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');

function createAuthRouter({ jwtSecret, jwtExpiresIn, requireAuth }) {
  const router = express.Router();

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Try again later.' },
  });

  router.post(
    '/login',
    loginLimiter,
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 1, max: 200 }),
    async (req, res, next) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
        // Same response for unknown email and wrong password, to avoid account enumeration.
        const valid = user && user.isActive && (await user.verifyPassword(req.body.password));
        if (!valid) {
          return res.status(401).json({ error: 'Invalid email or password' });
        }

        user.lastLoginAt = new Date();
        await user.save();

        const token = jwt.sign({ sub: user.id, role: user.role }, jwtSecret, {
          algorithm: 'HS256',
          expiresIn: jwtExpiresIn,
        });
        return res.json({ token, user });
      } catch (err) {
        return next(err);
      }
    }
  );

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  return router;
}

module.exports = { createAuthRouter };
