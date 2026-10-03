import { assessmentOutcomeAllowsOngoingReview, initialAssessmentStatusChange } from './assessmentOutcome.js';

export const MEASURE_STATUS_CHANGES = [
  'Profiling',
  'Assessment',
  'Ongoing review',
];

export const validMeasureStatusChange = value =>
  value == null || value === '' || MEASURE_STATUS_CHANGES.includes(value);

const statusChangeGroupKey = record => record.bundleInstanceId
  ? `instance:${record.bundleInstanceId}`
  : record.bundleId
    ? `bundle:${record.bundleId}:${record.due || ''}:${record.bundleEventId || ''}:${record.scheduleAnchor || ''}`
    : `record:${record.id}`;

export function completedStatusTransitions(episode, settings) {
  const groups = new Map();
  for (const record of episode?.collections || []) {
    const key = statusChangeGroupKey(record);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  const completed = [...groups.values()].filter(records => records.every(record =>
    record.response === 'Submitted'))
    .map(records => ({ records, to: records.map(record => initialAssessmentStatusChange(record, settings))
      .find(status => MEASURE_STATUS_CHANGES.includes(status)),
      at: records.map(record => record.submittedTimestamp || record.submittedAt || record.reviewDate || record.due || '')
        .sort().at(-1) || '' }))
    .filter(group => group.to)
    .sort((a, b) => a.at.localeCompare(b.at) || a.records[0].id.localeCompare(b.records[0].id));
  let from = (episode?.collections || []).some(record => record.clientProfileMeasure)
    ? 'Profiling' : 'Assessment';
  const transitions = [];
  for (const group of completed) {
    if (from !== group.to || from === 'Ongoing review') transitions.push({
      from, to: group.to, recordId: group.records[0].id,
      recordIds: group.records.map(record => record.id),
    });
    from = group.to;
  }
  return transitions;
}

export function completedMeasureStatusChange(episode, settings) {
  const collections = episode?.collections || [];
  const statusFor = record => initialAssessmentStatusChange(record, settings);
  const initialComplete = collections.some(record => record.mvpInitialAssessment &&
    record.mvpRespondent === 'Person') && collections.filter(record =>
    record.mvpInitialAssessment && record.mvpRespondent === 'Person')
    .every(record => record.response === 'Submitted');
  const completed = collections.filter(record => record.response === 'Submitted' &&
    MEASURE_STATUS_CHANGES.includes(statusFor(record)) &&
    !(initialComplete && record.clientProfileMeasure));
  const eligible = completed.filter(record => {
    if (record.mvpInitialAssessment && statusFor(record) === 'Ongoing review' &&
        !assessmentOutcomeAllowsOngoingReview(episode, settings)) return false;
    if (!record.bundleId) return true;
    const group = collections.filter(item => record.bundleInstanceId
      ? item.bundleInstanceId === record.bundleInstanceId
      : item.bundleId === record.bundleId && item.due === record.due &&
        item.bundleEventId === record.bundleEventId && item.scheduleAnchor === record.scheduleAnchor);
    return group.length && group.every(item => item.response === 'Submitted');
  });
  const latest = eligible.sort((a, b) =>
    (b.submittedAt || b.reviewDate || b.due || '').localeCompare(a.submittedAt || a.reviewDate || a.due || ''))[0];
  return latest ? statusFor(latest) || null : null;
}
