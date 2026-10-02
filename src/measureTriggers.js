import { PROGRAM_STREAMS } from './carePeriods.js';
import { CLIENT_PROFILE_BUNDLE_ID, CLIENT_PROFILE_NAME, clientProfileBundle } from './clientProfileMeasure.js';

export const MEASURE_STATUS_OPTIONS = [
  ['completed', 'Completed'], ['overdue', 'Overdue'], ['not-required', 'Not required'],
];

const slug = value => value.toUpperCase().replace(/[^A-Z0-9]+/g, '-');

export function measureSourceOptions(settings, excludeId) {
  const initial = PROGRAM_STREAMS.map(stream => ({
    id: `MVP-INITIAL-PERSON-${slug(stream)}`,
    name: `Initial assessment · Young person · ${stream}`,
  }));
  const reviews = ['Person', 'Clinician'].flatMap(respondent => PROGRAM_STREAMS.map(stream => ({
    id: `MVP-REVIEW-${respondent.toUpperCase()}-${slug(stream)}`,
    name: `90-day review · ${respondent === 'Person' ? 'Young person' : 'Clinician'} · ${stream}`,
  })));
  const availableInitial = Array.isArray(settings?.mvpInitialBundles)
    ? initial.filter(item => settings.mvpInitialBundles.some(saved => saved.id === item.id)) : initial;
  const availableReviews = Array.isArray(settings?.mvpReviewBundles)
    ? reviews.filter(item => settings.mvpReviewBundles.some(saved => saved.id === item.id)) : reviews;
  const savedName = item => settings?.mvpInitialBundles?.find(saved => saved.id === item.id)?.name ||
    settings?.mvpReviewBundles?.find(saved => saved.id === item.id)?.name || item.name;
  return [{ id: CLIENT_PROFILE_BUNDLE_ID, name: clientProfileBundle(settings)?.name || CLIENT_PROFILE_NAME },
    ...availableInitial.map(item => ({ ...item, name: savedName(item) })),
    ...availableReviews.map(item => ({ ...item, name: savedName(item) })),
    ...(settings?.assessmentScheduleRules || []).map(item => ({ id: item.id, name: item.name }))]
    .filter(item => item.id !== excludeId);
}

export function specificMeasureError(rule, settings) {
  if (rule.after !== 'specific-measure') return null;
  if (!rule.triggerMeasureId || rule.triggerMeasureId === rule.id ||
      settings && !measureSourceOptions(settings, rule.id).some(item => item.id === rule.triggerMeasureId))
    return 'Choose an existing measure to trigger this measure.';
  if (!MEASURE_STATUS_OPTIONS.some(([value]) => value === rule.triggerMeasureStatus))
    return 'Choose Completed, Overdue, or Not required.';
  return null;
}

const nextDay = date => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
};

export function measureStatusSources(episode, measureId, status, today) {
  if (!measureId || !MEASURE_STATUS_OPTIONS.some(([value]) => value === status)) return [];
  const matching = (episode?.collections || []).filter(record =>
    measureId === CLIENT_PROFILE_BUNDLE_ID ? record.clientProfileMeasure :
      record.mvpInitialBundleDefinitionId === measureId || record.mvpBundleDefinitionId === measureId ||
      record.bundleId === measureId || record.scheduleRuleId === measureId);
  const groups = new Map();
  for (const record of matching) {
    const key = `${record.bundleInstanceId || record.bundleId || record.scheduleRuleId || measureId}:${record.due || ''}`;
    groups.set(key, [...(groups.get(key) || []), record]);
  }
  return [...groups].flatMap(([id, records]) => {
    let anchor;
    if (status === 'completed' && records.every(record => record.response === 'Submitted'))
      anchor = records.map(record => (record.submittedAt || record.submittedTimestamp || record.responseDate || record.completedAt)?.slice(0, 10)).filter(Boolean).sort().at(-1);
    if (status === 'overdue' && records.some(record => record.response !== 'Submitted' && !record.notRequiredReason && record.due < today))
      anchor = nextDay(records.filter(record => record.response !== 'Submitted' && !record.notRequiredReason && record.due < today)
        .map(record => record.due).filter(Boolean).sort()[0]);
    if (status === 'not-required' && records.every(record => record.notRequiredReason))
      anchor = records.map(record => record.notRequiredAt?.slice(0, 10)).filter(Boolean).sort().at(-1);
    return anchor ? [{ anchor, timingSourceId: id }] : [];
  }).sort((a, b) => a.anchor.localeCompare(b.anchor));
}
