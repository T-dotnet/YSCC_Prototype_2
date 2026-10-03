import { assessmentDueLabel, earliestPendingAssessment } from './assessmentDue.js';

export const ASSESSMENT_BUNDLE_STATUS_LABELS = {
  'not-required': 'Not required',
  completed: 'Completed',
  overdue: 'Overdue',
  'due-soon': 'Due soon',
  'in-progress': 'In progress',
  'record-outcome': 'Record outcome',
  new: 'New',
  'not-started': 'Not started',
};

export const ASSESSMENT_BUNDLE_STATUS_TONES = {
  'not-required': 'neutral',
  completed: 'green',
  overdue: 'coral',
  'due-soon': 'amber',
  'in-progress': 'blue',
  'record-outcome': 'amber',
  new: 'purple',
  'not-started': 'neutral',
};

export function assessmentBundleStatus(records, today, {
  statusFor = record => record.notRequiredReason ? 'Not required' : record.response === 'Submitted' ? 'Completed' : 'Not started',
  awaitingOutcome = () => false,
  showDueDates = true,
} = {}) {
  const completedCount = records.filter(record => statusFor(record) === 'Completed').length;
  const nextDue = showDueDates ? earliestPendingAssessment(records) : null;
  const daysUntilDue = nextDue?.due ? Math.round((Date.parse(nextDue.due) - Date.parse(today)) / 86400000) : null;
  const hasDraft = records.some(record => record.response === 'Draft' || record.response === 'In progress');
  const systemCreated = records.some(record => record.bundleSource === 'Scheduled' || record.bundleSource === 'System' ||
    record.id?.startsWith('AUTO-') || (record.scheduleAnchor && record.bundleSource !== 'Manual'));
  const status = records.some(awaitingOutcome) ? 'record-outcome'
    : records.every(record => record.notRequiredReason) ? 'not-required'
    : records.length > 0 && completedCount === records.length ? 'completed'
    : nextDue && assessmentDueLabel(nextDue, today) === 'Past due' ? 'overdue'
    : nextDue && daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 7 ? 'due-soon'
    : hasDraft || completedCount > 0 ? 'in-progress'
    : systemCreated ? 'new' : 'not-started';
  return { status, label: ASSESSMENT_BUNDLE_STATUS_LABELS[status], tone: ASSESSMENT_BUNDLE_STATUS_TONES[status], completedCount, nextDue };
}
