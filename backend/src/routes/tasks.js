const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Task = require('../models/Task');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { TASK_PRIORITIES, TASK_STATUSES } = require('../models/constants');
const { canAccessLead, isValidId } = require('../services/leadAccess');
const { recordActivity } = require('../services/activity');
const { buildTaskFilter, parseDate } = require('../services/taskQuery');
const { parsePaging } = require('../services/leadQuery');

const validate = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return null;
  return res.status(400).json({ error: errors.array()[0].msg, fields: errors.array() });
};

const dateQuery = (field) => query(field).optional().isISO8601().withMessage(`${field} must be an ISO date`);

function isoOrNull(value) {
  return value ? new Date(value) : null;
}

/** Ensures the current user may assign work to the target user. Agents may only assign to themselves. */
async function resolveAssignee(user, requestedId) {
  if (!requestedId) return { id: user._id };
  if (!isValidId(requestedId)) return { error: 'Invalid assignee' };
  if (user.role !== 'admin' && String(requestedId) !== String(user._id)) {
    return { error: 'Agents can only create tasks for themselves' };
  }
  const assignee = await User.findOne({ _id: requestedId, isActive: true });
  if (!assignee) return { error: 'Assignee not found or inactive' };
  return { id: assignee._id };
}

async function loadTaskForUser(user, id) {
  if (!isValidId(id)) return null;
  const task = await Task.findById(id);
  if (!task) return null;
  if (user.role !== 'admin' && String(task.assignedTo) !== String(user._id)) return null;
  return task;
}

function createTasksRouter({ requireAuth }) {
  const router = express.Router();
  router.use(requireAuth);

  router.get(
    '/',
    query('status').optional().isIn([...TASK_STATUSES, 'all']),
    query('bucket').optional().isIn(['overdue', 'today', 'upcoming']),
    query('lead').optional().isString(),
    query('assignedTo').optional().isString(),
    dateQuery('dayStart'),
    dateQuery('dayEnd'),
    dateQuery('weekEnd'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    async (req, res, next) => {
      try {
        if (validate(req, res)) return;
        const filter = buildTaskFilter(req.user, req.query);
        const sort = req.query.status === 'done' ? { completedAt: -1 } : { dueAt: 1 };
        const { page, limit, skip } = parsePaging(req.query);
        const [items, total] = await Promise.all([
          Task.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate('lead', 'firstName lastName phone country')
            .populate('assignedTo', 'name'),
          Task.countDocuments(filter),
        ]);
        res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
      } catch (err) {
        next(err);
      }
    }
  );

  // Counts for the dashboard reminders: overdue, due today, and due in the next week.
  router.get(
    '/summary',
    dateQuery('dayStart'),
    dateQuery('dayEnd'),
    dateQuery('weekEnd'),
    async (req, res, next) => {
      try {
        if (validate(req, res)) return;
        const now = new Date();
        const base = req.user.role === 'agent' ? { assignedTo: req.user._id } : {};
        const dayStart = isoOrNull(req.query.dayStart);
        const dayEnd = isoOrNull(req.query.dayEnd);
        const weekEnd = isoOrNull(req.query.weekEnd);

        const [overdue, today, upcoming] = await Promise.all([
          Task.countDocuments({ ...base, status: 'open', dueAt: { $lt: now } }),
          dayStart && dayEnd
            ? Task.countDocuments({ ...base, status: 'open', dueAt: { $gte: dayStart, $lt: dayEnd } })
            : 0,
          dayEnd && weekEnd
            ? Task.countDocuments({ ...base, status: 'open', dueAt: { $gte: dayEnd, $lt: weekEnd } })
            : 0,
        ]);
        res.json({ overdue, today, upcoming });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/',
    body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required (max 200 characters)'),
    body('description').optional().isString().isLength({ max: 2000 }),
    body('dueAt').isISO8601().withMessage('Due date and time are required'),
    body('priority').optional().isIn(TASK_PRIORITIES),
    body('leadId').optional({ values: 'falsy' }).isString(),
    body('assignedTo').optional({ values: 'falsy' }).isString(),
    async (req, res, next) => {
      try {
        if (validate(req, res)) return;

        let lead = null;
        if (req.body.leadId) {
          if (!isValidId(req.body.leadId)) return res.status(404).json({ error: 'Lead not found' });
          lead = await Lead.findById(req.body.leadId);
          if (!lead || lead.isArchived || !canAccessLead(req.user, lead)) {
            return res.status(404).json({ error: 'Lead not found' });
          }
        }

        const assignee = await resolveAssignee(req.user, req.body.assignedTo);
        if (assignee.error) return res.status(400).json({ error: assignee.error });

        const task = await Task.create({
          title: req.body.title,
          description: req.body.description ?? '',
          lead: lead ? lead._id : undefined,
          assignedTo: assignee.id,
          createdBy: req.user._id,
          dueAt: new Date(req.body.dueAt),
          priority: req.body.priority ?? 'normal',
        });

        if (lead) {
          await recordActivity({
            leadId: lead._id,
            userId: req.user._id,
            type: 'task',
            summary: `Task added: ${task.title} (due ${task.dueAt.toISOString().slice(0, 16).replace('T', ' ')} UTC)`,
            details: { taskId: task._id, action: 'created' },
          });
        }
        const populated = await task.populate([
          { path: 'lead', select: 'firstName lastName phone country' },
          { path: 'assignedTo', select: 'name' },
        ]);
        return res.status(201).json(populated);
      } catch (err) {
        return next(err);
      }
    }
  );

  router.patch(
    '/:id',
    body('title').optional().trim().isLength({ min: 1, max: 200 }),
    body('description').optional().isString().isLength({ max: 2000 }),
    body('dueAt').optional().isISO8601(),
    body('priority').optional().isIn(TASK_PRIORITIES),
    body('status').optional().isIn(['open', 'done', 'cancelled']),
    async (req, res, next) => {
      try {
        if (validate(req, res)) return;
        const task = await loadTaskForUser(req.user, req.params.id);
        if (!task) return res.status(404).json({ error: 'Task not found' });

        const previousStatus = task.status;
        if (req.body.title !== undefined) task.title = req.body.title;
        if (req.body.description !== undefined) task.description = req.body.description;
        if (req.body.dueAt !== undefined) task.dueAt = new Date(req.body.dueAt);
        if (req.body.priority !== undefined) task.priority = req.body.priority;
        if (req.body.status !== undefined && req.body.status !== previousStatus) {
          task.status = req.body.status;
          task.completedAt = req.body.status === 'done' ? new Date() : undefined;
        }
        await task.save();

        if (task.lead && task.status !== previousStatus) {
          await recordActivity({
            leadId: task.lead,
            userId: req.user._id,
            type: 'task',
            summary: `Task ${task.status === 'done' ? 'completed' : task.status}: ${task.title}`,
            details: { taskId: task._id, action: task.status },
          });
        }
        return res.json(task);
      } catch (err) {
        return next(err);
      }
    }
  );

  // Removes a task. Admins only, so agents cannot erase their own reminders.
  router.delete('/:id', async (req, res, next) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can delete tasks. Mark it cancelled instead.' });
      if (!isValidId(req.params.id)) return res.status(404).json({ error: 'Task not found' });
      const result = await Task.deleteOne({ _id: req.params.id });
      if (!result.deletedCount) return res.status(404).json({ error: 'Task not found' });
      return res.status(204).end();
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

module.exports = { createTasksRouter };
