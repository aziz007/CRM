const express = require('express');
const { query, validationResult } = require('express-validator');
const User = require('../models/User');

function createUsersRouter({ requireAuth, requireRole }) {
  const router = express.Router();
  router.use(requireAuth);

  // Lists active users for assignment dropdowns. Agents see only names and roles, not contact details.
  router.get('/', query('role').optional().isIn(['admin', 'agent']), async (req, res, next) => {
    try {
      if (!validationResult(req).isEmpty()) return res.status(400).json({ error: 'Invalid role filter' });
      const filter = { isActive: true };
      if (req.query.role) filter.role = req.query.role;
      const users = await User.find(filter).sort({ name: 1 }).select('name role country phone email');
      if (req.user.role !== 'admin') {
        return res.json({ items: users.map((u) => ({ id: u.id, name: u.name, role: u.role, country: u.country })) });
      }
      return res.json({ items: users });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

module.exports = { createUsersRouter };
