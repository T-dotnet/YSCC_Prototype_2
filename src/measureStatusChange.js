export const MEASURE_STATUS_CHANGES = [
  'Profiling',
  'Assessment',
  'Ongoing review',
];

export const validMeasureStatusChange = value =>
  value == null || value === '' || MEASURE_STATUS_CHANGES.includes(value);

export function completedMeasureStatusChange(episode) {
  const collections = episode?.collections || [];
  const initialComplete = collections.some(record => record.mvpInitialAssessment &&
    record.mvpRespondent === 'Person') && collections.filter(record =>
    record.mvpInitialAssessment && record.mvpRespondent === 'Person')
    .every(record => record.response === 'Submitted');
  const completed = collections.filter(record => record.response === 'Submitted' &&
    MEASURE_STATUS_CHANGES.includes(record.bundleContext?.statusChange) &&
    !(initialComplete && record.clientProfileMeasure));
  const eligible = completed.filter(record => {
    if (!record.bundleId) return true;
    const group = collections.filter(item => record.bundleInstanceId
      ? item.bundleInstanceId === record.bundleInstanceId
      : item.bundleId === record.bundleId && item.due === record.due &&
        item.bundleEventId === record.bundleEventId && item.scheduleAnchor === record.scheduleAnchor);
    return group.length && group.every(item => item.response === 'Submitted');
  });
  return eligible.sort((a, b) =>
    (b.submittedAt || b.reviewDate || b.due || '').localeCompare(a.submittedAt || a.reviewDate || a.due || ''))[0]
    ?.bundleContext.statusChange || null;
}
