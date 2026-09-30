import { carePeriodAt, PROGRAM_STREAMS, CARE_LEVELS } from './carePeriods.js';
import { addDays, validReviewDate } from './episodeReviews.js';
import { INSTRUMENTS, MVP_STREAM_QUESTIONNAIRES, NINETY_DAY_REVIEW_INSTRUMENT, questionnaireState } from './instruments.js';

export const mvpAssessmentMode = settings => settings?.advancedAssessmentOptions === false;
export const mvpPathwayEnabled = settings => mvpAssessmentMode(settings) && settings?.mvpAssessmentPathway !== false;
export const mvpClinicianCreationEnabled = settings => mvpAssessmentMode(settings) && settings?.mvpClinicianCreation === true;
export const mvpBundleEditingEnabled = settings => mvpAssessmentMode(settings) && settings?.mvpBundleEditing !== false;
export const MVP_REVIEW_DAYS = 90;
export const MVP_INITIAL_BUNDLE = { id: 'MVP-INITIAL-PERSON', name: 'Initial assessment · Young person', respondent: 'Person', channel: 'Clinic tablet', enabled: true, delayDays: 0, programStream: 'All', careLevel: 'All', minAge: null, maxAge: null, coreVersion: 'Initial assessment v1.0' };
const initialStreams = ['General', ...PROGRAM_STREAMS.filter(stream => stream !== 'General')];
export const MVP_INITIAL_BUNDLES = initialStreams.map(stream => ({ ...MVP_INITIAL_BUNDLE,
  id: `MVP-INITIAL-PERSON-${stream.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`,
  name: `${MVP_INITIAL_BUNDLE.name} · ${stream}`, programStream: stream }));
export const mvpInitialBundles = settings => {
  if (Array.isArray(settings?.mvpInitialBundles)) return MVP_INITIAL_BUNDLES.flatMap(original => {
    const saved = settings.mvpInitialBundles.find(bundle => bundle.id === original.id);
    return saved ? [{ ...original, ...saved, id: original.id, programStream: original.programStream }] : [];
  });
  if (settings?.mvpInitialBundle === null) return [];
  const legacy = { ...MVP_INITIAL_BUNDLE, ...settings?.mvpInitialBundle };
  return MVP_INITIAL_BUNDLES.filter(bundle => legacy.programStream === 'All' || legacy.programStream === bundle.programStream)
    .map(bundle => ({ ...bundle, ...legacy, id: bundle.id, programStream: bundle.programStream,
      name: `${legacy.name.trim().slice(0, 77 - bundle.programStream.length).trim()} · ${bundle.programStream}` }));
};
export const mvpInitialVersions = (bundle, stream) => bundle.assessmentsByStream?.[stream] ||
  [bundle.coreVersion, MVP_STREAM_QUESTIONNAIRES[stream]?.version].filter(Boolean);
export function mvpInitialBundleError(bundle, settings) {
  const original = MVP_INITIAL_BUNDLES.find(item => item.id === bundle?.id);
  if (!original || bundle.programStream !== original.programStream || !bundle.name?.trim() || bundle.name.trim().length > 80) return 'Enter an assessment name of 80 characters or fewer.';
  if (bundle.respondent !== 'Person' || typeof bundle.enabled !== 'boolean') return 'Choose a valid initial assessment.';
  if (!['Clinic tablet', 'Clinician entry', 'SMS link'].includes(bundle.channel) ||
      (bundle.channel === 'SMS link' && settings?.assessmentSms === false)) return 'Choose an available collection method.';
  if (!Number.isInteger(bundle.delayDays) || bundle.delayDays < 0 || bundle.delayDays > 728) return 'Enter a time from 0 to 728 days after the care episode starts.';
  if (bundle.careLevel !== 'All' && !CARE_LEVELS.includes(bundle.careLevel)) return 'Choose a care level.';
  if ([bundle.minAge, bundle.maxAge].some(value => value != null && (!Number.isInteger(value) || value < 0 || value > 120)) ||
      bundle.minAge != null && bundle.maxAge != null && bundle.minAge > bundle.maxAge) return 'Enter a valid age range.';
  if ([bundle.programStream].some(stream => { const versions = mvpInitialVersions(bundle, stream);
    return !versions.length || new Set(versions).size !== versions.length ||
      versions.some(version => !INSTRUMENTS.some(instrument => instrument.version === version && instrument.respondents.includes('Person')));
  })) return 'Choose at least one unique young-person instrument for this program stream.';
  return null;
}
const reviewStreams = initialStreams;
export const MVP_REVIEW_BUNDLES = ['Person', 'Family respondent'].flatMap(respondent => reviewStreams.map(stream => ({
  id: `MVP-REVIEW-${respondent === 'Person' ? 'PERSON' : 'FAMILY'}-${stream.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`,
  name: `90-day review · ${respondent === 'Person' ? 'Young person' : 'Family'} · ${stream}`,
  respondent, channel: 'Clinic tablet', enabled: true,
  days: 90, repeat: true, timing: 'days', after: 'intake', programStream: stream, careLevel: 'All', minAge: null, maxAge: null,
})));
export const mvpReviewBundles = settings => {
  const saved = settings?.mvpReviewBundles;
  if (!saved) return MVP_REVIEW_BUNDLES;
  return saved.flatMap(bundle => {
    const legacyRole = bundle.id === 'MVP-REVIEW-PERSON' ? 'Person'
      : bundle.id === 'MVP-REVIEW-FAMILY' ? 'Family respondent' : null;
    if (legacyRole) return reviewStreams.map(stream => {
      const initial = MVP_REVIEW_BUNDLES.find(item => item.programStream === stream && item.respondent === legacyRole);
      return { ...initial, ...bundle, id: initial.id, programStream: stream,
        name: `${bundle.name} · ${stream}`, assessments: bundle.assessmentsByStream?.[stream] };
    });
    const original = MVP_REVIEW_BUNDLES.find(item => item.id === bundle.id);
    return { ...original, ...bundle, programStream: original?.programStream };
  });
};

const coreVersion = {
  Person: NINETY_DAY_REVIEW_INSTRUMENT.version,
  'Family respondent': 'Your preferences and next steps v2.0',
};

export function mvpBattery(stream, respondent) {
  const streamVersion = MVP_STREAM_QUESTIONNAIRES[stream]?.version;
  return streamVersion && coreVersion[respondent] ? [coreVersion[respondent], streamVersion] : [];
}
export function mvpReviewItems(bundle) {
  return bundle.assessments || mvpBattery(bundle.programStream, MVP_REVIEW_BUNDLES.find(item => item.id === bundle.id)?.respondent)
    .map((version, index) => ({ id: `${bundle.programStream}-${index}`, version, requirement: 'Mandatory' }));
}
export function mvpReviewBundleError(bundle, settings) {
  if (!MVP_REVIEW_BUNDLES.some(item => item.id === bundle?.id)) return 'Choose a review bundle.';
  if (!bundle.name?.trim() || bundle.name.trim().length > 80) return 'Enter an assessment name of 80 characters or fewer.';
  if (!['Person', 'Family respondent'].includes(bundle.respondent)) return 'Choose a respondent.';
  if (!['Clinic tablet', 'Clinician entry', 'SMS link'].includes(bundle.channel) ||
      (bundle.channel === 'SMS link' && settings?.assessmentSms === false)) return 'Choose an available collection method.';
  if (typeof bundle.enabled !== 'boolean' || typeof bundle.repeat !== 'boolean') return 'Choose whether the assessment is enabled and repeats.';
  if (!PROGRAM_STREAMS.includes(bundle.programStream)) return 'Choose a program stream.';
  if (bundle.careLevel !== 'All' && !CARE_LEVELS.includes(bundle.careLevel)) return 'Choose a care level.';
  if ([bundle.minAge, bundle.maxAge].some(value => value != null && (!Number.isInteger(value) || value < 0 || value > 120)) ||
      bundle.minAge != null && bundle.maxAge != null && bundle.minAge > bundle.maxAge) return 'Enter a valid age range.';
  if (!['days', 'date'].includes(bundle.timing)) return 'Choose a schedule.';
  if (bundle.timing === 'days' && !['intake', 'care-period'].includes(bundle.after)) return 'Choose what starts the schedule.';
  if (bundle.timing === 'days' && (!Number.isInteger(bundle.days) || bundle.days < 1 || bundle.days > 728)) return 'Enter a time from 1 to 728 days.';
  if (bundle.timing === 'date' && (!validReviewDate(bundle.dueDate) || bundle.repeat)) return 'Enter a valid date for a one-off review.';
  const items = mvpReviewItems(bundle);
  if (!items.length) return 'Add at least one instrument.';
  if (new Set(items.map(item => item.id)).size !== items.length ||
      new Set(items.map(item => item.version)).size !== items.length ||
      items.some(item => item.requirement !== 'Mandatory' ||
        !INSTRUMENTS.find(instrument => instrument.version === item.version &&
        instrument.respondents.includes(bundle.respondent)))) return 'Choose unique instruments compatible with the respondent.';
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

const bundleId = (episodeId, due, respondent) => `MVP-${episodeId}-${due}-${respondent === 'Person' ? 'young-person' : 'family'}`;

const initialCoreVersion = {
  Person: INSTRUMENTS.find(instrument => instrument.name === 'Initial assessment')?.version,
  'Family respondent': 'Your preferences and next steps v2.0',
};

function ensureInitialAssessments(state) {
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
      const streamVersion = MVP_STREAM_QUESTIONNAIRES[stream]?.version;
      if (!streamVersion) return episode;
      const initialBundle = initialBundles.find(bundle => bundle.programStream === stream);
      const records = ['Person', 'Family respondent'].flatMap(respondent => {
        if (existingInitial.some(record => record.mvpRespondent === respondent)) return [];
        if (respondent === 'Person' && (!initialBundle || !initialBundle.enabled ||
            !reviewBundleMatches(initialBundle, person, startPeriod, stream, episode.start) ||
            mvpInitialBundleError(initialBundle, state.settings))) return [];
        const name = respondent === 'Person' ? initialBundle.name : 'Initial assessment · Family';
        const id = `MVP-INITIAL-${episode.id}-${respondent === 'Person' ? 'young-person' : 'family'}`;
        const versions = respondent === 'Person' ? mvpInitialVersions(initialBundle, stream) : [initialCoreVersion[respondent], streamVersion];
        const due = respondent === 'Person' ? addDays(episode.start, initialBundle.delayDays) : episode.start;
        return versions.map((version, index) => {
          const instrument = INSTRUMENTS.find(item => item.version === version);
          return {
            id: `${id}-${index}`, label: `${instrument.name} · ${name}`, version,
            due, createdAt: `${episode.start}T12:00:00.000Z`,
            assignment: 'Planned', response: 'Not started', review: 'Pending', link: 'Not sent',
            scheduleFree: true, attempts: [], answers: [], channel: respondent === 'Person' ? initialBundle.channel : 'Clinic tablet',
            respondent, recorder: respondent, assistance: 'Independent', appointmentId: null,
            bundleId: id, bundleName: name, bundleAssessmentId: `${respondent}-${index}`,
            bundleRequirement: 'Mandatory', bundleSource: 'Scheduled', scheduleAnchor: episode.start,
            bundleContext: { trigger: 'current', programStream: stream, careLevel: 'All', timing: 'date', dueDate: due },
            mvpInitialAssessment: true, mvpRespondent: respondent,
          };
        });
      });
      if (!records.length || records.some(record => episode.collections?.some(existing => existing.id === record.id))) return episode;
      changed = personChanged = true;
      return { ...episode, collections: [...(episode.collections || []), ...records] };
    });
    return personChanged ? { ...person, episodes } : person;
  });
  return changed ? { ...state, people } : state;
}

function exampleAnswers(instrument) {
  let answers = Array(instrument.questions.length).fill(null);
  for (let index = 0; index < instrument.questions.length; index += 1) {
    const progress = questionnaireState(instrument, answers);
    if (progress.complete) return progress.answers;
    for (const entry of progress.missing) answers[entry.index] = entry.question.options[0];
  }
  return questionnaireState(instrument, answers).answers;
}

function completeExample(record, person, date) {
  const instrument = INSTRUMENTS.find(item => item.version === record.version);
  const answers = exampleAnswers(instrument);
  const attemptId = `${record.id}-mvp-example-session`;
  const timestamp = `${date}T12:00:00.000Z`;
  return { ...record, answers, answerSources: Object.fromEntries(instrument.questions
    .filter((_, index) => answers[index]).map(question => [question.id, attemptId])),
    assignment: 'Fulfilled', response: 'Submitted', assessmentProgress: 'Completed',
    link: 'Ended', review: 'Reviewed', reviewDate: date, reviewActor: 'Sample fixture',
    reviewNote: 'Fictional completed assessment example.', submittedAt: date,
    submittedTimestamp: timestamp, submittedAttemptId: attemptId,
    respondentName: person.name, recorderName: person.name,
    attempts: [...(record.attempts || []).map(attempt => attempt.endedAt ? attempt
      : { ...attempt, endedAt: timestamp, status: 'Collection method changed' }),
      { id: attemptId, date, channel: record.channel, status: 'Response submitted',
        respondentName: person.name, recorderName: person.name, endedAt: timestamp }],
    mvpDemoExample: true };
}

function ensureFictionalExamples(state, today) {
  const person = state.people.find(item => item.id === 'YS-1034' && item.fixtureLabel === 'Fictional full-report example');
  const episode = person?.episodes.find(item => item.id === 'EP-1034-01' && item.status === 'Active');
  if (!episode || episode.mvpDemoExamplesRevision === 5) return state;
  const next = structuredClone(state);
  const examplePerson = next.people.find(item => item.id === person.id);
  if (!examplePerson.family) examplePerson.family = 'Alex Ellis';
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
  const instanceId = `MVP-DEMO-USER-COMPLETED-${episode.id}`;
  if (!exampleEpisode.collections.some(record => record.bundleInstanceId === instanceId)) {
    const date = addDays(today, -7);
    const version = MVP_STREAM_QUESTIONNAIRES.General.version;
    const name = 'Event follow-up assessment';
    const template = mvpBlankAssessmentTemplate(exampleEpisode, date, [version]);
    const record = {
      id: `${instanceId}-0`, label: `General stream check-in · ${name}`, version,
      due: date, createdAt: `${date}T09:00:00.000Z`, assignment: 'Planned',
      response: 'Not started', review: 'Pending', link: 'Not sent', scheduleFree: true,
      attempts: [], answers: [], channel: 'Clinic tablet', respondent: 'Person',
      recorder: 'Person', assistance: 'Independent', appointmentId: null,
      scheduleRuleId: template.id, bundleId: template.id, bundleName: name,
      bundleContext: { trigger: 'current', programStream: template.programStream,
        careLevel: 'All', timing: 'date', dueDate: date },
      bundleAssessmentId: 'blank-0', bundleRequirement: 'Mandatory',
      bundleSource: 'Manual', bundleInstanceId: instanceId, mvpCreatedAssessment: true,
    };
    exampleEpisode.collections.push(completeExample(record, examplePerson, date));
    exampleEpisode.assessmentBundleInstances = [...(exampleEpisode.assessmentBundleInstances || []), {
      id: instanceId, bundleId: template.id, name, customName: true,
      context: record.bundleContext, createdAt: record.createdAt, collectionIds: [record.id],
      excludedOptionalIds: [],
    }];
  }
  if (!exampleEpisode.collections.some(record => record.mvpCreatedAssessment &&
      record.bundleName === 'One-off event assessment')) {
    const activeId = `MVP-DEMO-USER-ACTIVE-${episode.id}`;
    const version = MVP_STREAM_QUESTIONNAIRES.General.version;
    const name = 'One-off event assessment';
    const template = mvpBlankAssessmentTemplate(exampleEpisode, today, [version]);
    const record = {
      id: `${activeId}-0`, label: `General stream check-in · ${name}`, version,
      due: today, createdAt: `${today}T09:00:00.000Z`, assignment: 'Planned',
      response: 'Not started', review: 'Pending', link: 'Not sent', scheduleFree: true,
      attempts: [], answers: [], channel: 'Clinic tablet', respondent: 'Person',
      recorder: 'Person', assistance: 'Independent', appointmentId: null,
      scheduleRuleId: template.id, bundleId: template.id, bundleName: name,
      bundleContext: { trigger: 'current', programStream: template.programStream,
        careLevel: 'All', timing: 'date', dueDate: today },
      bundleAssessmentId: 'blank-0', bundleRequirement: 'Mandatory',
      bundleSource: 'Manual', bundleInstanceId: activeId, mvpCreatedAssessment: true,
    };
    exampleEpisode.collections.push(record);
    exampleEpisode.assessmentBundleInstances = [...(exampleEpisode.assessmentBundleInstances || []), {
      id: activeId, bundleId: template.id, name, customName: true,
      context: record.bundleContext, createdAt: record.createdAt, collectionIds: [record.id],
      excludedOptionalIds: [],
    }];
  }
  exampleEpisode.mvpDemoExamplesRevision = 5;
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

export function reconcileMvpAssessmentPathway(state, today) {
  if (!mvpPathwayEnabled(state.settings)) return state;
  state = ensureInitialAssessments(state);
  let changed = false;
  const people = state.people.map(person => {
    if (person.archivedAt || person.readOnly) return person;
    let personChanged = false;
    const episodes = person.episodes.map(episode => {
      if (episode.status !== 'Active' || episode.readOnly) return episode;
      const period = carePeriodAt(episode, today);
      const stream = period?.programStream || episode.programStream;
      if (!MVP_STREAM_QUESTIONNAIRES[stream]) return episode;
      const records = [], events = [];
      const configuredBundles = mvpReviewBundles(state.settings);
      for (const bundle of configuredBundles) {
        if (!bundle.enabled || !reviewBundleMatches(bundle, person, period, stream, today) ||
            mvpReviewBundleError(bundle, state.settings)) continue;
        const role = MVP_REVIEW_BUNDLES.find(item => item.id === bundle.id).respondent;
        const existing = (episode.collections || []).filter(record => record.mvpTimepointId &&
          (record.mvpBundleDefinitionId === bundle.id || !record.mvpBundleDefinitionId &&
            record.mvpRespondent === role && record.bundleContext?.programStream === bundle.programStream));
        const latestDue = existing.map(record => record.due).filter(validReviewDate).sort().at(-1);
        if (latestDue && (existing.some(record => record.due === latestDue && record.response !== 'Submitted') || !bundle.repeat)) continue;
        const synchronizedRoles = configuredBundles.filter(peer => peer.enabled && peer.id !== bundle.id &&
          peer.days === bundle.days && peer.timing === bundle.timing && peer.after === bundle.after && peer.dueDate === bundle.dueDate &&
          peer.programStream === bundle.programStream && peer.careLevel === bundle.careLevel &&
          reviewBundleMatches(peer, person, period, stream, today))
          .map(peer => MVP_REVIEW_BUNDLES.find(item => item.id === peer.id).respondent);
        if (latestDue && (episode.collections || []).some(record => record.mvpTimepointId &&
          record.due === latestDue && synchronizedRoles.includes(record.mvpRespondent) && record.response !== 'Submitted')) continue;
        const anchor = bundle.after === 'care-period' ? period?.startDate : episode.reviewAnchorDate || episode.start;
        const firstDue = bundle.timing === 'date' ? bundle.dueDate :
          bundle.after === 'intake' && episode.reviewSchedule?.confirmed && validReviewDate(episode.reviewSchedule?.outcome?.due) && bundle.days === MVP_REVIEW_DAYS
            ? episode.reviewSchedule.outcome.due : addDays(anchor, bundle.days);
        const due = latestDue ? addDays(latestDue, bundle.days) : firstDue;
        if (!validReviewDate(due)) continue;
        const timepointId = `MVP-${episode.id}-${due}`;
        const id = bundleId(episode.id, due, role);
        const items = mvpReviewItems(bundle);
        if (items.some((item, index) => episode.collections?.some(record => record.id === `${id}-${index}`))) continue;
        records.push(...items.map((item, index) => {
          const instrument = INSTRUMENTS.find(candidate => candidate.version === item.version);
          return {
            id: `${id}-${index}`, label: `${instrument.name} · ${bundle.name}`, version: item.version, due,
            createdAt: `${today}T12:00:00.000Z`, assignment: 'Planned', response: 'Not started',
            review: 'Pending', link: 'Not sent', scheduleFree: true,
            attempts: [], answers: [], channel: bundle.channel, respondent: bundle.respondent, recorder: bundle.respondent,
            assistance: bundle.channel === 'Clinician entry' ? 'Transcribed' : 'Independent', appointmentId: null,
            bundleId: id, bundleName: bundle.name, bundleAssessmentId: item.id, bundleRequirement: 'Mandatory',
            bundleSource: 'Scheduled', scheduleAnchor: anchor,
            bundleContext: { trigger: 'current', programStream: stream, careLevel: bundle.careLevel, timing: 'date', dueDate: due },
            mvpTimepointId: timepointId, mvpRespondent: role, mvpBundleDefinitionId: bundle.id,
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
