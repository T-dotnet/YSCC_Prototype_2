import { asBundle } from './assessmentBundles.js';
import { PROGRAM_STREAMS } from './carePeriods.js';
import { clientProfileBundle } from './clientProfileMeasure.js';
import {
  mvpAssessmentMode,
  mvpInitialBundles,
  mvpInitialVersions,
  mvpReviewBundles,
  mvpReviewItems,
  MVP_INITIAL_BUNDLES,
  MVP_REVIEW_BUNDLES,
} from './mvpAssessmentPathway.js';

const mvpMockBundles = [
  {id:'MVP-DISCHARGE-PERSON', name:'Discharge · Young person', respondent:'Person', channel:'Clinic tablet', enabled:true, example:true, schedule:'At discharge', coreVersion:'Life and care check-in v1.0', statusChange:''},
  {id:'MVP-DISCHARGE-CLINICIAN', name:'Discharge · Clinician', respondent:'Clinician', channel:'Clinician entry', enabled:true, example:true, schedule:'At discharge', coreVersion:'Clinician care review v1.0', statusChange:''},
];

export const mvpDisplayBundles = settings => {
  const reviews = mvpReviewBundles(settings);
  const profile = clientProfileBundle(settings);
  return [...(profile ? [{ ...profile, profileMeasure: true, programStream: 'All', careLevel: 'All', minAge: null, maxAge: null }] : []),
    ...mvpInitialBundles(settings), ...['Person', 'Clinician'].flatMap(respondent =>
    ['General', ...PROGRAM_STREAMS.filter(stream => stream !== 'General')].flatMap(stream =>
      reviews.filter(bundle => MVP_REVIEW_BUNDLES.find(item => item.id === bundle.id)?.respondent === respondent && bundle.programStream === stream))), ...mvpMockBundles];
};

export const mvpDisplayBattery = (bundle, stream) => bundle.example
  ? [bundle.coreVersion]
  : bundle.coreVersion ? mvpInitialVersions(bundle, stream)
  : mvpReviewItems(bundle).map(item => item.version);

export const administrationMeasureBundles = settings => {
  const rules = settings?.assessmentScheduleRules || [];
  return [
    ...(mvpAssessmentMode(settings) ? mvpDisplayBundles(settings) : []),
    ...rules.filter(rule => !mvpAssessmentMode(settings) || rule.createdInMvp).map(asBundle),
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
