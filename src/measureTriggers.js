import { PROGRAM_STREAMS } from './carePeriods.js';
import { CLIENT_PROFILE_BUNDLE_ID, CLIENT_PROFILE_NAME, clientProfileBundle } from './clientProfileMeasure.js';
import { assessmentBundleStatus, ASSESSMENT_BUNDLE_STATUS_LABELS } from './assessmentBundleStatus.js';
import { initialAssessmentReadyForOutcome, initialAssessmentStatusChange } from './assessmentOutcome.js';
import { availableStatusTransitionForGroup } from './measureStatusChange.js';
import { statusOutcomeRuleFor } from './statusOutcomeRules.js';

export const MEASURE_STATUS_OPTIONS = Object.entries(ASSESSMENT_BUNDLE_STATUS_LABELS);

export const measureTriggerIds = rule => Array.isArray(rule.triggerMeasureIds)
  ? rule.triggerMeasureIds : rule.triggerMeasureId ? [rule.triggerMeasureId] : [];
export const measureTriggerStatuses = rule => Array.isArray(rule.triggerMeasureStatuses)
  ? rule.triggerMeasureStatuses : rule.triggerMeasureStatus ? [rule.triggerMeasureStatus] : [];

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
  const ids = measureTriggerIds(rule);
  const statuses = measureTriggerStatuses(rule);
  const available = new Set(measureSourceOptions(settings, rule.id).map(item => item.id));
  if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => id === rule.id || settings && !available.has(id)))
    return 'Choose one or more existing Assessment Packs to trigger this Assessment Pack.';
  if (!statuses.length || new Set(statuses).size !== statuses.length ||
      statuses.some(status => !MEASURE_STATUS_OPTIONS.some(([value]) => value === status)))
    return 'Choose one or more Assessment Pack statuses.';
  return null;
}

const nextDay = date => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
};

export function measureStatusSources(episode, measureId, status, today, settings) {
  if (Array.isArray(measureId) || Array.isArray(status)) {
    const ids = Array.isArray(measureId) ? measureId : measureId ? [measureId] : [];
    const statuses = Array.isArray(status) ? status : status ? [status] : [];
    const sources = ids.flatMap(id => statuses.flatMap(value => measureStatusSources(episode, id, value, today, settings)));
    return [...new Map(sources.map(source => [`${source.timingSourceId}:${source.anchor}`, source])).values()]
      .sort((a, b) => a.anchor.localeCompare(b.anchor));
  }
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
    const transition = settings && availableStatusTransitionForGroup(episode, records, settings);
    const outcomeRule = transition && statusOutcomeRuleFor(settings, transition.from, transition.to);
    const outcomePending = outcomeRule?.enabled && !outcomeRule.builtIn &&
      !(episode.statusOutcomes || []).some(item => item.recordId === transition.recordId);
    const initialOutcomePending = settings && initialAssessmentReadyForOutcome(episode, settings) &&
      !episode.assessmentOutcome?.value;
    const current = assessmentBundleStatus(records, today, {
      awaitingOutcome: record => !!(outcomePending || (initialOutcomePending &&
        record.mvpInitialAssessment && record.mvpRespondent === 'Person' &&
        initialAssessmentStatusChange(record, settings) === 'Ongoing review')),
    }).status;
    if (current !== status) return [];
    const dates = values => values.map(value => value?.slice(0, 10)).filter(Boolean).sort();
    const created = dates(records.map(record => record.createdAt || record.assignedAt));
    const submitted = dates(records.map(record => record.submittedAt || record.submittedTimestamp ||
      record.responseDate || record.completedAt));
    const started = dates(records.map(record => record.draftSavedAt || record.startedAt || record.updatedAt));
    let anchor;
    if (status === 'completed' && records.every(record => record.response === 'Submitted'))
      anchor = [submitted.at(-1), ...(records.some(record => record.mvpInitialAssessment)
        ? [episode.assessmentOutcome?.recordedAt?.slice(0, 10)] : []),
        ...(outcomeRule?.enabled && !outcomeRule.builtIn
          ? [(episode.statusOutcomes || []).find(item => item.recordId === transition.recordId)?.recordedAt?.slice(0, 10)] : [])]
        .filter(Boolean).sort().at(-1);
    if (status === 'overdue' && records.some(record => record.response !== 'Submitted' && !record.notRequiredReason && record.due < today))
      anchor = nextDay(records.filter(record => record.response !== 'Submitted' && !record.notRequiredReason && record.due < today)
        .map(record => record.due).filter(Boolean).sort()[0]);
    if (status === 'not-required' && records.every(record => record.notRequiredReason))
      anchor = records.map(record => record.notRequiredAt?.slice(0, 10)).filter(Boolean).sort().at(-1);
    if (status === 'record-outcome') anchor = submitted.at(-1) || today;
    if (status === 'in-progress') anchor = started[0] || submitted[0] || created[0] || episode.start || today;
    if (status === 'new' || status === 'not-started') anchor = created[0] || episode.start || today;
    if (status === 'due-soon') {
      const due = dates(records.filter(record => record.response !== 'Submitted' && !record.notRequiredReason)
        .map(record => record.due))[0];
      if (due) {
        const threshold = new Date(`${due}T12:00:00Z`);
        threshold.setUTCDate(threshold.getUTCDate() - 7);
        anchor = [threshold.toISOString().slice(0, 10), created[0] || ''].sort().at(-1);
      }
    }
    return anchor ? [{ anchor, timingSourceId: id }] : [];
  }).sort((a, b) => a.anchor.localeCompare(b.anchor));
}
