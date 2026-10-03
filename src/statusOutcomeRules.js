import { ASSESSMENT_OUTCOME_OPTIONS, assessmentOutcomeEnabled, visibleAssessmentOutcomeOptions } from './assessmentOutcome.js';
import { MEASURE_STATUS_CHANGES } from './measureStatusChange.js';

export const ASSESSMENT_OUTCOME_TRANSITION = { from: 'Assessment', to: 'Ongoing review' };
export const REQUIRED_STATUS_OUTCOME_TRANSITIONS = [
  { from: 'Profiling', to: 'Assessment' },
  ASSESSMENT_OUTCOME_TRANSITION,
  { from: 'Ongoing review', to: 'Ongoing review' },
];
export const isRequiredStatusOutcomeTransition = (from, to) =>
  REQUIRED_STATUS_OUTCOME_TRANSITIONS.some(rule => rule.from === from && rule.to === to);
export const isAssessmentOutcomeTransition = (from, to) =>
  from === ASSESSMENT_OUTCOME_TRANSITION.from && to === ASSESSMENT_OUTCOME_TRANSITION.to;

export const sharedStatusOutcomeOptions = (selected = []) => ASSESSMENT_OUTCOME_OPTIONS.map(value => ({
  value, visible: selected.some(option => option.value === value && option.visible),
}));

export function statusOutcomeRules(settings) {
  const saved = Array.isArray(settings?.statusOutcomeRules) ? settings.statusOutcomeRules : [];
  const normalized = rule => ({ ...rule, options: sharedStatusOutcomeOptions(rule.options) });
  const required = REQUIRED_STATUS_OUTCOME_TRANSITIONS.map(transition => {
    if (isAssessmentOutcomeTransition(transition.from, transition.to)) return {
      ...transition, builtIn: true, mandatory: true,
      enabled: assessmentOutcomeEnabled(settings),
      options: ASSESSMENT_OUTCOME_OPTIONS.map(value => ({
        value, visible: visibleAssessmentOutcomeOptions(settings).includes(value),
      })),
    };
    const configured = saved.find(rule => rule.from === transition.from && rule.to === transition.to);
    const defaultsToOn = transition.from === 'Profiling' && transition.to === 'Assessment';
    const emptyLegacyRule = defaultsToOn && configured &&
      !configured.enabled && !configured.options?.some(option => option.visible);
    return { ...((configured && !emptyLegacyRule) ? normalized(configured) : {
      ...transition, enabled: defaultsToOn,
      options: ASSESSMENT_OUTCOME_OPTIONS.map(value => ({ value, visible: defaultsToOn })),
    }), mandatory: true };
  });
  const additional = saved.filter(rule => !isRequiredStatusOutcomeTransition(rule.from, rule.to)).map(normalized);
  return [required[0], required[1], ...additional, required[2]];
}

export const statusOutcomeRuleFor = (settings, from, to) =>
  statusOutcomeRules(settings).find(rule => rule.from === from && rule.to === to);

export const visibleStatusOutcomeOptions = rule =>
  (rule?.options || []).filter(option => option.visible).map(option => option.value);

export function validCustomStatusOutcomeRule(rule) {
  if (!rule || !MEASURE_STATUS_CHANGES.includes(rule.from) ||
      !MEASURE_STATUS_CHANGES.includes(rule.to) ||
      (rule.from === rule.to && rule.from !== 'Ongoing review') ||
      isAssessmentOutcomeTransition(rule.from, rule.to) ||
      rule.builtIn || typeof rule.enabled !== 'boolean' || !Array.isArray(rule.options)) return false;
  if (rule.options.length !== ASSESSMENT_OUTCOME_OPTIONS.length ||
      rule.options.some((option, index) => option?.value !== ASSESSMENT_OUTCOME_OPTIONS[index] ||
        typeof option.visible !== 'boolean') ||
      (rule.enabled && !rule.options.some(option => option.visible))) return false;
  return true;
}
