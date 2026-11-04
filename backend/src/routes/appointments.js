const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Appointment = require('../models/Appointment');
const Lead = require('../models/Lead');
const Property = require('../models/Property');
const User = require('../models/User');
const { APPOINTMENT_STATUSES } = require('../models/constants');
const { canAccessLead, isValidId } = require('../services/leadAccess');
const { recordActivity } = require('../services/activity');
const { parsePaging } = require('../services/leadQuery');
const { parseDate } = require('../services/taskQuery');

const validate = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return null;
  return res.status(400).json({ error: errors.array()[0].msg, fields: errors.array() });
};

function createAppointmentsRouter({ requireAuth }) {
  const router = express.Router();
  router.use(requireAuth);

  // Agents see their own appointments. Admins see all and can filter by agent.
  router.get(
    '/',
    query('status').optional().isIn(APPOINTMENT_STATUSES),
    query('lead').optional().isString(),
    query('agent').optional().isString(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    async (req, res, next) => {
      try {
        if (validate(req, res)) return;
        const filter = {};
        if (req.user.role === 'agent') {
          filter.agent = req.user._id;
        } else if (req.query.agent && isValidId(req.query.agent)) {
          filter.agent = req.query.agent;
        }
        if (req.query.lead && isValidId(req.query.lead)) filter.lead = req.query.lead;
        if (req.query.status) filter.status = req.query.status;
        const from = parseDate(req.query.from);
        const to = parseDate(req.query.to);
        if (from || to) {
          filter.scheduledAt = {};
          if (from) filter.scheduledAt.$gte = from;
          if (to) filter.scheduledAt.$lt = to;
        }

        const { page, limit, skip } = parsePaging(req.query);
        const [items, total] = await Promise.all([
          Appointment.find(filter)
            .sort({ scheduledAt: 1 })
            .skip(skip)
            .limit(limit)
            .populate('lead', 'firstName lastName phone country')
            .populate('property', 'title reference')
            .populate('agent', 'name'),
          Appointment.countDocuments(filter),
        ]);
        res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/',
    body('leadId').isString(),
    body('scheduledAt').isISO8601().withMessage('Date and time are required'),
    body('propertyId').optional({ values: 'falsy' }).isString(),
    body('agentId').optional({ values: 'falsy' }).isString(),
    body('location').optional().isString().isLength({ max: 200 }),
    body('notes').optional().isString().isLength({ max: 2000 }),
    async (req, res, next) => {
      try {
        if (validate(req, res)) return;
        if (!isValidId(req.body.leadId)) return res.status(404).json({ error: 'Lead not found' });
        const lead = await Lead.findById(req.body.leadId);
        if (!lead || lead.isArchived || !canAccessLead(req.user, lead)) {
          return res.status(404).json({ error: 'Lead not found' });
        }

        // Agents book only for themselves. Admins may book for any active agent.
        let agentId = req.user._id;
        if (req.body.agentId && req.user.role === 'admin') {
          if (!isValidId(req.body.agentId)) return res.status(400).json({ error: 'Invalid agent' });
          const agent = await User.findOne({ _id: req.body.agentId, isActive: true });
          if (!agent) return res.status(400).json({ error: 'Agent not found or inactive' });
          agentId = agent._id;
        }

        let property;
        if (req.body.propertyId) {
          if (!isValidId(req.body.propertyId)) return res.status(400).json({ error: 'Invalid property' });
          property = await Property.findById(req.body.propertyId);
          if (!property) return res.status(400).json({ error: 'Property not found' });
        }

        const appointment = await Appointment.create({
          lead: lead._id,
          property: property?._id,
          agent: agentId,
          scheduledAt: new Date(req.body.scheduledAt),
          location: req.body.location ?? '',
          notes: req.body.notes ?? '',
        });

        await recordActivity({
          leadId: lead._id,
          userId: req.user._id,
          type: 'task',
          summary: `Appointment booked for ${appointment.scheduledAt.toISOString().slice(0, 16).replace('T', ' ')} UTC${property ? ` (${property.title})` : ''}`,
          details: { appointmentId: appointment._id, action: 'booked' },
        });
        const populated = await appointment.populate([
          { path: 'lead', select: 'firstName lastName phone country' },
          { path: 'property', select: 'title reference' },
          { path: 'agent', select: 'name' },
        ]);
        return res.status(201).json(populated);
      } catch (err) {
        return next(err);
      }
    }
  );

  router.patch(
    '/:id',
    body('status').optional().isIn(APPOINTMENT_STATUSES),
    body('scheduledAt').optional().isISO8601(),
    body('location').optional().isString().isLength({ max: 200 }),
    body('notes').optional().isString().isLength({ max: 2000 }),
    async (req, res, next) => {
      try {
        if (validate(req, res)) return;
        if (!isValidId(req.params.id)) return res.status(404).json({ error: 'Appointment not found' });
        const appointment = await Appointment.findById(req.params.id);
        if (!appointment || (req.user.role !== 'admin' && String(appointment.agent) !== String(req.user._id))) {
          return res.status(404).json({ error: 'Appointment not found' });
        }

        const previous = appointment.status;
        if (req.body.status !== undefined) appointment.status = req.body.status;
        if (req.body.scheduledAt !== undefined) appointment.scheduledAt = new Date(req.body.scheduledAt);
        if (req.body.location !== undefined) appointment.location = req.body.location;
        if (req.body.notes !== undefined) appointment.notes = req.body.notes;
        await appointment.save();

        if (appointment.status !== previous) {
          await recordActivity({
            leadId: appointment.lead,
            userId: req.user._id,
            type: 'task',
            summary: `Appointment marked ${appointment.status}`,
            details: { appointmentId: appointment._id, action: appointment.status },
          });
        }
        return res.json(appointment);
      } catch (err) {
        return next(err);
      }
    }
  );

  return router;
}

function createPropertiesRouter({ requireAuth, requireRole }) {
  const router = express.Router();
  router.use(requireAuth);

  // Everyone can browse listings. Only admins add or change them.
  router.get(
    '/',
    query('search').optional().isString().isLength({ max: 100 }),
    query('available').optional().isIn(['true', 'false']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    async (req, res, next) => {
      try {
        if (validate(req, res)) return;
        const filter = {};
        if (req.query.available) filter.isAvailable = req.query.available === 'true';
        if (req.query.search) {
          const term = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const pattern = new RegExp(term, 'i');
          filter.$or = [{ title: pattern }, { location: pattern }, { reference: pattern }];
        }
        const { page, limit, skip } = parsePaging(req.query);
        const [items, total] = await Promise.all([
          Property.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
          Property.countDocuments(filter),
        ]);
        res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/',
    requireRole('admin'),
    body('title').trim().isLength({ min: 1, max: 160 }),
    body('reference').optional({ values: 'falsy' }).isString().isLength({ max: 60 }),
    body('country').isIn(['AE', 'PK']),
    body('location').optional().isString().isLength({ max: 120 }),
    body('propertyType').optional().isString(),
    body('price').optional({ values: 'null' }).isFloat({ min: 0 }),
    body('currency').optional().isIn(['AED', 'PKR', 'USD']),
    body('bedrooms').optional({ values: 'null' }).isInt({ min: 0 }),
    async (req, res, next) => {
      try {
        if (validate(req, res)) return;
        const property = await Property.create({
          title: req.body.title,
          reference: req.body.reference || undefined,
          country: req.body.country,
          location: req.body.location ?? '',
          propertyType: req.body.propertyType,
          price: req.body.price ?? undefined,
          currency: req.body.currency ?? 'AED',
          bedrooms: req.body.bedrooms ?? undefined,
          createdBy: req.user._id,
        });
        return res.status(201).json(property);
      } catch (err) {
        return next(err);
      }
    }
  );

  router.patch(
    '/:id',
    requireRole('admin'),
    body('title').optional().trim().isLength({ min: 1, max: 160 }),
    body('location').optional().isString().isLength({ max: 120 }),
    body('price').optional({ values: 'null' }).isFloat({ min: 0 }),
    body('isAvailable').optional().isBoolean(),
    async (req, res, next) => {
      try {
        if (validate(req, res)) return;
        if (!isValidId(req.params.id)) return res.status(404).json({ error: 'Property not found' });
        const property = await Property.findByIdAndUpdate(req.params.id, { $set: pick(req.body, ['title', 'location', 'price', 'isAvailable', 'bedrooms', 'propertyType', 'currency']) }, { new: true, runValidators: true });
        if (!property) return res.status(404).json({ error: 'Property not found' });
        return res.json(property);
      } catch (err) {
        return next(err);
      }
    }
  );

  return router;
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

module.exports = { createAppointmentsRouter, createPropertiesRouter };
