import { clientProfileRecords } from './clientProfileMeasure.js';
import { INSTRUMENTS, questionnaireState } from './instruments.js';
import { reconcileMvpAssessmentPathway } from './mvpAssessmentPathway.js';

const STAGES = new Map([
  ['YS-1024', ['Kai Thompson', 'review']],
  ['YS-1025', ['Amelia Chen', 'complete']],
  ['YS-1026', ['Noah Williams', 'profile']],
  ['YS-1027', ['Zoe Patel', 'review']],
  ['YS-1028', ['Oliver James', 'initial']],
  ['YS-1029', ['Mia Robinson', 'review']],
  ['YS-1033', ['Jordan Lee', 'initial']],
  ['YS-1034', ['Jordan Ellis', 'review']],
]);

function exampleAnswers(record, person, date) {
  const instrument = INSTRUMENTS.find(item => item.version === record.version);
  if (!instrument) return [];
  const answers = Array(instrument.questions.length).fill(null);
  for (let pass = 0; pass < instrument.questions.length; pass += 1) {
    const progress = questionnaireState(instrument, answers);
    if (progress.complete) return progress.answers;
    for (const { question, index } of progress.missing) {
      answers[index] = question.id === 'name' ? person.name : question.id === 'dob' ? person.dob
        : question.options?.[0] || question.nonResponseOptions?.[0] ||
          (question.responseType === 'date' ? date :
            question.responseType === 'number' ? String(question.min ?? 1) : 'Fictional sample response');
    }
  }
  return questionnaireState(instrument, answers).answers;
}

function submitExample(record, person, date, time = '12:00:00') {
  const attemptId = `${record.id}-sample-response`;
  const timestamp = `${date}T${time}.000Z`;
  const respondentName = record.respondent === 'Clinician' ? record.respondentName || 'Jess Taylor' : person.name;
  return { ...record, answers: exampleAnswers(record, person, date), draftAnswers: [],
    assignment: 'Fulfilled', response: 'Submitted', assessmentProgress: 'Completed',
    link: 'Ended', review: 'Reviewed', reviewDate: date, reviewActor: 'Sample fixture',
    submittedAt: date, submittedTimestamp: timestamp, submittedAttemptId: attemptId,
    respondentName, recorderName: respondentName,
    attempts: [{ id: attemptId, date, channel: record.channel, status: 'Response submitted',
      respondentName, recorderName: respondentName, endedAt: timestamp }],
    mvpDemoExample: true };
}

const untouched = record => record.response === 'Not started' && !record.attempts?.length &&
  !record.answers?.some(Boolean) && !record.draftAnswers?.some(Boolean);
const sampleResponse = record => record.submittedAttemptId === `${record.id}-sample-response`;

// Align existing active fictional people with the three measure stages. Intake
// and closed-episode examples retain their separate histories.
export function ensureSampleMvpFlow(state, today) {
  if (state.settings?.advancedAssessmentOptions !== false) return state;
  const candidates = state.people.filter(person => STAGES.get(person.id)?.[0] === person.name &&
    person.episodes.some(episode => episode.status === 'Active') && person.mvpFlowFixtureRevision !== 4);
  if (!candidates.length) return state;
  let next = structuredClone(state);
  for (const person of next.people.filter(item => candidates.some(candidate => candidate.id === item.id))) {
    const stage = STAGES.get(person.id)[1];
    person.mvpProfile = true;
    person.clientProfileRequired = true;
    delete person.mvpYoungPersonOnly;
    person.mvpInitialYoungPersonOnly = true;
    const episode = person.episodes.find(item => item.status === 'Active');
    const profileDate = episode.start;
    episode.collections = episode.collections.filter(record =>
      !((record.mvpInitialAssessment && record.mvpRespondent !== 'Person' ||
        record.mvpTimepointId && record.mvpRespondent === 'Family respondent') &&
        (untouched(record) || record.mvpDemoExample) && !record.revision));
    if (!episode.collections.some(record => record.clientProfileMeasure))
      episode.collections.push(...clientProfileRecords(person, episode, profileDate)
        .map(record => stage === 'profile' ? record : submitExample(record, person, profileDate, '09:00:00')));
    else if (stage !== 'profile')
      episode.collections = episode.collections.map(record => record.clientProfileMeasure && sampleResponse(record)
        ? submitExample(record, person, profileDate, '09:00:00') : record);
    if (stage === 'profile') {
      episode.collections = episode.collections.filter(record =>
        !((record.mvpInitialAssessment || record.mvpTimepointId) && untouched(record)));
    }
  }
  next = reconcileMvpAssessmentPathway(next, today);
  for (const person of next.people.filter(item => candidates.some(candidate => candidate.id === item.id))) {
    const stage = STAGES.get(person.id)[1];
    const episode = person.episodes.find(item => item.status === 'Active');
    if (stage === 'review' || stage === 'complete') {
      const initialDate = episode.collections.find(record => record.label === 'Initial assessment' &&
        record.response === 'Submitted')?.submittedAt?.slice(0, 10) ||
        (person.id === 'YS-1034' ? '2026-06-16' : episode.start);
      episode.collections = episode.collections.map(record =>
        record.mvpInitialAssessment && (untouched(record) || sampleResponse(record))
          ? submitExample(record, person, initialDate) : record);
    }
    person.mvpFlowFixtureRevision = 4;
  }
  return reconcileMvpAssessmentPathway(next, today);
}
