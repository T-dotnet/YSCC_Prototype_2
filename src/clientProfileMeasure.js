import {
  ageAtCommencement, ATSI_OPTIONS, derivedEpisodeStatus, derivedEpisodeStream,
  EDUCATION_OPTIONS, GENDER_OPTIONS, REFERRAL_SOURCES,
  REGISTERED_CENTRE_STATES, SEXUALITY_OPTIONS,
} from './batch1Registration.js';
import { profileValueTriggerError } from './profileValueTriggers.js';
import { CARE_LEVELS, PROGRAM_STREAMS } from './carePeriods.js';
import { validMeasureStatusChange } from './measureStatusChange.js';
import { allowedCollectionMethodsError } from './allowedCollectionMethods.js';

export const CLIENT_PROFILE_BUNDLE_ID = 'MVP-CLIENT-PROFILE';
export const CLIENT_PROFILE_NAME = 'Client profile';
export const DEFAULT_CLIENT_PROFILE_BUNDLE = {
  id: CLIENT_PROFILE_BUNDLE_ID, name: CLIENT_PROFILE_NAME, channel: 'Clinic tablet',
  respondent: 'Person', enabled: true, timing: 'days', after: 'new-profile', delayDays: 0,
  programStream: 'All', careLevel: 'All', minAge: null, maxAge: null,
  statusChange: 'Assessment',
};

import { CLIENT_PROFILE_INSTRUMENTS } from './clientProfileInstruments.js';
export { CLIENT_PROFILE_INSTRUMENTS } from './clientProfileInstruments.js';

export const clientProfileInstrument = version =>
  CLIENT_PROFILE_INSTRUMENTS.find(item => item.version === version);

export function clientProfileReadOnlyFacts(person, episode, settings) {
  const intake = person.intakes?.find(item => item.episodeId === episode.id);
  const details = episode.profileDetails || {};
  const values = { ...intake, ...details };
  return {
    'care-episode': [
      ['Person record ID', person.id], ['Episode number', episode.number || 'Not recorded'],
      ['Current status', derivedEpisodeStatus(values, episode, settings)],
      ['Calculated program stream', derivedEpisodeStream(values, episode)],
      ['Age at service commencement', ageAtCommencement(person.dob, values.commencementDate) ?? 'Not available'],
    ],
    'participation-contact': [
      ['Assessment participation', person.consent || 'Not recorded'],
      ['Contact suitability', person.contact || 'Not recorded'],
    ],
  };
}

export const clientProfileBundle = settings => {
  if (settings?.clientProfileBundle === null) return null;
  const available = CLIENT_PROFILE_INSTRUMENTS.map(item => item.version);
  const configured = settings?.clientProfileBundle?.instrumentVersions;
  const retained = Array.isArray(configured)
    ? configured.filter(version => available.includes(version)) : available;
  return { ...DEFAULT_CLIENT_PROFILE_BUNDLE, ...settings?.clientProfileBundle,
    instrumentVersions: retained.length ? retained : available };
};

const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
  !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;

export function clientProfileBundleError(bundle, settings) {
  if (!bundle || bundle.id !== CLIENT_PROFILE_BUNDLE_ID || !bundle.name?.trim() || bundle.name.trim().length > 80)
    return 'Enter a Client profile measure name of 80 characters or fewer.';
  if (!validMeasureStatusChange(bundle.statusChange)) return 'Choose a valid status change.';
  const availableMethods = ['Clinic tablet', 'Clinician entry',
    ...(settings?.assessmentSms === false ? [] : ['SMS link'])];
  if (!availableMethods.includes(bundle.channel) || typeof bundle.enabled !== 'boolean')
    return 'Choose a valid collection method and enable setting.';
  if (allowedCollectionMethodsError(bundle, availableMethods) ||
      Array.isArray(bundle.allowedCollectionMethods) && !bundle.allowedCollectionMethods.includes(bundle.channel))
    return 'Choose Any or allowed collection methods that include the planned method.';
  if (!['All', ...PROGRAM_STREAMS].includes(bundle.programStream || 'All')) return 'Choose a program stream.';
  if (!['All', ...CARE_LEVELS].includes(bundle.careLevel || 'All')) return 'Choose a care level.';
  if ([bundle.minAge, bundle.maxAge].some(value => value != null &&
      (!Number.isInteger(value) || value < 0 || value > 120)) ||
      bundle.minAge != null && bundle.maxAge != null && bundle.minAge > bundle.maxAge)
    return 'Enter a valid age range.';
  if (!['days', 'date'].includes(bundle.timing || 'days')) return 'Choose Event or Date.';
  if (bundle.timing === 'date' && !validDate(bundle.dueDate)) return 'Enter a valid due date.';
  if ((bundle.timing || 'days') === 'days') {
    if (!['new-profile', 'intake', 'care-period', 'specific-measure'].includes(bundle.after || 'new-profile'))
      return 'Choose what starts the schedule.';
    if (!Number.isInteger(bundle.delayDays ?? 0) || bundle.delayDays < 0 || bundle.delayDays > 728)
      return 'Enter a time from 0 to 728 days.';
    if (bundle.after === 'specific-measure') {
      if (!bundle.triggerMeasureId || bundle.triggerMeasureId === CLIENT_PROFILE_BUNDLE_ID ||
          !['completed', 'overdue', 'not-required'].includes(bundle.triggerMeasureStatus))
        return 'Choose another measure and its status.';
      if (settings && !settings.assessmentScheduleRules?.some(rule => rule.id === bundle.triggerMeasureId))
        return 'Choose an existing measure to trigger Client profile.';
      if (settings?.assessmentScheduleRules?.some(rule => rule.id === bundle.triggerMeasureId &&
          rule.after === 'specific-measure' && rule.triggerMeasureId === CLIENT_PROFILE_BUNDLE_ID))
        return 'This schedule would create a loop with Client profile. Choose another measure.';
    }
  }
  if (!Array.isArray(bundle.instrumentVersions) || !bundle.instrumentVersions.length ||
      new Set(bundle.instrumentVersions).size !== bundle.instrumentVersions.length ||
      bundle.instrumentVersions.some(version => !clientProfileInstrument(version)))
    return 'Choose at least one unique Client profile measure.';
  if (profileValueTriggerError(bundle)) return profileValueTriggerError(bundle);
  return null;
}

export function clientProfileRecords(person, episode, today, config = clientProfileBundle(), due = today, anchor = today) {
  const id = `${CLIENT_PROFILE_BUNDLE_ID}-${episode.id}`;
  const intake = person.intakes?.find(item => item.episodeId === episode.id);
  return config.instrumentVersions.map((version, index) => {
    const item = clientProfileInstrument(version);
    return ({
    id: `${id}-${index}`, label: `${item.name} · ${config.name}`,
    version: item.version, due, createdAt: `${today}T12:00:00.000Z`,
    assignment: 'Planned', response: 'Not started', review: 'Not required', link: 'Not sent',
    scheduleFree: true, attempts: [], answers: [], channel: config.channel,
    respondent: 'Person', recorder: 'Person', assistance: 'Independent', appointmentId: null,
    bundleId: id, surveyId: id, bundleName: config.name,
    bundleAssessmentId: item.clientProfileSection, bundleRequirement: 'Mandatory',
    bundleSource: 'Scheduled', scheduleAnchor: anchor, clientProfileMeasure: true,
    bundleContext: { trigger: 'current', programStream: 'All', careLevel: 'All', timing: 'date', dueDate: due, statusChange: config.statusChange || '' },
    draftAnswers: item.questions.map(question => {
      const value = question.id === 'name' || question.id === 'dob' ? person[question.id]
        : person[question.id] || episode.profileDetails?.[question.id] || intake?.[question.id];
      return value && value !== 'Not recorded' && value !== 'Not confirmed' ? value : '';
    }),
  });
  });
}

export function clientProfileCompletionDate(episode) {
  const records = episode?.collections?.filter(item => item.clientProfileMeasure) || [];
  if (!records.length || records.some(item => item.response !== 'Submitted')) return null;
  return records.map(item => item.submittedAt?.slice(0, 10)).filter(Boolean).sort().at(-1) || null;
}

export function clientProfileOverdueDate(episode, today) {
  const records = episode?.collections?.filter(item => item.clientProfileMeasure) || [];
  if (!records.length || records.every(item => item.response === 'Submitted')) return null;
  const due = records.map(item => item.due).filter(Boolean).sort().at(-1);
  return due && due < today ? due : null;
}
