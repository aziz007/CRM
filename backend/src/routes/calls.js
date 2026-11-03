const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Call = require('../models/Call');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { CALL_OUTCOMES, CALL_DIRECTIONS } = require('../models/constants');
const { canAccessLead, isValidId } = require('../services/leadAccess');
const { recordActivity } = require('../services/activity');
const { findNearbyCall, DUPLICATE_WINDOW_MS, IMPORT_MATCH_WINDOW_MS } = require('../services/callRules');
const { normalizePhone } = require('../utils/phone');
const { parsePaging } = require('../services/leadQuery');

const MAX_IMPORT_ENTRIES = 500;

const validate = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return null;
  return res.status(400).json({ error: errors.array()[0].msg, fields: errors.array() });
};

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

async function loadAccessibleLead(user, leadId) {
  if (!isValidId(leadId)) return null;
  const lead = await Lead.findById(leadId);
  if (!lead || lead.isArchived || !canAccessLead(user, lead)) return null;
  return lead;
}

function createCallsRouter({ requireAuth }) {
  const router = express.Router();
  router.use(requireAuth);

  // List calls. Agents see their own calls; admins can filter by agent.
  router.get(
    '/',
    query('status').optional().isIn(['pending', 'logged']),
    query('verification').optional().isIn(['verified', 'unverified']),
    query('agent').optional().isString(),
    query('lead').optional().isString(),
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
        if (req.query.verification) filter.verificationStatus = req.query.verification;

        const { page, limit, skip } = parsePaging(req.query);
        const [items, total] = await Promise.all([
          Call.find(filter)
            .sort({ startedAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('lead', 'firstName lastName phone country')
            .populate('agent', 'name'),
          Call.countDocuments(filter),
        ]);
        res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
      } catch (err) {
        next(err);
      }
    }
  );

  // Click-to-call: create a pending call so the outcome can be logged afterwards.
  router.post('/start', body('leadId').isString(), async (req, res, next) => {
    try {
      if (validate(req, res)) return;
      const lead = await loadAccessibleLead(req.user, req.body.leadId);
      if (!lead) return res.status(404).json({ error: 'Lead not found' });

      const call = await Call.create({
        lead: lead._id,
        agent: req.user._id,
        phone: lead.phone,
        direction: 'outbound',
        startedAt: new Date(),
        status: 'pending',
        source: 'app',
      });
      return res.status(201).json({ call, dialNumber: lead.phone });
    } catch (err) {
      return next(err);
    }
  });

  // Log a call manually (no prior click-to-call), or complete a pending one via PATCH.
  router.post(
    '/',
    body('leadId').isString(),
    body('direction').optional().isIn(CALL_DIRECTIONS),
    body('startedAt').isISO8601().withMessage('startedAt must be a date and time'),
    body('durationSec').optional().isInt({ min: 0, max: 86400 }),
    body('outcome').optional({ values: 'null' }).isIn(CALL_OUTCOMES),
    body('notes').optional().isString().isLength({ max: 2000 }),
    async (req, res, next) => {
      try {
        if (validate(req, res)) return;
        const lead = await loadAccessibleLead(req.user, req.body.leadId);
        if (!lead) return res.status(404).json({ error: 'Lead not found' });

        const startedAt = new Date(req.body.startedAt);
        if (startedAt > new Date(Date.now() + 5 * 60 * 1000)) {
          return res.status(400).json({ error: 'Call start time cannot be in the future' });
        }

        const nearby = await findNearbyCall({
          leadId: lead._id,
          agentId: req.user._id,
          startedAt,
          windowMs: DUPLICATE_WINDOW_MS,
        });

        const durationSec = req.body.durationSec ?? 0;
        const call = await Call.create({
          lead: lead._id,
          agent: req.user._id,
          phone: lead.phone,
          direction: req.body.direction ?? 'outbound',
          startedAt,
          endedAt: new Date(startedAt.getTime() + durationSec * 1000),
          durationSec,
          outcome: req.body.outcome ?? null,
          notes: req.body.notes ?? '',
          status: req.body.outcome ? 'logged' : 'pending',
          source: 'app',
          possibleDuplicate: Boolean(nearby),
          duplicateOf: nearby ? nearby._id : undefined,
        });

        if (call.status === 'logged') {
          await afterLogged(lead, call, req.user);
        }

        const response = call.toJSON();
        if (nearby) {
          response.warning = 'Another call to this lead by you was logged within 5 minutes. It has been flagged as a possible duplicate.';
        }
        return res.status(201).json(response);
      } catch (err) {
        return next(err);
      }
    }
  );

  // Complete a pending call or correct a logged one. Only the agent who made it (or an admin) may change it.
  router.patch(
    '/:id',
    body('outcome').optional({ values: 'null' }).isIn(CALL_OUTCOMES),
    body('durationSec').optional().isInt({ min: 0, max: 86400 }),
    body('notes').optional().isString().isLength({ max: 2000 }),
    async (req, res, next) => {
      try {
        if (validate(req, res)) return;
        if (!isValidId(req.params.id)) return res.status(404).json({ error: 'Call not found' });
        const call = await Call.findById(req.params.id);
        if (!call || (req.user.role !== 'admin' && String(call.agent) !== String(req.user._id))) {
          return res.status(404).json({ error: 'Call not found' });
        }
        const lead = await Lead.findById(call.lead);
        if (!lead) return res.status(404).json({ error: 'Lead not found' });

        if (req.body.outcome !== undefined) call.outcome = req.body.outcome;
        if (req.body.notes !== undefined) call.notes = req.body.notes;
        if (req.body.durationSec !== undefined) {
          call.durationSec = req.body.durationSec;
          call.endedAt = new Date(call.startedAt.getTime() + req.body.durationSec * 1000);
        }
        call.status = call.outcome ? 'logged' : 'pending';
        await call.save();

        if (call.status === 'logged') {
          await afterLogged(lead, call, req.user);
        }
        return res.json(call);
      } catch (err) {
        return next(err);
      }
    }
  );

  // Import entries from the phone's call log. Matches each entry to one of the agent's leads by number and time.
  router.post(
    '/import',
    body('entries').isArray({ min: 1, max: MAX_IMPORT_ENTRIES }).withMessage(`Send between 1 and ${MAX_IMPORT_ENTRIES} entries`),
    body('entries.*.phone').isString(),
    body('entries.*.startedAt').isISO8601(),
    body('entries.*.durationSec').optional().isInt({ min: 0, max: 86400 }),
    body('entries.*.direction').optional().isIn(CALL_DIRECTIONS),
    async (req, res, next) => {
      try {
        if (validate(req, res)) return;
        const summary = { received: req.body.entries.length, verified: 0, created: 0, skippedUnknownNumber: 0, skippedInvalid: 0 };
        const leadFilter = { isArchived: false };
        if (req.user.role === 'agent') leadFilter.assignedTo = req.user._id;

        for (const entry of req.body.entries) {
          const phone = normalizePhone(entry.phone);
          if (!phone) {
            summary.skippedInvalid += 1;
            continue;
          }
          const lead = await Lead.findOne({ ...leadFilter, phone });
          if (!lead) {
            summary.skippedUnknownNumber += 1;
            continue;
          }

          const startedAt = new Date(entry.startedAt);
          const durationSec = entry.durationSec ?? 0;
          const existing = await findNearbyCall({
            leadId: lead._id,
            agentId: req.user._id,
            startedAt,
            windowMs: IMPORT_MATCH_WINDOW_MS,
          });

          if (existing) {
            if (existing.verificationStatus !== 'verified') {
              existing.verificationStatus = 'verified';
              if (durationSec > existing.durationSec) existing.durationSec = durationSec;
              await existing.save();
              summary.verified += 1;
            }
            continue;
          }

          await Call.create({
            lead: lead._id,
            agent: req.user._id,
            phone,
            direction: entry.direction ?? 'outbound',
            startedAt,
            endedAt: new Date(startedAt.getTime() + durationSec * 1000),
            durationSec,
            status: 'pending',
            source: 'device_import',
            verificationStatus: 'verified',
          });
          summary.created += 1;
        }
        return res.json(summary);
      } catch (err) {
        return next(err);
      }
    }
  );

  return router;
}

async function afterLogged(lead, call, user) {
  const when = call.startedAt;
  if (!lead.lastContactedAt || lead.lastContactedAt < when) {
    lead.lastContactedAt = when;
    await lead.save();
  }
  const durationText = call.durationSec ? ` (${formatDuration(call.durationSec)})` : '';
  await recordActivity({
    leadId: lead._id,
    userId: user._id,
    type: 'call',
    summary: `Call: ${call.outcome ?? 'no outcome'}${durationText}${call.notes ? ` — ${call.notes}` : ''}`,
    details: { callId: call._id, outcome: call.outcome, durationSec: call.durationSec },
  });
}

module.exports = { createCallsRouter };
