import { carePeriodAt, PROGRAM_STREAMS, CARE_LEVELS } from './carePeriods.js';
import { addDays, validReviewDate } from './episodeReviews.js';
import { INSTRUMENTS, MVP_STREAM_QUESTIONNAIRES, CLINICIAN_REVIEW_INSTRUMENT, questionnaireState } from './instruments.js';
import { EP_BATCH_2_INSTRUMENTS, EP_BATCH_3_INSTRUMENTS } from './epCodebookInstruments.js';
import { clientProfileRecords, clientProfileCompletionDate, clientProfileBundle, clientProfileBundleError, CLIENT_PROFILE_BUNDLE_ID } from './clientProfileMeasure.js';
import { measureStatusSources, specificMeasureError } from './measureTriggers.js';
import { profileValueMatches, profileValueTriggerError } from './profileValueTriggers.js';
import { validMeasureStatusChange } from './measureStatusChange.js';
import { initialAssessmentReadyForOutcome, assessmentOutcomeProceeds } from './assessmentOutcome.js';
import { allowedCollectionMethodsError } from './allowedCollectionMethods.js';

export const mvpAssessmentMode = settings => settings?.advancedAssessmentOptions === false;
export const mvpPathwayEnabled = settings => mvpAssessmentMode(settings) && settings?.mvpAssessmentPathway !== false;
export const mvpClinicianCreationEnabled = settings => mvpAssessmentMode(settings) && settings?.mvpClinicianCreation === true;
export const mvpBundleEditingEnabled = settings => mvpAssessmentMode(settings) && settings?.mvpBundleEditing !== false;
export const MVP_REVIEW_DAYS = 90;

export function mvpReviewNumbers(episode) {
  const timepoints = new Map();
  for (const record of episode.collections || []) {
    if (!record.mvpTimepointId) continue;
    const due = record.due || '\uffff';
    const earlierDue = timepoints.get(record.mvpTimepointId);
    if (!earlierDue || due < earlierDue)
      timepoints.set(record.mvpTimepointId, due);
  }
  return new Map([...timepoints].sort(([firstId, firstDue], [secondId, secondDue]) =>
    firstDue.localeCompare(secondDue) || firstId.localeCompare(secondId))
    .map(([id], index) => [id, index + 1]));
}

export const MVP_INITIAL_BUNDLE = { id: 'MVP-INITIAL-PERSON', name: 'Initial assessment · Young person', respondent: 'Person', channel: 'Clinic tablet', enabled: true, timing: 'days', after: 'specific-measure', delayDays: 0, triggerMeasureId: CLIENT_PROFILE_BUNDLE_ID, triggerMeasureStatus: 'completed', programStream: 'All', careLevel: 'All', minAge: null, maxAge: null, coreVersion: EP_BATCH_2_INSTRUMENTS[0].version, statusChange: 'Ongoing review' };
const initialStreams = PROGRAM_STREAMS;
const epCodebookStreams = new Set(['Psychosis']);
export const MVP_INITIAL_BUNDLES = initialStreams.map(stream => ({ ...MVP_INITIAL_BUNDLE,
  id: `MVP-INITIAL-PERSON-${stream.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`,
  name: `${MVP_INITIAL_BUNDLE.name} · ${stream}`, programStream: stream }));
export function makeInitialAssessmentsImmediate(state) {
  if (state.settings?.initialAssessmentsImmediateV1) return state;
  const settings = state.settings || {};
  return { ...state, settings: {
    ...settings,
    initialAssessmentsImmediateV1: true,
    ...(settings.mvpInitialBundle ? { mvpInitialBundle: { ...settings.mvpInitialBundle, delayDays: 0 } } : {}),
    ...(Array.isArray(settings.mvpInitialBundles) ? {
      mvpInitialBundles: settings.mvpInitialBundles.map(bundle => ({ ...bundle, delayDays: 0 })),
    } : {}),
  } };
}
export const mvpInitialBundles = settings => {
  if (Array.isArray(settings?.mvpInitialBundles)) return MVP_INITIAL_BUNDLES.flatMap(original => {
    const saved = settings.mvpInitialBundles.find(bundle => bundle.id === original.id);
    return saved ? [{ ...original, ...saved, id: original.id }] : [];
  });
  if (settings?.mvpInitialBundle === null) return [];
  const legacy = { ...MVP_INITIAL_BUNDLE, ...settings?.mvpInitialBundle };
  return MVP_INITIAL_BUNDLES.filter(bundle => legacy.programStream === 'All' || legacy.programStream === bundle.programStream)
    .map(bundle => ({ ...bundle, ...legacy, id: bundle.id, programStream: bundle.programStream,
      name: `${legacy.name.trim().slice(0, 77 - bundle.programStream.length).trim()} · ${bundle.programStream}` }));
};
export const mvpInitialVersions = (bundle, stream) => {
  const configured = bundle.assessmentsByStream?.[stream];
  const allowed = epCodebookStreams.has(stream)
    ? EP_BATCH_2_INSTRUMENTS.map(instrument => instrument.version)
    : [MVP_STREAM_QUESTIONNAIRES[stream]?.version].filter(Boolean);
  return configured?.length && configured.every(version => allowed.includes(version))
    ? configured : allowed;
};
export function mvpInitialBundleError(bundle, settings) {
  const original = MVP_INITIAL_BUNDLES.find(item => item.id === bundle?.id);
  if (!original || !bundle.name?.trim() || bundle.name.trim().length > 80) return 'Enter an assessment name of 80 characters or fewer.';
  if (!validMeasureStatusChange(bundle.statusChange)) return 'Choose a valid status change.';
  if (!PROGRAM_STREAMS.includes(bundle.programStream)) return 'Choose a program stream.';
  if (bundle.respondent !== 'Person' || typeof bundle.enabled !== 'boolean') return 'Choose a valid initial assessment.';
  if (!['Clinic tablet', 'Clinician entry', 'SMS link'].includes(bundle.channel) ||
      (bundle.channel === 'SMS link' && settings?.assessmentSms === false)) return 'Choose an available collection method.';
  if (allowedCollectionMethodsError(bundle, ['Clinic tablet', 'Clinician entry',
    ...(settings?.assessmentSms === false ? [] : ['SMS link'])]) ||
      Array.isArray(bundle.allowedCollectionMethods) && !bundle.allowedCollectionMethods.includes(bundle.channel))
    return 'Choose Any or allowed collection methods that include the planned method.';
  if (!['days', 'date'].includes(bundle.timing || 'days')) return 'Choose Event or Date.';
  if ((bundle.timing || 'days') === 'days' && (!Number.isInteger(bundle.delayDays) || bundle.delayDays < 0 || bundle.delayDays > 728)) return 'Enter a time from 0 to 728 days after the selected trigger.';
  if ((bundle.timing || 'days') === 'days' && !['care-period', 'intake', 'specific-measure'].includes(bundle.after)) return 'Choose what starts the schedule.';
  if ((bundle.timing || 'days') === 'days' && specificMeasureError(bundle, settings)) return specificMeasureError(bundle, settings);
  if (profileValueTriggerError(bundle)) return profileValueTriggerError(bundle);
  if (bundle.timing === 'date' && (!validReviewDate(bundle.dueDate) || bundle.repeat)) return 'Enter a valid due date.';
  if (bundle.careLevel !== 'All' && !CARE_LEVELS.includes(bundle.careLevel)) return 'Choose a care level.';
  if ([bundle.minAge, bundle.maxAge].some(value => value != null && (!Number.isInteger(value) || value < 0 || value > 120)) ||
      bundle.minAge != null && bundle.maxAge != null && bundle.minAge > bundle.maxAge) return 'Enter a valid age range.';
  if ([bundle.programStream].some(stream => { const versions = mvpInitialVersions(bundle, stream);
    return !versions.length || new Set(versions).size !== versions.length ||
      versions.some(version => !INSTRUMENTS.some(instrument => instrument.version === version && instrument.respondents.includes('Person')));
  })) return 'Choose at least one unique young-person measure for this program stream.';
  return null;
}
const reviewStreams = initialStreams;
export const MVP_REVIEW_BUNDLES = ['Clinician'].flatMap(respondent => reviewStreams.map(stream => ({
  id: `MVP-REVIEW-${respondent.toUpperCase()}-${stream.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`,
  name: `90-day review · ${respondent === 'Person' ? 'Young person' : 'Clinician'} · ${stream}`,
  respondent, channel: respondent === 'Clinician' ? 'Clinician entry' : 'Clinic tablet', enabled: true,
  days: 90, repeat: true, timing: 'days', after: 'intake', programStream: stream, careLevel: 'All', minAge: null, maxAge: null,
  statusChange: 'Ongoing review',
})));
export const mvpReviewBundles = settings => {
  const saved = settings?.mvpReviewBundles;
  if (!saved) return MVP_REVIEW_BUNDLES;
  return saved.flatMap(bundle => {
    const original = MVP_REVIEW_BUNDLES.find(item => item.id === bundle.id);
    return original ? [{ ...original, ...bundle, respondent: 'Clinician', channel: 'Clinician entry' }] : [];
  });
};

export function mvpBattery(stream, respondent) {
  if (epCodebookStreams.has(stream) && respondent === 'Clinician')
    return EP_BATCH_3_INSTRUMENTS.map(instrument => instrument.version);
  if (PROGRAM_STREAMS.includes(stream) && respondent === 'Clinician')
    return [CLINICIAN_REVIEW_INSTRUMENT.version];
  return [];
}
export function mvpReviewItems(bundle) {
  const configured = bundle.assessments;
  const allowed = mvpBattery(bundle.programStream, bundle.respondent);
  if (configured?.length && configured.every(item => allowed.includes(item.version))) return configured;
  return allowed
    .map((version, index) => ({ id: `${bundle.programStream}-${index}`, version, requirement: 'Mandatory' }));
}
export function mvpReviewBundleError(bundle, settings) {
  if (!MVP_REVIEW_BUNDLES.some(item => item.id === bundle?.id)) return 'Choose a review bundle.';
  if (!bundle.name?.trim() || bundle.name.trim().length > 80) return 'Enter an assessment name of 80 characters or fewer.';
  if (!validMeasureStatusChange(bundle.statusChange)) return 'Choose a valid status change.';
  if (bundle.respondent !== 'Clinician') return 'The 90 Day Review is clinician-facing.';
  if (bundle.respondent === 'Clinician' && bundle.channel !== 'Clinician entry') return 'Clinician measures use Clinician entry.';
  if (!['Clinic tablet', 'Clinician entry', 'SMS link'].includes(bundle.channel) ||
      (bundle.channel === 'SMS link' && settings?.assessmentSms === false)) return 'Choose an available collection method.';
  if (allowedCollectionMethodsError(bundle, bundle.respondent === 'Clinician' ? ['Clinician entry']
    : ['Clinic tablet', 'Clinician entry', ...(settings?.assessmentSms === false ? [] : ['SMS link'])]) ||
      Array.isArray(bundle.allowedCollectionMethods) && !bundle.allowedCollectionMethods.includes(bundle.channel))
    return 'Choose Any or allowed collection methods that include the planned method.';
  if (typeof bundle.enabled !== 'boolean' || typeof bundle.repeat !== 'boolean') return 'Choose whether the assessment is enabled and repeats.';
  if (!PROGRAM_STREAMS.includes(bundle.programStream)) return 'Choose a program stream.';
  if (bundle.careLevel !== 'All' && !CARE_LEVELS.includes(bundle.careLevel)) return 'Choose a care level.';
  if ([bundle.minAge, bundle.maxAge].some(value => value != null && (!Number.isInteger(value) || value < 0 || value > 120)) ||
      bundle.minAge != null && bundle.maxAge != null && bundle.minAge > bundle.maxAge) return 'Enter a valid age range.';
  if (!['days', 'date'].includes(bundle.timing)) return 'Choose a schedule.';
  if (bundle.timing === 'days' && !['intake', 'care-period', 'specific-measure'].includes(bundle.after)) return 'Choose what starts the schedule.';
  if (bundle.timing === 'days' && specificMeasureError(bundle, settings)) return specificMeasureError(bundle, settings);
  if (profileValueTriggerError(bundle)) return profileValueTriggerError(bundle);
  if (bundle.timing === 'days' && (!Number.isInteger(bundle.days) || bundle.days < 1 || bundle.days > 728)) return 'Enter a time from 1 to 728 days.';
  if (bundle.timing === 'date' && (!validReviewDate(bundle.dueDate) || bundle.repeat)) return 'Enter a valid date for a one-off review.';
  const items = mvpReviewItems(bundle);
  if (!items.length) return 'Add at least one measure.';
  if (new Set(items.map(item => item.id)).size !== items.length ||
      new Set(items.map(item => item.version)).size !== items.length ||
      items.some(item => item.requirement !== 'Mandatory' ||
        !INSTRUMENTS.find(instrument => instrument.version === item.version &&
        instrument.respondents.includes(bundle.respondent)))) return 'Choose unique measures compatible with the respondent.';
  return null;
}

export function mvpBlankAssessmentTemplate(episode, today, versions = [], respondent = 'Person', channel = 'Clinic tablet') {
  const stream = carePeriodAt(episode, today)?.programStream || episode?.programStream;
  return {
    id:'MVP-BLANK', name:'Blank assessment', enabled:true,
    trigger:'current', programStream:stream || 'All', careLevel:'All',
    timing:'date', dueDate:today, repeat:false, channel, recipient:respondent,
    assessments:versions.map((version,index) => ({id:`blank-${index}`, version,
      requirement:'Mandatory', channel, recipient:respondent})),
  };
}

const bundleId = (episodeId, due, respondent) => `MVP-${episodeId}-${due}-${respondent === 'Person' ? 'patient' : 'clinician'}`;

function ensureClientProfiles(state, today) {
  const config = clientProfileBundle(state.settings);
  if (!config?.enabled || clientProfileBundleError(config, state.settings)) return state;
  let changed = false;
  const people = state.people.map(person => {
    if (!person.clientProfileRequired || person.archivedAt || person.readOnly) return person;
    let personChanged = false;
    const episodes = person.episodes.map(episode => {
      const period = carePeriodAt(episode, today);
      const stream = period?.programStream || episode.programStream;
      if (episode.status !== 'Active' || episode.number !== '01' || episode.readOnly ||
          episode.collections?.some(record => record.clientProfileMeasure) ||
          !reviewBundleMatches(config, person, period, stream, today) ||
          !profileValueMatches(config, person, episode)) return episode;
      const intake = person.intakes?.find(item => item.episodeId === episode.id && item.status === 'Completed' && item.outcome === 'Proceed');
      const source = config.timing === 'date' ? { anchor: config.dueDate } :
        config.after === 'specific-measure' ? measureStatusSources(episode, config.triggerMeasureId, config.triggerMeasureStatus, today)[0] :
          config.after === 'intake' ? intake && { anchor: intake.decisionAt?.slice(0, 10) || episode.start } :
            { anchor: episode.start };
      if (!source?.anchor) return episode;
      const due = config.timing === 'date' ? config.dueDate : addDays(source.anchor, config.delayDays || 0);
      if (!due) return episode;
      personChanged = changed = true;
      return { ...episode, collections: [...(episode.collections || []), ...clientProfileRecords(person, episode, today, config, due, source.anchor)] };
    });
    return personChanged ? { ...person, episodes } : person;
  });
  return changed ? { ...state, people } : state;
}

function ensureInitialAssessments(state, today) {
  const initialBundles = mvpInitialBundles(state.settings);
  let changed = false;
  const people = state.people.map(person => {
    if (person.archivedAt || person.readOnly) return person;
    let personChanged = false;
    const episodes = person.episodes.map(episode => {
      if (episode.status !== 'Active' || episode.readOnly || !validReviewDate(episode.start)) return episode;
      const existingInitial = (episode.collections || []).filter(record => record.mvpInitialAssessment);
      const startPeriod = carePeriodAt(episode, episode.start);
      const stream = startPeriod?.programStream || episode.programStream;
      if (!PROGRAM_STREAMS.includes(stream)) return episode;
      const sourceFor = bundle => bundle.after === 'specific-measure'
        ? (!person.clientProfileRequired || !clientProfileBundle(state.settings)?.enabled) && bundle.triggerMeasureId === CLIENT_PROFILE_BUNDLE_ID
          ? [{ anchor: episode.start }] : measureStatusSources(episode, bundle.triggerMeasureId, bundle.triggerMeasureStatus, today)
        : [{ anchor: bundle.after === 'intake' ? episode.reviewAnchorDate || episode.start : episode.start }];
      const matchingYoungBundles = initialBundles.filter(bundle => bundle.enabled && bundle.programStream === stream &&
        reviewBundleMatches(bundle, person, startPeriod, stream, episode.start) &&
        profileValueMatches(bundle, person, episode) &&
        (bundle.timing === 'date' || sourceFor(bundle).length) &&
        !mvpInitialBundleError(bundle, state.settings));
      const existingYoung = existingInitial.filter(record => record.mvpRespondent === 'Person');
      const hasLegacyYoung = existingYoung.some(record => !record.mvpInitialBundleDefinitionId);
      const makeRecords = (respondent, bundle, id) => {
        if (existingInitial.some(record => record.bundleId === id)) return [];
        const name = bundle?.name || 'Initial assessment · Clinician';
        const versions = mvpInitialVersions(bundle, stream);
        const triggerDate = bundle?.timing === 'date' ? bundle.dueDate : bundle ? sourceFor(bundle)[0]?.anchor : episode.start;
        const due = bundle?.timing === 'date' ? bundle.dueDate : bundle ? addDays(triggerDate, bundle.delayDays) : triggerDate;
        return versions.map((version, index) => {
          const instrument = INSTRUMENTS.find(item => item.version === version);
          return {
            id: `${id}-${index}`, label: `${instrument.name} · ${name}`, version,
            due, createdAt: `${episode.start}T12:00:00.000Z`,
            assignment: 'Planned', response: 'Not started', review: 'Pending', link: 'Not sent',
            scheduleFree: true, attempts: [], answers: [], channel: bundle?.channel || 'Clinician entry',
            respondent, recorder: respondent, assistance: 'Independent', appointmentId: null,
            bundleId: id, surveyId: id, bundleName: name, bundleAssessmentId: `${respondent}-${index}`,
            bundleRequirement: 'Mandatory', bundleSource: 'Scheduled', scheduleAnchor: triggerDate,
            bundleContext: { trigger: 'current', programStream: stream, careLevel: 'All', timing: 'date', dueDate: due, statusChange: bundle?.statusChange || '' },
            mvpInitialAssessment: true, mvpRespondent: respondent,
            ...(instrument.codebookBatch ? { codebookBatch: instrument.codebookBatch,
              codebookDataItem: instrument.codebookDataItem } : {}),
            ...(bundle ? { mvpInitialBundleDefinitionId: bundle.id } : {}),
          };
        });
      };
      const youngBaseId = `MVP-INITIAL-${episode.id}-young-person`;
      const youngRecords = matchingYoungBundles.flatMap((bundle, index) => {
        if (existingYoung.some(record => record.mvpInitialBundleDefinitionId === bundle.id) ||
            index === 0 && hasLegacyYoung) return [];
        const id = index === 0 && !existingYoung.length ? youngBaseId : `${youngBaseId}-${bundle.id}`;
        return makeRecords('Person', bundle, id);
      });
      const records = youngRecords;
      if (!records.length) return episode;
      const replaceBlankIntakeForm = epCodebookStreams.has(stream) && youngRecords.length > 0;
      const retained = replaceBlankIntakeForm ? (episode.collections || []).filter(record =>
        !(record.version === 'Initial assessment v1.0' && record.label === 'Initial assessment' &&
          record.response === 'Not started' && !record.attempts?.length &&
          !record.answers?.some(Boolean) && !record.draftAnswers?.some(Boolean)))
        : (episode.collections || []);
      changed = personChanged = true;
      return { ...episode, collections: [...retained, ...records] };
    });
    return personChanged ? { ...person, episodes } : person;
  });
  return changed ? { ...state, people } : state;
}

function exampleAnswers(instrument, date) {
  let answers = Array(instrument.questions.length).fill(null);
  for (let index = 0; index < instrument.questions.length; index += 1) {
    const progress = questionnaireState(instrument, answers);
    if (progress.complete) return progress.answers;
    for (const entry of progress.missing) {
      const question = entry.question;
      answers[entry.index] = question.options?.[0] || question.nonResponseOptions?.[0] ||
        (question.responseType === 'date' ? date :
          question.responseType === 'number' ? String(question.min ?? 22) :
            question.responseType === 'text' ? 'Fictional sample response' : null);
    }
  }
  return questionnaireState(instrument, answers).answers;
}

function completeExample(record, person, date) {
  const instrument = INSTRUMENTS.find(item => item.version === record.version);
  const answers = exampleAnswers(instrument, date);
  const attemptId = `${record.id}-mvp-example-session`;
  const timestamp = `${date}T12:00:00.000Z`;
  const respondentName = record.respondent === 'Clinician' ? record.respondentName || 'Jess Taylor' : person.name;
  return { ...record, answers, answerSources: Object.fromEntries(instrument.questions
    .filter((_, index) => answers[index]).map(question => [question.id, attemptId])),
    assignment: 'Fulfilled', response: 'Submitted', assessmentProgress: 'Completed',
    link: 'Ended', review: 'Reviewed', reviewDate: date, reviewActor: 'Sample fixture',
    reviewNote: 'Fictional completed assessment example.', submittedAt: date,
    submittedTimestamp: timestamp, submittedAttemptId: attemptId,
    respondentName, recorderName: respondentName,
    attempts: [...(record.attempts || []).map(attempt => attempt.endedAt ? attempt
      : { ...attempt, endedAt: timestamp, status: 'Collection method changed' }),
      { id: attemptId, date, channel: record.channel, status: 'Response submitted',
        respondentName, recorderName: respondentName, endedAt: timestamp }],
    mvpDemoExample: true };
}

function ensureFictionalExamples(state, today) {
  const person = state.people.find(item => item.id === 'YS-1034' && item.fixtureLabel === 'Fictional full-report example');
  const episode = person?.episodes.find(item => item.id === 'EP-1034-01' && item.status === 'Active');
  if (!episode || episode.mvpDemoExamplesRevision === 9) return state;
  const next = structuredClone(state);
  const examplePerson = next.people.find(item => item.id === person.id);
  const exampleEpisode = examplePerson.episodes.find(item => item.id === episode.id);
  const initial = exampleEpisode.collections.filter(record => record.mvpInitialAssessment && record.mvpRespondent === 'Person');
  // Earlier fixtures auto-submitted the first young-person review. Restore only
  // that generated submission; leave responses collected by staff untouched.
  exampleEpisode.collections = exampleEpisode.collections.map(record => {
    if (!record.mvpTimepointId || record.mvpRespondent !== 'Person' || !record.mvpDemoExample ||
        record.response !== 'Submitted' || record.submittedAttemptId !== `${record.id}-mvp-example-session`) return record;
    const restored = { ...record, assignment: 'Planned', response: 'Not started',
      assessmentProgress: 'Not started', link: 'Not sent', review: 'Pending',
      answers: [], answerSources: {}, attempts: (record.attempts || []).filter(attempt =>
        attempt.id !== record.submittedAttemptId) };
    for (const key of ['reviewDate', 'reviewActor', 'reviewNote', 'submittedAt',
      'submittedTimestamp', 'submittedAttemptId', 'respondentName', 'recorderName', 'mvpDemoExample']) delete restored[key];
    return restored;
  });
  const untouched = records => records.length && records.every(record => record.response === 'Not started' &&
    !record.attempts?.length && !record.answers?.some(Boolean) && !record.draftAnswers?.some(Boolean));
  if (untouched(initial)) {
    const ids = new Set(initial.map(record => record.id));
    exampleEpisode.collections = exampleEpisode.collections.map(record => ids.has(record.id)
      ? completeExample(record, examplePerson, addDays(episode.start, 1)) : record);
  }
  // Retire only the old one-off demonstration records. Keep any record a staff
  // member has worked on, even if it began from the earlier sample fixture.
  const oldDemoIds = new Set([
    `MVP-DEMO-USER-COMPLETED-${episode.id}-0`,
    `MVP-DEMO-USER-ACTIVE-${episode.id}-0`,
  ]);
  exampleEpisode.collections = exampleEpisode.collections.filter(record => {
    if (!oldDemoIds.has(record.id) || record.revision) return true;
    if (record.id.includes('-COMPLETED-')) return !(record.mvpDemoExample &&
      record.reviewActor === 'Sample fixture' &&
      record.submittedAttemptId === `${record.id}-mvp-example-session`);
    return !(record.response === 'Not started' && !record.attempts?.length &&
      !record.answers?.some(Boolean) && !record.draftAnswers?.some(Boolean));
  });
  const remainingIds = new Set(exampleEpisode.collections.map(record => record.id));
  exampleEpisode.assessmentBundleInstances = (exampleEpisode.assessmentBundleInstances || [])
    .filter(instance => !instance.id.startsWith('MVP-DEMO-USER-') ||
      instance.collectionIds?.some(id => remainingIds.has(id)));

  const firstReviewDue = exampleEpisode.collections.filter(record => record.mvpTimepointId && record.due <= today)
    .map(record => record.due).sort()[0];
  const firstReview = firstReviewDue && ['Person', 'Clinician']
    .map(respondent => exampleEpisode.collections.filter(record => record.mvpTimepointId &&
      record.mvpRespondent === respondent && record.due === firstReviewDue))
    .find(untouched);
  if (firstReview && !firstReview.some(record => INSTRUMENTS.find(item => item.version === record.version)?.codebookBatch)) {
    const ids = new Set(firstReview.map(record => record.id));
    exampleEpisode.collections = exampleEpisode.collections.map(record => ids.has(record.id)
      ? completeExample(record, examplePerson, firstReviewDue) : record);
  }
  exampleEpisode.mvpDemoExamplesRevision = 9;
  return next;
}

function reviewBundleMatches(bundle, person, period, stream, today) {
  if (bundle.programStream !== 'All' && bundle.programStream !== stream ||
      bundle.careLevel !== 'All' && bundle.careLevel !== period?.careLevel) return false;
  if (bundle.minAge == null && bundle.maxAge == null) return true;
  if (!validReviewDate(person.dob) || person.dob > today) return false;
  let age = Number(today.slice(0, 4)) - Number(person.dob.slice(0, 4));
  if (today.slice(5) < person.dob.slice(5)) age--;
  return (bundle.minAge == null || age >= bundle.minAge) && (bundle.maxAge == null || age <= bundle.maxAge);
}

export function mvpInitialCompletionDate(episode, settings) {
  const records = (episode?.collections || []).filter(record =>
    record.mvpInitialAssessment && record.mvpRespondent === 'Person');
  if (!records.length || records.some(record => record.response !== 'Submitted' ||
      !validReviewDate(record.submittedAt?.slice(0, 10)))) return null;
  if (initialAssessmentReadyForOutcome(episode, settings) && !assessmentOutcomeProceeds(episode)) return null;
  return records.map(record => record.submittedAt.slice(0, 10)).sort().at(-1);
}

function removePrematureProfileReviews(state, today) {
  const specificReviewIds = new Set(mvpReviewBundles(state.settings)
    .filter(bundle => bundle.after === 'specific-measure').map(bundle => bundle.id));
  let changed = false;
  const people = state.people.map(person => {
    if (!person.mvpProfile) return person;
    let personChanged = false;
    const episodes = person.episodes.map(episode => {
      const collections = episode.collections || [];
      const initialCompletedAt = mvpInitialCompletionDate(episode, state.settings);
      const firstReviewDue = initialCompletedAt && addDays(initialCompletedAt, MVP_REVIEW_DAYS);
      const hasSubmittedReview = collections.some(record =>
        record.mvpTimepointId && record.response === 'Submitted');
      const prematureTimepoints = new Set(collections
        .filter(record => record.mvpTimepointId && !specificReviewIds.has(record.mvpBundleDefinitionId) &&
          (!firstReviewDue || record.due > today ||
            (!hasSubmittedReview && record.due !== firstReviewDue)))
        .map(record => record.mvpTimepointId));
      const removable = new Set([...prematureTimepoints].filter(id => collections
        .filter(record => record.mvpTimepointId === id)
        .every(record => !specificReviewIds.has(record.mvpBundleDefinitionId) && record.response === 'Not started' &&
          !record.attempts?.length && !record.answers?.some(Boolean) &&
          !record.draftAnswers?.some(Boolean) && !record.notRequiredReason)));
      if (!removable.size) return episode;
      changed = personChanged = true;
      return { ...episode,
        collections: collections.filter(record => !removable.has(record.mvpTimepointId)),
        events: (episode.events || []).filter(event =>
          event.actionType !== 'SCHEDULE_MVP_REVIEW' || !removable.has(event.timepointId)),
      };
    });
    return personChanged ? { ...person, episodes } : person;
  });
  return changed ? { ...state, people } : state;
}

export function reconcileMvpAssessmentPathway(state, today) {
  state = ensureClientProfiles(state, today);
  if (!mvpPathwayEnabled(state.settings)) return state;
  state = ensureInitialAssessments(state, today);
  state = removePrematureProfileReviews(state, today);
  let changed = false;
  const people = state.people.map(person => {
    if (person.archivedAt || person.readOnly) return person;
    let personChanged = false;
    const episodes = person.episodes.map(episode => {
      if (episode.status !== 'Active' || episode.readOnly) return episode;
      const period = carePeriodAt(episode, today);
      const stream = period?.programStream || episode.programStream;
      if (!PROGRAM_STREAMS.includes(stream)) return episode;
      const initialCompletedAt = person.mvpProfile ? mvpInitialCompletionDate(episode, state.settings) : null;
      const records = [], events = [];
      const configuredBundles = mvpReviewBundles(state.settings);
      for (const bundle of configuredBundles) {
        if (person.mvpProfile && !initialCompletedAt) continue;
        if (!bundle.enabled || !reviewBundleMatches(bundle, person, period, stream, today) ||
            !profileValueMatches(bundle, person, episode) ||
            mvpReviewBundleError(bundle, state.settings)) continue;
        const role = bundle.respondent;
        const legacyDefinition = configuredBundles.find(peer => peer.enabled && peer.respondent === role &&
          peer.programStream === bundle.programStream)?.id;
        const existing = (episode.collections || []).filter(record => record.mvpTimepointId &&
          (record.mvpBundleDefinitionId === bundle.id || !record.mvpBundleDefinitionId && legacyDefinition === bundle.id &&
            record.mvpRespondent === role && record.bundleContext?.programStream === bundle.programStream));
        const latestDue = existing.map(record => record.due).filter(validReviewDate).sort().at(-1);
        if (latestDue && (existing.some(record => record.due === latestDue && record.response !== 'Submitted') || !bundle.repeat)) continue;
        const synchronizedRoles = configuredBundles.filter(peer => peer.enabled && peer.id !== bundle.id && peer.respondent !== role &&
          peer.days === bundle.days && peer.timing === bundle.timing && peer.after === bundle.after && peer.dueDate === bundle.dueDate &&
          peer.programStream === bundle.programStream && peer.careLevel === bundle.careLevel &&
          reviewBundleMatches(peer, person, period, stream, today))
          .map(peer => peer.respondent);
        if (latestDue && (episode.collections || []).some(record => record.mvpTimepointId &&
          record.due === latestDue && synchronizedRoles.includes(record.mvpRespondent) && record.response !== 'Submitted')) continue;
        const source = bundle.after === 'specific-measure'
          ? measureStatusSources(episode, bundle.triggerMeasureId, bundle.triggerMeasureStatus, today)[0] : null;
        if (bundle.after === 'specific-measure' && !source) continue;
        const anchor = source?.anchor || (bundle.after === 'care-period' ? period?.startDate : episode.reviewAnchorDate || episode.start);
        const firstDue = bundle.after === 'specific-measure' ? addDays(anchor, bundle.days) : person.mvpProfile ? addDays(initialCompletedAt, MVP_REVIEW_DAYS) :
          bundle.timing === 'date' ? bundle.dueDate :
          bundle.after === 'intake' && episode.reviewSchedule?.confirmed && validReviewDate(episode.reviewSchedule?.outcome?.due) && bundle.days === MVP_REVIEW_DAYS
            ? episode.reviewSchedule.outcome.due : addDays(anchor, bundle.days);
        const due = latestDue ? addDays(latestDue, bundle.days) : firstDue;
        if (!validReviewDate(due)) continue;
        if (person.mvpProfile && due > today) continue;
        const timepointId = `MVP-${episode.id}-${due}`;
        const baseId = bundleId(episode.id, due, role);
        const id = [...(episode.collections || []), ...records].some(record => record.bundleId === baseId &&
          record.mvpBundleDefinitionId !== bundle.id) ? `${baseId}-${bundle.id}` : baseId;
        const items = mvpReviewItems(bundle);
        if (items.some((item, index) => episode.collections?.some(record => record.id === `${id}-${index}`))) continue;
        records.push(...items.map((item, index) => {
          const instrument = INSTRUMENTS.find(candidate => candidate.version === item.version);
          return {
            id: `${id}-${index}`, label: `${instrument.name} · ${bundle.name}`, version: item.version, due,
            createdAt: `${today}T12:00:00.000Z`, assignment: 'Planned', response: 'Not started',
            review: 'Pending', link: 'Not sent', scheduleFree: true,
            attempts: [], answers: [], channel: bundle.channel, respondent: bundle.respondent, recorder: bundle.respondent,
            assistance: bundle.channel === 'Clinician entry' && bundle.respondent !== 'Clinician' ? 'Transcribed' : 'Independent', appointmentId: null,
            bundleId: id, surveyId: id, bundleName: bundle.name, bundleAssessmentId: item.id, bundleRequirement: 'Mandatory',
            bundleSource: 'Scheduled', scheduleAnchor: anchor,
            bundleContext: { trigger: 'current', programStream: stream, careLevel: bundle.careLevel, timing: 'date', dueDate: due, statusChange: bundle.statusChange || '' },
            mvpTimepointId: timepointId, mvpRespondent: role, mvpBundleDefinitionId: bundle.id,
            ...(instrument.codebookBatch ? { codebookBatch: instrument.codebookBatch,
              codebookDataItem: instrument.codebookDataItem } : {}),
          };
        }));
        events.push({
          id: `EVENT-${timepointId}-${bundle.id}`, date: today, timestamp: `${today}T12:00:00.000Z`,
          title: '90-day review scheduled', detail: `${stream} stream · ${bundle.name} · due ${due}`,
          actionType: 'SCHEDULE_MVP_REVIEW', actor: 'System', role: 'System',
          personId: person.id, episodeId: episode.id, collectionId: null, timepointId,
        });
      }
      if (!records.length) return episode;
      changed = personChanged = true;
      return { ...episode, collections: [...(episode.collections || []), ...records],
        events: [...events, ...(episode.events || [])] };
    });
    return personChanged ? { ...person, episodes } : person;
  });
  return ensureFictionalExamples(changed ? { ...state, people } : state, today);
}
