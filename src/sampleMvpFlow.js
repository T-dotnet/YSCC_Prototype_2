import { clientProfileRecords } from './clientProfileMeasure.js';
import { CLINICIAN_INITIAL_INSTRUMENT, INSTRUMENTS, questionnaireState } from './instruments.js';
import { reconcileMvpAssessmentPathway } from './mvpAssessmentPathway.js';
import { ASSESSMENT_OUTCOME_OPTIONS, assessmentOutcomeRecord } from './assessmentOutcome.js';

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

const retiredIntakeExamples = new Map([
  ['YS-1031', ['River Morgan', 'IN-YS-1031', 'In progress', 'Agree a safe contact route with River and record the intake outcome']],
  ['YS-1032', ['Samira Khan', 'IN-YS-1032', 'Completed', 'Choose a due date and create the initial assessment plan']],
]);

function untouchedLegacyIntakeExample(person, state) {
  const expected = retiredIntakeExamples.get(person.id);
  const intake = person.intakes?.[0];
  return expected && person.name === expected[0] && !person.episodes?.length &&
    person.intakes?.length === 1 && intake?.id === expected[1] &&
    intake.status === expected[2] && intake.nextAction === expected[3] &&
    intake.createdBy === 'Sample fixture' && (intake.revision ?? 0) === 0 &&
    !person.intakeResetToken &&
    !state.audit?.some(entry => entry.personId === person.id) &&
    !state.issues?.some(issue => issue.personId === person.id);
}

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

function ensureJordanLeeClinicianExample(state) {
  const jordan = state.people.find(person => person.id === 'YS-1033' && person.name === 'Jordan Lee');
  const episode = jordan?.episodes.find(item => item.id === 'EP-YS-1033-01' && item.status === 'Active');
  if (!episode || !jordan.mvpProfile || jordan.clinicianInitialFixtureRevision === 2) return state;
  const next = structuredClone(state);
  const person = next.people.find(item => item.id === jordan.id);
  const current = person.episodes.find(item => item.id === episode.id);
  const youngInitial = current.collections.find(record => record.mvpInitialAssessment && record.mvpRespondent === 'Person');
  const clinicianId = 'MVP-INITIAL-EP-YS-1033-01-clinician-0';
  if (youngInitial && !current.collections.some(record => record.id === clinicianId)) {
    const due = youngInitial.due;
    const bundleId = 'MVP-INITIAL-EP-YS-1033-01-clinician';
    current.collections.push({
      id: clinicianId, label: `${CLINICIAN_INITIAL_INSTRUMENT.name} · Initial assessment · Clinician · Personality`,
      version: CLINICIAN_INITIAL_INSTRUMENT.version, due,
      createdAt: '2026-09-10T12:00:00.000Z', assignment: 'Planned', response: 'Not started',
      review: 'Pending', link: 'Not sent', scheduleFree: true, attempts: [], answers: [],
      channel: 'Clinician entry', respondent: 'Clinician', recorder: 'Clinician', assistance: 'Independent',
      appointmentId: null, bundleId, surveyId: bundleId,
      bundleName: 'Initial assessment · Clinician · Personality', bundleAssessmentId: 'Clinician-0',
      bundleRequirement: 'Mandatory', bundleSource: 'Scheduled', scheduleAnchor: current.start,
      bundleContext: { trigger: 'current', programStream: 'Personality', careLevel: 'All',
        timing: 'date', dueDate: due, statusChange: '' },
      mvpInitialAssessment: true, mvpRespondent: 'Clinician',
    });
  }
  current.appointments ??= [];
  const contacts = [
    { id: 'APT-YS-1033-welcome-call', appointmentType: 'Care coordination', contactName: 'Welcome call',
      contactType: 'Other direct contact', recipientTypes: ['Young person'], primaryPractitioner: 'Jess Taylor', plannedDate: '2026-09-11',
      plannedTime: '10:30', plannedDurationMinutes: 20, practitionerService: 'Jess Taylor · Northside Centre',
      location: 'Northside Centre', deliveryMode: 'Phone', attendance: 'Attended',
      actualDate: '2026-09-11', actualTime: '10:35', actualDurationMinutes: 18,
      notes: 'Fictional welcome call to confirm the assessment plan and preferred contact route.',
      outcomeNotes: 'Jordan confirmed the assessment appointment and preferred SMS reminders.',
      outcomeRecordedAt: '2026-09-11T11:00:00Z', outcomeRecordedBy: 'Jess Taylor',
      timestamp: '2026-09-10T10:00:00Z', actor: 'Sample fixture', role: 'Clinician' },
    { id: 'APT-YS-1033-planning-contact', appointmentType: 'Care coordination', contactName: 'Assessment planning',
      contactType: 'Assessment', recipientTypes: ['Young person'], primaryPractitioner: 'Jess Taylor', plannedDate: '2026-09-18',
      plannedTime: '15:00', plannedDurationMinutes: 30, practitionerService: 'Jess Taylor · Northside Centre',
      location: 'Northside Centre', deliveryMode: 'Video', attendance: 'Attended',
      actualDate: '2026-09-18', actualTime: '15:00', actualDurationMinutes: 28,
      notes: 'Fictional planning contact before the initial assessment.',
      outcomeNotes: 'Reviewed practical questions and agreed to continue with the scheduled assessment.',
      outcomeRecordedAt: '2026-09-18T15:45:00Z', outcomeRecordedBy: 'Jess Taylor',
      timestamp: '2026-09-15T09:00:00Z', actor: 'Sample fixture', role: 'Clinician' },
    { id: 'APT-YS-1033-follow-up', appointmentType: 'Follow-up', contactName: 'Post-assessment follow-up',
      contactType: 'Care review', recipientTypes: ['Young person'], primaryPractitioner: 'Jess Taylor', plannedDate: '2026-10-08',
      plannedTime: '11:00', plannedDurationMinutes: 30, practitionerService: 'Jess Taylor · Northside Centre',
      location: 'Northside Centre', deliveryMode: 'Phone', attendance: 'Planned',
      notes: 'Fictional follow-up to discuss next steps after initial assessment.',
      timestamp: '2026-09-22T12:00:00Z', actor: 'Sample fixture', role: 'Clinician' },
  ];
  for (const contact of contacts) {
    const existing = current.appointments.find(item => item.id === contact.id);
    if (!existing) current.appointments.push(contact);
    else if (existing.actor === 'Sample fixture') {
      existing.contactName ||= contact.contactName;
      existing.contactType ||= contact.contactType;
      existing.recipientTypes ||= contact.recipientTypes;
      existing.primaryPractitioner ||= contact.primaryPractitioner;
    }
  }
  person.clinicianInitialFixtureRevision = 2;
  return next;
}

// Align existing active fictional people with the three measure stages. Intake
// and closed-episode examples retain their separate histories.
export function ensureSampleMvpFlow(state, today) {
  if (state.settings?.advancedAssessmentOptions !== false) return state;
  // The two intake-only examples belong to the older workflow. Retire only
  // untouched fixtures so locally edited records are preserved.
  if (state.people.some(person => untouchedLegacyIntakeExample(person, state)))
    state = { ...state, people: state.people.filter(person => !untouchedLegacyIntakeExample(person, state)) };
  const candidates = state.people.filter(person => STAGES.get(person.id)?.[0] === person.name &&
    person.episodes.some(episode => episode.status === 'Active') &&
    (person.mvpFlowFixtureRevision !== 4 || person.mvpOutcomeScenarioRevision !== 4));
  if (!candidates.length) return ensureJordanLeeClinicianExample(state);
  let next = structuredClone(state);
  for (const person of next.people.filter(item => candidates.some(candidate => candidate.id === item.id))) {
    const stage = STAGES.get(person.id)[1];
    person.mvpProfile = true;
    person.clientProfileRequired = true;
    delete person.mvpYoungPersonOnly;
    person.mvpInitialYoungPersonOnly = true;
    const episode = person.episodes.find(item => item.status === 'Active');
    if (person.id === 'YS-1028') {
      delete episode.assessmentOutcome;
      episode.collections = episode.collections.map(record => record.mvpInitialAssessment && record.mvpRespondent === 'Person'
        ? { ...record, bundleContext: { ...record.bundleContext, statusChange: 'Ongoing review' } }
        : record);
    }
    if (stage === 'review' || stage === 'complete') {
      const recorded = assessmentOutcomeRecord(episode);
      episode.assessmentOutcome ??= {
        value: recorded?.response === 'Submitted' && ASSESSMENT_OUTCOME_OPTIONS.includes(recorded.answers?.[0])
          ? recorded.answers[0] : ASSESSMENT_OUTCOME_OPTIONS[0],
        variable: 'assessment_outcome', recordedAt: `${episode.start}T12:00:00.000Z`,
        recordedBy: 'Sample fixture', recordedById: null,
      };
    }
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
    if (stage === 'review' || stage === 'complete' || person.id === 'YS-1028') {
      const initialDate = episode.collections.find(record => record.label === 'Initial assessment' &&
        record.response === 'Submitted')?.submittedAt?.slice(0, 10) ||
        (person.id === 'YS-1034' ? '2026-06-16' : episode.start);
      episode.collections = episode.collections.map(record =>
        record.mvpInitialAssessment && (untouched(record) || sampleResponse(record))
          ? submitExample(record, person, initialDate) : record);
    }
    person.mvpFlowFixtureRevision = 4;
    person.mvpOutcomeScenarioRevision = 4;
  }
  return ensureJordanLeeClinicianExample(reconcileMvpAssessmentPathway(next, today));
}
