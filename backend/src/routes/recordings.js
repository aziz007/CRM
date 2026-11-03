const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Call = require('../models/Call');
const Lead = require('../models/Lead');
const Recording = require('../models/Recording');
const { canAccessLead, isValidId } = require('../services/leadAccess');
const { recordActivity } = require('../services/activity');
const { MAX_RECORDING_BYTES, isAllowedMimeType, buildStorageKey, safeOriginalName } = require('../services/recordingRules');

const validate = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return null;
  return res.status(400).json({ error: errors.array()[0].msg, fields: errors.array() });
};

/** Loads a recording the user may see: its uploader, or any admin. */
async function loadRecording(user, id) {
  if (!isValidId(id)) return null;
  const recording = await Recording.findById(id);
  if (!recording) return null;
  if (user.role !== 'admin' && String(recording.agent) !== String(user._id)) return null;
  return recording;
}

function createRecordingsRouter({ requireAuth, storage }) {
  const router = express.Router();
  router.use(requireAuth);

  router.get(
    '/',
    query('callId').isString().withMessage('callId is required'),
    async (req, res, next) => {
      try {
        if (validate(req, res)) return;
        if (!isValidId(req.query.callId)) return res.status(404).json({ error: 'Call not found' });
        const call = await Call.findById(req.query.callId);
        if (!call || (req.user.role !== 'admin' && String(call.agent) !== String(req.user._id))) {
          return res.status(404).json({ error: 'Call not found' });
        }
        const items = await Recording.find({ call: call._id }).sort({ createdAt: -1 });
        return res.json({ items });
      } catch (err) {
        return next(err);
      }
    }
  );

  // Step 1 of upload: validates the call, consent and file, then returns a short-lived signed PUT URL.
  router.post(
    '/upload-url',
    body('callId').isString(),
    body('mimeType').isString().custom((v) => isAllowedMimeType(v)).withMessage('Unsupported audio format'),
    body('sizeBytes').isInt({ min: 1, max: MAX_RECORDING_BYTES }).withMessage(`File must be between 1 byte and ${MAX_RECORDING_BYTES / (1024 * 1024)} MB`),
    body('originalName').optional().isString().isLength({ max: 255 }),
    body('durationSec').optional().isInt({ min: 0, max: 86400 }),
    body('consentConfirmed').custom((v) => v === true).withMessage('Confirm that the client was told the call is recorded and agreed'),
    async (req, res, next) => {
      try {
        if (validate(req, res)) return;
        if (!isValidId(req.body.callId)) return res.status(404).json({ error: 'Call not found' });

        const call = await Call.findById(req.body.callId);
        if (!call || (req.user.role !== 'admin' && String(call.agent) !== String(req.user._id))) {
          return res.status(404).json({ error: 'Call not found' });
        }
        const lead = await Lead.findById(call.lead);
        if (!lead || lead.isArchived || !canAccessLead(req.user, lead)) {
          return res.status(404).json({ error: 'Call not found' });
        }

        const key = buildStorageKey({ agentId: call.agent, mimeType: req.body.mimeType });
        const recording = await Recording.create({
          call: call._id,
          lead: lead._id,
          agent: call.agent,
          storageKey: key,
          originalName: safeOriginalName(req.body.originalName),
          mimeType: req.body.mimeType,
          sizeBytes: req.body.sizeBytes,
          durationSec: req.body.durationSec,
          consent: { confirmed: true, confirmedAt: new Date(), confirmedBy: req.user._id },
        });

        const upload = await storage.createUploadUrl({
          key,
          mimeType: req.body.mimeType,
          sizeBytes: req.body.sizeBytes,
        });
        return res.status(201).json({ recording, upload: { method: 'PUT', url: upload.url, headers: { 'Content-Type': req.body.mimeType, 'Content-Length': String(req.body.sizeBytes) }, expiresInSeconds: upload.expiresInSeconds } });
      } catch (err) {
        return next(err);
      }
    }
  );

  // Step 2 of upload: confirms the object arrived intact and in the declared format.
  router.post('/:id/complete', async (req, res, next) => {
    try {
      const recording = await loadRecording(req.user, req.params.id);
      if (!recording) return res.status(404).json({ error: 'Recording not found' });
      if (String(recording.agent) !== String(req.user._id)) {
        return res.status(403).json({ error: 'Only the uploading agent can confirm this upload' });
      }
      if (recording.uploadStatus === 'uploaded') return res.json(recording);

      const check = await storage.verifyObject({
        key: recording.storageKey,
        sizeBytes: recording.sizeBytes,
        mimeType: recording.mimeType,
      });

      if (!check.sizeOk || !check.typeOk) {
        recording.uploadStatus = 'failed';
        await recording.save();
        await storage.deleteObject({ key: recording.storageKey }).catch(() => {});
        return res.status(400).json({ error: 'The uploaded file does not match what was declared. Please upload it again.' });
      }

      recording.uploadStatus = 'uploaded';
      recording.uploadedAt = new Date();
      await recording.save();

      await recordActivity({
        leadId: recording.lead,
        userId: req.user._id,
        type: 'recording',
        summary: 'Call recording uploaded',
        details: { recordingId: recording._id, callId: recording.call },
      });
      return res.json(recording);
    } catch (err) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return res.status(400).json({ error: 'The file has not finished uploading yet.' });
      }
      return next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const recording = await loadRecording(req.user, req.params.id);
      if (!recording) return res.status(404).json({ error: 'Recording not found' });
      return res.json(recording);
    } catch (err) {
      return next(err);
    }
  });

  // Short-lived signed download link. Only for uploaded recordings.
  router.get('/:id/download', async (req, res, next) => {
    try {
      const recording = await loadRecording(req.user, req.params.id);
      if (!recording) return res.status(404).json({ error: 'Recording not found' });
      if (recording.uploadStatus !== 'uploaded') return res.status(409).json({ error: 'Recording is not available yet' });
      const link = await storage.createDownloadUrl({ key: recording.storageKey, fileName: recording.originalName });
      return res.json({ url: link.url, expiresInSeconds: link.expiresInSeconds });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

module.exports = { createRecordingsRouter };
