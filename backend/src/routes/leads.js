const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Lead = require('../models/Lead');
const Activity = require('../models/Activity');
const User = require('../models/User');
const { LEAD_STATUSES, LEAD_SOURCES, PROPERTY_TYPES, PURPOSES, COUNTRIES, CURRENCIES } = require('../models/constants');
const { buildLeadFilter, parsePaging, parseSort } = require('../services/leadQuery');
const { canAccessLead, isValidId } = require('../services/leadAccess');
const { recordActivity } = require('../services/activity');
const { normalizePhone } = require('../utils/phone');

const validate = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return null;
  }
  return res.status(400).json({ error: errors.array()[0].msg, fields: errors.array() });
};

const optionalNumber = (field) =>
  body(field).optional({ values: 'null' }).isFloat({ min: 0 }).withMessage(`${field} must be a positive number`);

const leadFields = [
  body('firstName').trim().isLength({ min: 1, max: 80 }).withMessage('First name is required (max 80 characters)'),
  body('lastName').optional().trim().isLength({ max: 80 }),
  body('phone').isString().withMessage('Phone number is required'),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Enter a valid email address'),
  body('country').isIn(COUNTRIES).withMessage('Country must be AE or PK'),
  body('location').optional().trim().isLength({ max: 120 }),
  body('purpose').optional().isIn(PURPOSES),
  body('propertyType').optional().isIn(PROPERTY_TYPES),
  optionalNumber('budgetMin'),
  optionalNumber('budgetMax'),
  body('currency').optional().isIn(CURRENCIES),
  body('source').optional().isIn(LEAD_SOURCES),
  body('status').optional().isIn(LEAD_STATUSES),
  body('notes').optional().isString().isLength({ max: 5000 }),
];

// Fields an agent may change on their own lead. Reassignment is admin-only.
const EDITABLE_FIELDS = [
  'firstName', 'lastName', 'phone', 'email', 'country', 'location', 'purpose', 'propertyType',
  'budgetMin', 'budgetMax', 'currency', 'source', 'status', 'notes', 'lastContactedAt',
];

function pickEditable(input) {
  const out = {};
  for (const key of EDITABLE_FIELDS) {
    if (input[key] !== undefined) {
      out[key] = input[key];
    }
  }
  return out;
}

function checkBudget(data, existing) {
  const min = data.budgetMin ?? existing?.budgetMin;
  const max = data.budgetMax ?? existing?.budgetMax;
  if (min != null && max != null && min > max) {
    return 'Minimum budget cannot be greater than maximum budget';
  }
  return null;
}

function displayName(lead) {
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ');
}

function createLeadsRouter({ requireAuth, requireRole }) {
  const router = express.Router();
  router.use(requireAuth);

  // List with search, filters, sorting and pagination.
  router.get(
    '/',
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    async (req, res, next) => {
      try {
        if (validate(req, res)) return;
        const filter = buildLeadFilter(req.user, req.query);
        const { page, limit, skip } = parsePaging(req.query);
        const [items, total] = await Promise.all([
          Lead.find(filter).sort(parseSort(req.query.sort)).skip(skip).limit(limit).populate('assignedTo', 'name role'),
          Lead.countDocuments(filter),
        ]);
        res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
      } catch (err) {
        next(err);
      }
    }
  );

  // Create. Agents always own the leads they create. Admins may assign to any active user.
  router.post('/', ...leadFields, body('assignedTo').optional().isString(), async (req, res, next) => {
    try {
      if (validate(req, res)) return;

      const phone = normalizePhone(req.body.phone);
      if (!phone) {
        return res.status(400).json({ error: 'Enter a valid phone number with country code, e.g. +971501234567' });
      }

      let assignedTo = req.user._id;
      if (req.body.assignedTo !== undefined && req.user.role === 'admin') {
        if (!isValidId(req.body.assignedTo)) {
          return res.status(400).json({ error: 'Invalid agent' });
        }
        const agent = await User.findOne({ _id: req.body.assignedTo, isActive: true });
        if (!agent) {
          return res.status(400).json({ error: 'Assigned user not found or inactive' });
        }
        assignedTo = agent._id;
      }

      const data = pickEditable(req.body);
      const budgetError = checkBudget(data);
      if (budgetError) return res.status(400).json({ error: budgetError });

      // Duplicate check: same phone number in the same country.
      const duplicate = await Lead.findOne({ phone, country: data.country, isArchived: false }).select('firstName lastName assignedTo');
      if (duplicate) {
        return res.status(409).json({
          error: `A lead with this phone number already exists (${displayName(duplicate)}).`,
          duplicateId: duplicate.id,
        });
      }

      const lead = await Lead.create({ ...data, phone, assignedTo, createdBy: req.user._id });
      await recordActivity({
        leadId: lead._id,
        userId: req.user._id,
        type: 'created',
        summary: `Lead created and assigned`,
      });
      const populated = await lead.populate('assignedTo', 'name role');
      return res.status(201).json(populated);
    } catch (err) {
      return next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json({ error: 'Lead not found' });
      const lead = await Lead.findById(req.params.id).populate('assignedTo', 'name role');
      if (!lead || lead.isArchived || !canAccessLead(req.user, lead)) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      return res.json(lead);
    } catch (err) {
      return next(err);
    }
  });

  router.patch(
    '/:id',
    body('firstName').optional().trim().isLength({ min: 1, max: 80 }),
    body('lastName').optional().trim().isLength({ max: 80 }),
    body('email').optional({ values: 'falsy' }).isEmail(),
    body('country').optional().isIn(COUNTRIES),
    body('location').optional().trim().isLength({ max: 120 }),
    body('purpose').optional().isIn(PURPOSES),
    body('propertyType').optional().isIn(PROPERTY_TYPES),
    optionalNumber('budgetMin'),
    optionalNumber('budgetMax'),
    body('currency').optional().isIn(CURRENCIES),
    body('source').optional().isIn(LEAD_SOURCES),
    body('status').optional().isIn(LEAD_STATUSES),
    body('notes').optional().isString().isLength({ max: 5000 }),
    body('assignedTo').optional().isString(),
    async (req, res, next) => {
      try {
        if (validate(req, res)) return;
        if (!isValidId(req.params.id)) return res.status(404).json({ error: 'Lead not found' });

        const lead = await Lead.findById(req.params.id);
        if (!lead || lead.isArchived || !canAccessLead(req.user, lead)) {
          return res.status(404).json({ error: 'Lead not found' });
        }

        const changes = pickEditable(req.body);
        if (req.body.phone !== undefined) {
          const phone = normalizePhone(req.body.phone);
          if (!phone) {
            return res.status(400).json({ error: 'Enter a valid phone number with country code, e.g. +971501234567' });
          }
          changes.phone = phone;
        }
        const budgetError = checkBudget(changes, lead);
        if (budgetError) return res.status(400).json({ error: budgetError });

        const log = [];
        const previousStatus = lead.status;
        const previousAssignee = String(lead.assignedTo);

        if (req.body.assignedTo !== undefined) {
          if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can reassign leads' });
          }
          if (!isValidId(req.body.assignedTo)) return res.status(400).json({ error: 'Invalid agent' });
          const agent = await User.findOne({ _id: req.body.assignedTo, isActive: true });
          if (!agent) return res.status(400).json({ error: 'Assigned user not found or inactive' });
          if (String(agent._id) !== previousAssignee) {
            changes.assignedTo = agent._id;
            log.push({ type: 'assigned', summary: `Reassigned to ${agent.name}`, details: { from: previousAssignee, to: String(agent._id) } });
          }
        }

        const changedKeys = Object.keys(changes).filter((key) => String(lead[key] ?? '') !== String(changes[key] ?? ''));
        Object.assign(lead, changes);
        await lead.save();

        if (changedKeys.includes('status') && lead.status !== previousStatus) {
          log.unshift({
            type: 'status_changed',
            summary: `Status changed from ${previousStatus} to ${lead.status}`,
            details: { from: previousStatus, to: lead.status },
          });
        }
        const otherKeys = changedKeys.filter((k) => !['status', 'assignedTo'].includes(k));
        if (otherKeys.length) {
          log.push({ type: 'updated', summary: `Updated ${otherKeys.join(', ')}`, details: { fields: otherKeys } });
        }
        for (const entry of log) {
          await recordActivity({ leadId: lead._id, userId: req.user._id, ...entry });
        }

        const populated = await lead.populate('assignedTo', 'name role');
        return res.json(populated);
      } catch (err) {
        return next(err);
      }
    }
  );

  // Soft delete (archive). Admins only, so agents cannot remove their history.
  router.delete('/:id', requireRole('admin'), async (req, res, next) => {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json({ error: 'Lead not found' });
      const lead = await Lead.findOne({ _id: req.params.id, isArchived: false });
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      lead.isArchived = true;
      await lead.save();
      await recordActivity({ leadId: lead._id, userId: req.user._id, type: 'updated', summary: 'Lead archived', details: { archived: true } });
      return res.status(204).end();
    } catch (err) {
      return next(err);
    }
  });

  router.get('/:id/activities', async (req, res, next) => {
    try {
      if (!isValidId(req.params.id)) return res.status(404).json({ error: 'Lead not found' });
      const lead = await Lead.findById(req.params.id).select('assignedTo isArchived');
      if (!lead || !canAccessLead(req.user, lead)) return res.status(404).json({ error: 'Lead not found' });
      const items = await Activity.find({ lead: lead._id }).sort({ createdAt: -1 }).limit(200).populate('user', 'name role');
      return res.json({ items });
    } catch (err) {
      return next(err);
    }
  });

  router.post(
    '/:id/activities',
    body('note').trim().isLength({ min: 1, max: 2000 }).withMessage('Note must be 1 to 2000 characters'),
    async (req, res, next) => {
      try {
        if (validate(req, res)) return;
        if (!isValidId(req.params.id)) return res.status(404).json({ error: 'Lead not found' });
        const lead = await Lead.findById(req.params.id).select('assignedTo isArchived');
        if (!lead || lead.isArchived || !canAccessLead(req.user, lead)) return res.status(404).json({ error: 'Lead not found' });

        const activity = await recordActivity({
          leadId: lead._id,
          userId: req.user._id,
          type: 'note',
          summary: req.body.note.trim(),
        });
        return res.status(201).json(activity);
      } catch (err) {
        return next(err);
      }
    }
  );

  return router;
}

module.exports = { createLeadsRouter };
