import { asBundle } from './assessmentBundles.js';
import { PROGRAM_STREAMS } from './carePeriods.js';
import { clientProfileBundle } from './clientProfileMeasure.js';
import { INSTRUMENTS } from './instruments.js';
import {
  mvpAssessmentMode,
  mvpInitialBundles,
  mvpInitialVersions,
  mvpReviewBundles,
  mvpReviewItems,
  MVP_INITIAL_BUNDLES,
  MVP_REVIEW_BUNDLES,
} from './mvpAssessmentPathway.js';

export const mvpDisplayBundles = settings => {
  const reviews = mvpReviewBundles(settings);
  const profile = clientProfileBundle(settings);
  const displayedReviews = reviews.map(bundle => ({ ...bundle,
    schedule: bundle.after === 'intake'
      ? `${bundle.repeat ? 'Every' : 'Once'} ${bundle.days} days after initial assessment completion`
      : undefined }));
  return [...(profile ? [{ ...profile, profileMeasure: true, programStream: 'All', careLevel: 'All', minAge: null, maxAge: null }] : []),
    ...mvpInitialBundles(settings), ...displayedReviews];
};

export const mvpDisplayBattery = (bundle, stream) => bundle.example
  ? [bundle.coreVersion]
  : bundle.coreVersion ? mvpInitialVersions(bundle, stream)
  : mvpReviewItems(bundle).map(item => item.version);

export const administrationMeasureBundles = settings => {
  const rules = settings?.assessmentScheduleRules || [];
  const available = new Set(INSTRUMENTS.map(instrument => instrument.version));
  return [
    ...(mvpAssessmentMode(settings) ? mvpDisplayBundles(settings) : []),
    ...rules.filter(rule => (!mvpAssessmentMode(settings) || rule.createdInMvp) &&
      rule.assessments?.length && rule.assessments.every(item => available.has(item.version))).map(asBundle),
  ];
};

export const instrumentVersionsForAdministrationMeasure = bundle => {
  if (bundle.profileMeasure) return bundle.instrumentVersions || [];
  if (bundle.example) return [bundle.coreVersion].filter(Boolean);
  if (MVP_INITIAL_BUNDLES.some(item => item.id === bundle.id)) {
    const streams = bundle.programStream && bundle.programStream !== 'All'
      ? [bundle.programStream] : PROGRAM_STREAMS;
    return [...new Set(streams.flatMap(stream => mvpInitialVersions(bundle, stream)))];
  }
  if (MVP_REVIEW_BUNDLES.some(item => item.id === bundle.id))
    return mvpReviewItems(bundle).map(item => item.version);
  return (bundle.assessments || []).map(item => item.version);
};

export const measuresByInstrumentVersion = settings => {
  const associations = new Map();
  for (const bundle of administrationMeasureBundles(settings)) {
    for (const version of new Set(instrumentVersionsForAdministrationMeasure(bundle))) {
      const measures = associations.get(version) || [];
      measures.push({ id: bundle.id, name: bundle.name, example: !!bundle.example });
      associations.set(version, measures);
    }
  }
  return associations;
};
