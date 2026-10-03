import { EP_BATCH_2_INSTRUMENTS } from './epCodebookInstruments.js';

export const ASSESSMENT_OUTCOME_INSTRUMENT = EP_BATCH_2_INSTRUMENTS.find(
  instrument => instrument.codebookDataItem === 'Assessment Outcome');
export const ASSESSMENT_OUTCOME_OPTIONS = ASSESSMENT_OUTCOME_INSTRUMENT.questions.find(
  question => question.id === 'assessment_outcome').options;

export const visibleAssessmentOutcomeOptions = settings => {
  const configured = settings?.assessmentOutcomeOptions;
  if (!Array.isArray(configured)) return ASSESSMENT_OUTCOME_OPTIONS;
  const visible = ASSESSMENT_OUTCOME_OPTIONS.filter(option => configured.includes(option));
  return visible.length ? visible : ASSESSMENT_OUTCOME_OPTIONS;
};

export const assessmentOutcomeRecord = episode => (episode?.collections || []).find(record =>
  record.mvpInitialAssessment && record.version === ASSESSMENT_OUTCOME_INSTRUMENT.version);

export const recordedAssessmentOutcome = episode =>
  episode?.assessmentOutcome?.value ||
  (assessmentOutcomeRecord(episode)?.response === 'Submitted'
    ? assessmentOutcomeRecord(episode).answers?.[0] : '');

export const assessmentOutcomeEnabled = settings =>
  settings?.advancedAssessmentOptions !== true &&
  settings?.mvpAssessmentPathway !== false &&
  settings?.mvpRecordAssessmentOutcome !== false;

export const initialAssessmentStatusChange = (record, settings) => {
  if (!record?.mvpInitialAssessment) return record?.bundleContext?.statusChange;
  const configured = settings?.mvpInitialBundles?.find(bundle =>
    bundle.id === record.mvpInitialBundleDefinitionId);
  return configured?.statusChange ?? settings?.mvpInitialBundle?.statusChange ??
    record.bundleContext?.statusChange;
};

export const initialAssessmentHasOutcomeStatus = (episode, settings) => {
  if (!assessmentOutcomeEnabled(settings)) return false;
  const initial = (episode?.collections || []).filter(record =>
    record.mvpInitialAssessment && record.mvpRespondent === 'Person');
  return initial.some(record => initialAssessmentStatusChange(record, settings) === 'Ongoing review');
};

export const initialAssessmentReadyForOutcome = (episode, settings) =>
  initialAssessmentHasOutcomeStatus(episode, settings) &&
  (episode?.collections || []).filter(record => record.mvpInitialAssessment && record.mvpRespondent === 'Person')
    .every(record => record.response === 'Submitted');

export const assessmentOutcomeAllowsOngoingReview = (episode, settings) => {
  if (!assessmentOutcomeEnabled(settings)) return true;
  if (!initialAssessmentHasOutcomeStatus(episode, settings)) return true;
  return initialAssessmentReadyForOutcome(episode, settings) && !!episode?.assessmentOutcome?.value;
};

export const assessmentOutcomeProceeds = episode => {
  const value = episode?.assessmentOutcome?.value;
  return value && /^[12]\s*·/.test(value);
};
