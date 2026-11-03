export const TASK_PRIORITIES = ['low', 'normal', 'high'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface Task {
  id: string;
  title: string;
  description: string;
  lead?: { id: string; firstName: string; lastName: string; phone: string; country: string } | string | null;
  assignedTo: { id: string; name: string } | string;
  dueAt: string;
  priority: TaskPriority;
  status: 'open' | 'done' | 'cancelled';
  completedAt?: string | null;
}

export interface TaskPage {
  items: Task[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface TaskSummary {
  overdue: number;
  today: number;
  upcoming: number;
}

export type TaskBucket = 'overdue' | 'today' | 'upcoming' | 'done' | 'all';

export interface DayRanges {
  dayStart: string;
  dayEnd: string;
  weekEnd: string;
}

/** Day boundaries in the user's own timezone, so "today" matches what they see on their clock. */
export function dayRanges(now = new Date()): DayRanges {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const weekEnd = new Date(start);
  weekEnd.setDate(weekEnd.getDate() + 8);
  return {
    dayStart: start.toISOString(),
    dayEnd: end.toISOString(),
    weekEnd: weekEnd.toISOString(),
  };
}

export function taskLeadId(task: Task): string | null {
  if (!task.lead) return null;
  return typeof task.lead === 'string' ? task.lead : task.lead.id;
}

export function taskLeadName(task: Task): string {
  if (!task.lead || typeof task.lead === 'string') return '';
  return `${task.lead.firstName} ${task.lead.lastName}`.trim();
}
