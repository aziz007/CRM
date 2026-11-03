const mongoose = require('mongoose');
const { TASK_STATUSES, TASK_PRIORITIES } = require('./constants');

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dueAt: { type: Date, required: true, index: true },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'normal' },
    status: { type: String, enum: TASK_STATUSES, default: 'open', index: true },
    completedAt: Date,
  },
  { timestamps: true }
);

taskSchema.index({ assignedTo: 1, status: 1, dueAt: 1 });

taskSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Task', taskSchema);
