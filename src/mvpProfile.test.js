import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultWorkspace, createSeed, reducer, TODAY, upgradeSampleData } from "./model.js";
import { canAssess, intakeTasks } from "./intake.js";
import { episodeDisplayStatus, peopleForList } from "./people.js";
import { ageAtCommencement, derivedEpisodeStatus, derivedEpisodeStream } from "./batch1Registration.js";
import { mvpInitialBundles, reconcileMvpAssessmentPathway } from "./mvpAssessmentPathway.js";
import { addDays } from "./episodeReviews.js";
import { CLIENT_PROFILE_INSTRUMENTS } from "./clientProfileMeasure.js";
import { personStatus, peopleBundleSummary } from "./people.js";
import { getInstrument, questionnaireState } from "./instruments.js";
import { EP_BATCH_2_INSTRUMENTS } from "./epCodebookInstruments.js";
import { ensureSampleMvpFlow } from "./sampleMvpFlow.js";

test("fictional measure flow keeps each status beside its current measure", () => {
  const workspace = createDefaultWorkspace();
  const stages = [
    ["YS-1024", "Ongoing review", "90-day review · Young person"],
    ["YS-1025", "Ongoing review", "Initial assessment · Young person"],
    ["YS-1026", "Profiling", "Client profile"],
    ["YS-1027", "Ongoing review", "90-day review · Young person"],
    ["YS-1028", "Assessment", "Initial assessment · Young person"],
    ["YS-1029", "Ongoing review", "90-day review · Young person"],
    ["YS-1033", "Assessment", "Initial assessment · Young person"],
    ["YS-1034", "Ongoing review", "90-day review · Young person"],
  ];
  for (const [id, status, measure] of stages) {
    const person = workspace.people.find(item => item.id === id);
    const episode = person.episodes.find(item => item.status === "Active");
    const row = personStatus(person, episode);
    const summary = peopleBundleSummary({ ...row, person, episode }, workspace.settings);
    assert.equal(derivedEpisodeStatus({}, episode), status);
    assert.ok(summary.label.startsWith(measure), id);
    assert.equal(episode.collections.filter(item => item.clientProfileMeasure && item.response === "Submitted").length,
      status === "Profiling" ? 0 : CLIENT_PROFILE_INSTRUMENTS.length);
    assert.equal(episode.collections.some(item => item.mvpInitialAssessment), status !== "Profiling");
    const hasReview = episode.collections.some(item => item.mvpTimepointId);
    assert.equal(hasReview, measure.startsWith("90-day review"));
    assert.ok(episode.collections.every(item =>
      !item.mvpInitialAssessment || item.mvpRespondent === "Person" ||
      id === 'YS-1033' && item.mvpRespondent === 'Clinician'), id);
    const reviewRoles = new Set(episode.collections.filter(item => item.mvpTimepointId)
      .map(item => item.mvpRespondent));
    assert.deepEqual([...reviewRoles].sort(), hasReview ? ["Clinician", "Person"] : []);
    for (const record of episode.collections.filter(item => item.mvpDemoExample))
      assert.equal(questionnaireState(getInstrument(record.version), record.answers).complete, true, record.id);
  }
  assert.equal(workspace.people.some(person => person.id.startsWith("YS-DEMO-PROFILE") ||
    person.id.startsWith("YS-DEMO-INITIAL") || person.id.startsWith("YS-DEMO-REVIEW")), false);
  assert.equal(workspace.people.some(person => person.id === "YS-1031" || person.id === "YS-1032"), false);
});

test('Jordan Lee includes a clinician initial assessment and fictional contacts', () => {
  const workspace = createDefaultWorkspace();
  const jordan = workspace.people.find(person => person.id === 'YS-1033');
  const episode = jordan.episodes.find(item => item.id === 'EP-YS-1033-01');
  const clinician = episode.collections.find(record => record.mvpInitialAssessment && record.mvpRespondent === 'Clinician');
  assert.equal(clinician?.version, 'Clinician initial assessment v1.0');
  assert.equal(clinician?.channel, 'Clinician entry');
  assert.deepEqual(episode.appointments.filter(item => item.id.startsWith('APT-YS-1033-')).map(item => item.id).sort(),
    ['APT-YS-1033-follow-up', 'APT-YS-1033-initial', 'APT-YS-1033-planning-contact', 'APT-YS-1033-welcome-call']);
  assert.equal(ensureSampleMvpFlow(workspace, TODAY), workspace);
});

test("MVP removes only untouched intake examples from saved fictional data", () => {
  const saved = createSeed();
  saved.settings.advancedAssessmentOptions = false;
  saved.people.find(person => person.id === "YS-1032").intakes[0].nextAction = "Edited locally";
  const migrated = ensureSampleMvpFlow(saved, TODAY);
  assert.equal(migrated.people.some(person => person.id === "YS-1031"), false);
  assert.equal(migrated.people.find(person => person.id === "YS-1032")?.intakes[0].nextAction, "Edited locally");
});

test("saved workspaces retire obsolete demo and scratch people without removing renamed records", () => {
  const saved = createDefaultWorkspace();
  const example = saved.people[0];
  saved.people.push({ ...structuredClone(example), id: "YS-DEMO-REVIEW", name: "Riley Chen" });
  saved.people.push({ ...structuredClone(example), id: "YS-1035", name: "test" });
  saved.people.push({ ...structuredClone(example), id: "YS-1036", name: "11" });
  saved.people.push({ ...structuredClone(example), id: "YS-DEMO-INITIAL", name: "Renamed person" });
  const upgraded = upgradeSampleData(saved);
  assert.equal(upgraded.people.some((person) => person.id === "YS-DEMO-REVIEW"), false);
  assert.equal(upgraded.people.some((person) => person.id === "YS-1035" || person.id === "YS-1036"), false);
  assert.equal(upgraded.people.some((person) => person.id === "YS-DEMO-INITIAL"), true);
});

test("saved fictional profiles drop old family and clinician initial measures without adding people", () => {
  const original = createDefaultWorkspace();
  const saved = structuredClone(original);
  const jordan = saved.people.find(person => person.id === "YS-1034");
  jordan.mvpFlowFixtureRevision = 2;
  jordan.episodes[0].collections.push({ id: "old-family-review", mvpTimepointId: "old-timepoint",
    mvpRespondent: "Family respondent", response: "Not started", attempts: [], answers: [] });
  jordan.episodes[0].collections.push({ id: "old-clinician-initial", mvpInitialAssessment: true,
    mvpRespondent: "Clinician", response: "Not started", attempts: [], answers: [] });
  const upgraded = ensureSampleMvpFlow(saved, TODAY);
  const episode = upgraded.people.find(person => person.id === "YS-1034").episodes[0];
  assert.equal(upgraded.people.length, original.people.length);
  assert.equal(episode.collections.some(record => record.id === "old-family-review" ||
    record.id === "old-clinician-initial"), false);
  assert.ok(episode.collections.some(record => record.mvpTimepointId && record.mvpRespondent === "Clinician"));
  assert.equal(ensureSampleMvpFlow(upgraded, TODAY), upgraded);
});

test("Client profile can be edited, deleted, and added again for future profiles", () => {
  const original = createDefaultWorkspace();
  const edited = reducer(original, { type: 'SAVE_CLIENT_PROFILE_BUNDLE', bundle: {
    id: 'MVP-CLIENT-PROFILE', name: 'Registration profile', channel: 'Clinician entry',
    respondent: 'Person', enabled: true,
    instrumentVersions: CLIENT_PROFILE_INSTRUMENTS.slice(0, 2).map(item => item.version),
  } });
  assert.equal(edited.settings.clientProfileBundle.name, 'Registration profile');
  let state = reducer(edited, { type: 'ADD_PERSON', mvpProfile: true, requestId: 'edited-profile',
    name: 'Edited Profile Example', dob: '2008-04-12', owner: 'Jess Taylor',
    nextAction: 'Complete Client profile', reviewDate: TODAY });
  const first = state.people.find(item => item.registrationRequestId === 'edited-profile').episodes[0];
  assert.equal(first.collections.filter(record => record.clientProfileMeasure).length, 2);
  assert.ok(first.collections.filter(record => record.clientProfileMeasure)
    .every(record => record.bundleName === 'Registration profile' && record.channel === 'Clinician entry'));
  state = reducer(state, { type: 'DELETE_CLIENT_PROFILE_BUNDLE' });
  assert.equal(state.settings.clientProfileBundle, null);
  state = reducer(state, { type: 'ADD_PERSON', mvpProfile: true, requestId: 'deleted-profile',
    name: 'Deleted Profile Example', dob: '2008-04-12', owner: 'Jess Taylor',
    nextAction: 'Begin initial assessment', reviewDate: TODAY });
  assert.equal(state.people.find(item => item.registrationRequestId === 'deleted-profile').episodes[0]
    .collections.some(record => record.clientProfileMeasure), false);
  assert.equal(state.people.find(item => item.registrationRequestId === 'deleted-profile').episodes[0]
    .collections.some(record => record.mvpInitialAssessment), true);
  assert.equal(first.collections.filter(record => record.clientProfileMeasure).length, 2);
  state = reducer(state, { type: 'SAVE_CLIENT_PROFILE_BUNDLE', bundle: {
    id: 'MVP-CLIENT-PROFILE', name: 'Client profile', channel: 'Clinic tablet', respondent: 'Person',
    enabled: true, instrumentVersions: CLIENT_PROFILE_INSTRUMENTS.map(item => item.version),
  } });
  assert.equal(state.settings.clientProfileBundle.name, 'Client profile');
  assert.equal(state.people.find(item => item.registrationRequestId === 'deleted-profile').episodes[0]
    .collections.some(record => record.clientProfileMeasure), false);
});

test("new-profile Measures view setting switches between collection workspace and ledger", () => {
  const initial = createDefaultWorkspace();
  assert.equal(initial.settings.mvpNewProfileCollectWorkspace, true);
  const ledger = reducer(initial, { type: "SET_MVP_NEW_PROFILE_COLLECT_WORKSPACE", enabled: false });
  assert.equal(ledger.settings.mvpNewProfileCollectWorkspace, false);
  const collection = reducer(ledger, { type: "SET_MVP_NEW_PROFILE_COLLECT_WORKSPACE", enabled: true });
  assert.equal(collection.settings.mvpNewProfileCollectWorkspace, true);
  assert.equal(reducer(collection, { type: "SET_MVP_NEW_PROFILE_COLLECT_WORKSPACE", enabled: "yes" }), collection);
});

test("MVP Profile tab setting switches between tab and header details", () => {
  const initial = createDefaultWorkspace();
  assert.equal(initial.settings.mvpProfileTab, true);
  const headerDetails = reducer(initial, { type: "SET_MVP_PROFILE_TAB", enabled: false });
  assert.equal(headerDetails.settings.mvpProfileTab, false);
  const profileTab = reducer(headerDetails, { type: "SET_MVP_PROFILE_TAB", enabled: true });
  assert.equal(profileTab.settings.mvpProfileTab, true);
  assert.equal(reducer(profileTab, { type: "SET_MVP_PROFILE_TAB", enabled: "yes" }), profileTab);
});

test("MVP registration starts with the four Client profile instruments", () => {
  const requestId = "new-mvp-profile";
  const state = reducer(createDefaultWorkspace(), {
    type: "ADD_PERSON", mvpProfile: true, requestId,
    name: "MVP Profile Example", dob: "2008-04-12", owner: "Jess Taylor",
    nextAction: "Begin initial assessment", reviewDate: TODAY,
  });
  const person = state.people.find(item => item.registrationRequestId === requestId);
  const episode = person.episodes[0];
  assert.equal(person.mvpProfile, true);
  assert.equal(person.intakes.length, 0);
  assert.equal(episode.programStream, "General");
  assert.equal(canAssess(person, episode), true);
  assert.deepEqual(episode.collections.map(record => record.version),
    CLIENT_PROFILE_INSTRUMENTS.map(instrument => instrument.version));
  assert.ok(episode.collections.every(record => record.clientProfileMeasure && record.bundleName === "Client profile"));
  assert.equal(episode.collections.some(record => record.mvpInitialAssessment), false);
  assert.equal(episode.collections.some(record => record.mvpTimepointId), false);
  assert.equal(intakeTasks({ people: [person] }, TODAY).length, 0);
  assert.equal(peopleForList([person], "Intake").length, 0);
  assert.equal(peopleForList([person], "Active").length, 1);
});

test("MVP profile reviews appear 90 days after initial completion, and premature untouched reviews are removed", () => {
  const state = reducer(createDefaultWorkspace(), {
    type: "ADD_PERSON", mvpProfile: true, requestId: "review-timing",
    name: "Profile Review Timing", dob: "2008-04-12", owner: "Jess Taylor",
    nextAction: "Begin initial assessment", reviewDate: TODAY,
  });
  const person = state.people.find(item => item.registrationRequestId === "review-timing");
  const prematureDate = addDays(TODAY, 90);
  const reviewId = `MVP-${person.episodes[0].id}-${prematureDate}`;
  const premature = structuredClone(state);
  const episode = premature.people.find(item => item.id === person.id).episodes[0];
  episode.collections.push({ id: "premature-review", mvpTimepointId: reviewId,
    due: prematureDate, response: "Not started", attempts: [], answers: [] });
  episode.events.push({ id: "premature-event", actionType: "SCHEDULE_MVP_REVIEW", timepointId: reviewId });
  const cleaned = reconcileMvpAssessmentPathway(premature, TODAY);
  const cleanedEpisode = cleaned.people.find(item => item.id === person.id).episodes[0];
  assert.equal(cleanedEpisode.collections.some(record => record.id === "premature-review"), false);
  assert.equal(cleanedEpisode.events.some(event => event.id === "premature-event"), false);
  const profileCompleted = structuredClone(cleaned);
  profileCompleted.people.find(item => item.id === person.id).episodes[0].collections
    .filter(record => record.clientProfileMeasure)
    .forEach(record => { record.response = "Submitted"; record.submittedAt = TODAY; });
  const withInitial = reconcileMvpAssessmentPathway(profileCompleted, TODAY);
  assert.ok(withInitial.people.find(item => item.id === person.id).episodes[0].collections
    .some(record => record.mvpInitialAssessment));
  const completionDate = addDays(TODAY, 5);
  const partlyCompleted = structuredClone(withInitial);
  const firstInitial = partlyCompleted.people.find(item => item.id === person.id).episodes[0].collections
    .find(record => record.mvpInitialAssessment && record.mvpRespondent === "Person");
  firstInitial.response = "Submitted";
  firstInitial.submittedAt = completionDate;
  assert.equal(reconcileMvpAssessmentPathway(partlyCompleted, addDays(completionDate, 90))
    .people.find(item => item.id === person.id).episodes[0].collections
    .some(record => record.mvpTimepointId), false);
  const completed = structuredClone(withInitial);
  completed.people.find(item => item.id === person.id).episodes[0].collections
    .filter(record => record.mvpInitialAssessment && record.mvpRespondent === "Person")
    .forEach(record => { record.response = "Submitted"; record.submittedAt = completionDate; });
  const afterCompletion = reconcileMvpAssessmentPathway(completed, completionDate);
  assert.equal(afterCompletion.people.find(item => item.id === person.id).episodes[0].collections
    .some(record => record.mvpTimepointId), false);
  const reviewDate = addDays(completionDate, 90);
  const beforeReview = reconcileMvpAssessmentPathway(afterCompletion, addDays(completionDate, 89));
  assert.equal(beforeReview.people.find(item => item.id === person.id).episodes[0].collections
    .some(record => record.mvpTimepointId), false);
  const atReview = reconcileMvpAssessmentPathway(beforeReview, reviewDate);
  assert.ok(atReview.people.find(item => item.id === person.id).episodes[0].collections
    .some(record => record.mvpTimepointId && record.due === reviewDate));
});

test("Specific measure schedule can wait for overdue or start from the care episode", () => {
  const make = requestId => reducer(createDefaultWorkspace(), {
    type: "ADD_PERSON", mvpProfile: true, requestId,
    name: `Trigger ${requestId}`, dob: "2008-04-12", owner: "Jess Taylor",
    nextAction: "Complete Client profile", reviewDate: TODAY,
  });
  const overdue = make("overdue");
  const initial = mvpInitialBundles(overdue.settings).find(bundle => bundle.programStream === "General");
  const overdueConfigured = reducer(overdue, { type: "SAVE_MVP_INITIAL_BUNDLE",
    bundle: { ...initial, triggerMeasureStatus: "overdue" } });
  const overduePerson = overdueConfigured.people.find(item => item.registrationRequestId === "overdue");
  assert.equal(overduePerson.episodes[0].collections.some(record => record.mvpInitialAssessment), false);
  const afterDue = reconcileMvpAssessmentPathway(overdueConfigured, addDays(TODAY, 1));
  assert.ok(afterDue.people.find(item => item.id === overduePerson.id).episodes[0].collections
    .some(record => record.mvpInitialAssessment));
  const noPrerequisite = make("no-prerequisite");
  const configured = reducer(noPrerequisite, { type: "SAVE_MVP_INITIAL_BUNDLE",
    bundle: { ...mvpInitialBundles(noPrerequisite.settings).find(bundle => bundle.programStream === "General"),
      after: "care-period" } });
  assert.ok(configured.people.find(item => item.registrationRequestId === "no-prerequisite").episodes[0].collections
    .some(record => record.mvpInitialAssessment));
});

test("submitting all Client profile headings updates the profile and prepares the initial assessment", () => {
  let state = reducer(createDefaultWorkspace(), {
    type: "ADD_PERSON", mvpProfile: true, requestId: "profile-submission",
    name: "Profile Submission Example", dob: "2008-04-12", owner: "Jess Taylor",
    nextAction: "Complete Client profile", reviewDate: TODAY,
  });
  const personId = state.people.find(item => item.registrationRequestId === "profile-submission").id;
  const episodeId = state.people.find(item => item.id === personId).episodes[0].id;
  for (const instrument of CLIENT_PROFILE_INSTRUMENTS) {
    const record = state.people.find(item => item.id === personId).episodes[0].collections
      .find(item => item.version === instrument.version);
    const context = { personId, episodeId, collectionId: record.id };
    state = reducer(state, { ...context, type: "DELIVER", channel: "Clinic tablet",
      respondent: "Person", assistance: "Independent" });
    const delivered = state.people.find(item => item.id === personId).episodes[0].collections
      .find(item => item.id === record.id);
    assert.equal(delivered.assignment, "Active");
    const answers = instrument.questions.map(question =>
      question.id === "name" ? "Profile Submission Example" :
        question.id === "dob" ? "2008-04-12" :
          question.id === "clientPostcode" ? "3000" :
            question.id === "clientGender" ? "Non-binary" :
              question.id === "reviewed" ? "Reviewed" : "Not recorded");
    state = reducer(state, { ...context, type: "SUBMIT", answers,
      channel: delivered.channel, attemptId: delivered.attempts.at(-1).id });
    assert.equal(state.people.find(item => item.id === personId).episodes[0].collections
      .find(item => item.id === record.id).response, "Submitted");
  }
  const person = state.people.find(item => item.id === personId);
  assert.equal(person.clientPostcode, "3000");
  assert.equal(person.clientGender, "Non-binary");
  assert.ok(person.episodes[0].collections.some(item => item.mvpInitialAssessment));
});

test("MVP Profile saves registration fields without reopening intake", () => {
  const state = reducer(createDefaultWorkspace(), {
    type: "ADD_PERSON", mvpProfile: true, requestId: "profile-edit",
    name: "Profile Edit Example", dob: "2008-04-12", owner: "Jess Taylor",
    nextAction: "Begin initial assessment", reviewDate: TODAY,
  });
  const person = state.people.find(item => item.registrationRequestId === "profile-edit");
  assert.equal(derivedEpisodeStatus({ status: "Completed" }, person.episodes[0]), "Profiling");
  const updated = reducer(state, { type: "UPDATE_PROFILE", personId: person.id,
    episodeId: person.episodes[0].id,
    values: { name: "Profile Edit Example", dob: "2008-04-12",
      clientPostcode: "3000", clientGender: "Non-binary", source: "Self-referred",
      registeredCentreName: "Northside Centre", registeredCentreState: "Victoria",
      registeredCentrePostcode: "3000", referralDate: TODAY,
      commencementDate: TODAY, commencementDateUhr: TODAY } });
  const saved = updated.people.find(item => item.id === person.id);
  assert.equal(saved.clientPostcode, "3000");
  assert.equal(saved.clientGender, "Non-binary");
  const youngPersonInstrument = CLIENT_PROFILE_INSTRUMENTS[0];
  const youngPersonRecord = saved.episodes[0].collections.find(item => item.version === youngPersonInstrument.version);
  assert.equal(youngPersonRecord.draftAnswers[youngPersonInstrument.questions.findIndex(question => question.id === "clientPostcode")], "3000");
  const details = saved.episodes[0].profileDetails;
  assert.equal(details.source, "Self-referred");
  assert.equal(details.registeredCentreName, "Northside Centre");
  assert.equal(details.registeredCentreState, "Victoria");
  assert.equal(details.registeredCentrePostcode, "3000");
  assert.equal(details.commencementDate, TODAY);
  assert.equal(ageAtCommencement(saved.dob, details.commencementDate),
    new Date(TODAY).getUTCFullYear() - 2008 - (TODAY.slice(5) < "04-12" ? 1 : 0));
  assert.equal(derivedEpisodeStream(details, saved.episodes[0]), "UHR");
  assert.equal(derivedEpisodeStatus(details, saved.episodes[0]), "Profiling");
  assert.equal(saved.intakes.length, 0);
  assert.equal(reducer(updated, { type: "UPDATE_PROFILE", personId: person.id, episodeId: person.episodes[0].id,
    values: { name: "Profile Edit Example", dob: "2008-04-12", clientPostcode: "bad" } }), updated);
  assert.equal(reducer(updated, { type: "UPDATE_PROFILE", personId: person.id, episodeId: person.episodes[0].id,
    values: { name: "Profile Edit Example", dob: "2008-04-12", registeredCentrePostcode: "bad" } }), updated);
});

test("Client profile is created even when the initial assessment pathway is off", () => {
  const initial = reducer(createDefaultWorkspace(), { type: "SET_MVP_ASSESSMENT_PATHWAY", enabled: false });
  const state = reducer(initial, { type: "ADD_PERSON", mvpProfile: true, requestId: "pathway-off-profile",
    name: "Pathway Off Profile", dob: "2008-04-12", owner: "Jess Taylor",
    nextAction: "Complete Client profile", reviewDate: TODAY });
  const episode = state.people.find(item => item.registrationRequestId === "pathway-off-profile").episodes[0];
  assert.equal(episode.collections.filter(item => item.clientProfileMeasure).length, 4);
  assert.equal(episode.collections.some(item => item.mvpInitialAssessment), false);
});

test("current status reflects ongoing review after initial assessment", () => {
  const episode = {
    status: "Active",
    collections: [
      { mvpInitialAssessment: true, mvpRespondent: "Person", response: "Submitted" },
      { mvpTimepointId: "review-1", due: "2026-09-13", response: "Not started", assignment: "Planned" },
    ],
  };
  assert.equal(derivedEpisodeStatus({}, episode), "Ongoing review");
  assert.equal(derivedEpisodeStatus({}, { ...episode, collections: episode.collections.map(record =>
    record.mvpInitialAssessment ? { ...record, response: "Not started" } : record) }), "Assessment");
  assert.equal(derivedEpisodeStatus({}, { ...episode, collections: episode.collections.filter(record =>
    !record.mvpTimepointId) }), "Ongoing review");
  assert.equal(derivedEpisodeStatus({}, { ...episode, status: "Closed" }), "Closed");
  assert.equal(derivedEpisodeStatus({}, { ...episode, status: "Closed", disposition: "Discharged" }), "Discharged");
});

test("Batch 2 Assessment Outcome sets Not proceed after submission", () => {
  const instrument = EP_BATCH_2_INSTRUMENTS.find(item => item.codebookDataItem === "Assessment Outcome");
  const outcome = { version: instrument.version, response: "Not started", answers: [instrument.questions[0].options[3]] };
  const episode = { status: "Active", collections: [outcome] };
  assert.equal(derivedEpisodeStatus({}, episode), "Assessment");
  outcome.response = "Submitted";
  assert.equal(derivedEpisodeStatus({}, episode), "Not proceed");
  assert.equal(episodeDisplayStatus(episode), "Not proceed");
  outcome.answers = [instrument.questions[0].options[0]];
  assert.equal(derivedEpisodeStatus({}, episode), "Assessment");
  outcome.answers = [instrument.questions[0].options[3]];
  outcome.submittedAt = "2026-09-10";
  episode.collections.push({ ...outcome, submittedAt: "2026-09-11",
    answers: [instrument.questions[0].options[1]] });
  assert.equal(derivedEpisodeStatus({}, episode), "Assessment");
  episode.status = "Closed";
  assert.equal(derivedEpisodeStatus({}, episode), "Closed");
});

test("mock care episodes report status from their assessment and episode records", () => {
  const workspace = reconcileMvpAssessmentPathway(createDefaultWorkspace(), TODAY);
  for (const person of workspace.people) for (const episode of person.episodes) {
    const status = derivedEpisodeStatus({}, episode);
    const initial = episode.collections.filter(record =>
      record.mvpInitialAssessment && record.mvpRespondent === "Person");
    if (episode.status !== "Active") {
      assert.notEqual(status, "Assessment", person.id);
    } else if (initial.length && initial.every(record => record.response === "Submitted")) {
      assert.equal(status, "Ongoing review", person.id);
    } else {
      assert.notEqual(status, "Ongoing review", person.id);
    }
  }
  const jordan = workspace.people.find(person => person.id === "YS-1034");
  assert.equal(derivedEpisodeStatus({}, jordan.episodes[0]), "Ongoing review");
});

test("MVP Profile keeps Batch 1 episode details on the selected episode", () => {
  const initial = reducer(createDefaultWorkspace(), {
    type: "ADD_PERSON", mvpProfile: true, requestId: "profile-two-episodes",
    name: "Two Episode Example", dob: "2008-04-12", owner: "Jess Taylor",
    nextAction: "Begin initial assessment", reviewDate: TODAY,
  });
  const person = initial.people.find(item => item.registrationRequestId === "profile-two-episodes");
  const secondEpisode = { ...person.episodes[0], id: `${person.episodes[0].id}-second`, number: "02" };
  const state = { ...initial, people: initial.people.map(item => item.id === person.id ?
    { ...item, episodes: [...item.episodes, secondEpisode] } : item) };
  const updated = reducer(state, { type: "UPDATE_PROFILE", personId: person.id,
    episodeId: secondEpisode.id,
    values: { name: person.name, dob: person.dob, registeredCentreName: "Second Centre",
      commencementDate: TODAY } });
  const saved = updated.people.find(item => item.id === person.id);
  assert.equal(saved.episodes[0].profileDetails, undefined);
  assert.equal(saved.episodes[1].profileDetails.registeredCentreName, "Second Centre");
  assert.equal(saved.episodes[1].profileDetails.commencementDate, TODAY);
});
