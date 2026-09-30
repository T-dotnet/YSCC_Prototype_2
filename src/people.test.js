import test from "node:test";
import assert from "node:assert/strict";
import { createSeed, getTasks, TODAY } from "./model.js";
import { newIntake } from "./intake.js";
import { comparePeople, peopleForList, peopleInEpisodes, personStatus } from "./people.js";

test("every person with work is discoverable in People", () => {
  const state = createSeed();
  const rows = peopleForList(state.people);
  const ids = new Set(rows.map((row) => row.person.id));
  for (const task of getTasks(state)) {
    assert.ok(ids.has(task.person.id), `${task.person.name} is missing from People`);
    assert.equal(peopleForList(state.people, "All episodes", task.person.id).length, 1);
  }
  assert.equal(rows.length, state.people.filter((person) => !person.archivedAt).length);
});

test("people show actionable assessment states in priority order", () => {
  const rows = peopleInEpisodes(createSeed().people).sort(comparePeople);
  assert.deepEqual(
    rows.slice(0, 6).map((row) => row.status),
    [
      "Overdue",
      "Overdue",
      "Ready for review",
      "Ready for review",
      "Due today",
      "Due today",
    ],
  );
  assert.equal(rows[0].person.name, "Kai Thompson");
  assert.match(rows[0].detail, /3 days overdue/);
  assert.match(rows[1].detail, /1 day overdue/);
  assert.match(rows[2].detail, /Response received/);
});

test("future follow-ups cannot hide overdue work, and completed review updates the status", () => {
  const person = createSeed().people[1];
  const episode = person.episodes[0];
  const current = episode.collections[0];
  const future = {
    ...current,
    id: "future",
    due: "2026-12-15",
    response: "Not started",
    review: "Pending",
  };
  episode.collections.unshift(future);
  assert.equal(personStatus(person, episode).collection.id, current.id);
  current.review = "Reviewed";
  assert.equal(personStatus(person, episode).status, "Scheduled");
  episode.collections = [current];
  assert.equal(personStatus(person, episode).status, "Reviewed");
  current.needsReview = true;
  assert.equal(personStatus(person, episode).status, "Ready for review");
  assert.match(personStatus(person, episode).detail, /Re-review required/);
});

test("paused, closed, completed and intake-blocked care never show stale overdue assessment work", () => {
  const person = createSeed().people[0];
  const episode = person.episodes[0];
  for (const status of ["Paused", "Closed", "Completed"]) {
    episode.status = status;
    const summary = personStatus(person, episode);
    assert.equal(summary.status, status);
    assert.equal(summary.collection, undefined);
    assert.doesNotMatch(summary.detail, /overdue/i);
  }
  episode.status = "Active";
  person.intakes[0].status = "Awaiting triage";
  assert.equal(personStatus(person, episode).status, "Intake required");
});

test("completed episodes remain discoverable in the People status filter", () => {
  const state = createSeed();
  const person = state.people.find((item) => item.id === "YS-DEMO-CLOSE");
  person.episodes[0].status = "Completed";
  const rows = peopleForList(state.people, "Completed");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].person.id, person.id);
  assert.match(rows[0].detail, /Closure assessment and care experience feedback complete/);
});

test("episode filtering keeps the status and opened collection in the same care period", () => {
  const person = createSeed().people.find((p) => p.name === "Zoe Patel");
  person.episodes.reverse();
  const current = peopleInEpisodes([person])[0];
  assert.equal(current.episode.status, "Active");
  assert.equal(current.status, "Ready for review");
  const historical = peopleInEpisodes([person], "Closed")[0];
  assert.equal(historical.episode.id, "EP-1027-history-01");
  assert.equal(historical.status, "Closed");
  assert.equal(historical.collection, undefined);
  assert.equal(peopleInEpisodes([person], "Paused").length, 0);
});

test("intake-only and empty collection states stay explicit", () => {
  const state = createSeed();
  state.people.push({
    id: "intake-only",
    name: "Sample Intake",
    episodes: [],
    intakes: [
      {
        ...newIntake({
          id: "sample-intake",
          today: TODAY,
          owner: "Jess Taylor",
        }),
        status: "Awaiting information",
      },
    ],
  });
  const intakeRow = peopleInEpisodes(state.people, "Intake").find(
    (row) => row.person.name === "Sample Intake",
  );
  assert.equal(intakeRow.person.name, "Sample Intake");
  assert.equal(intakeRow.episode, undefined);
  assert.equal(intakeRow.label, "Intake");
  intakeRow.person.intakes[0].reviewDate = "2026-09-14";
  assert.equal(personStatus(intakeRow.person).status, "Overdue");
  intakeRow.person.intakes[0].reviewDate = TODAY;
  assert.equal(personStatus(intakeRow.person).status, "Awaiting information");
  const person = state.people[0];
  person.episodes[0].collections = [];
  assert.equal(
    personStatus(person, person.episodes[0]).status,
    "Not scheduled",
  );
  assert.equal(personStatus({ episodes: [] }).status, "Intake");
});

test("intake rows expose registration, triage and assessment stages", () => {
  const intake = newIntake({
    id: "stage-intake",
    today: TODAY,
    owner: "Jess Taylor",
  });
  const person = { episodes: [], intakes: [intake] };
  assert.equal(personStatus(person).stage, "Registration");
  intake.status = "Awaiting triage";
  assert.equal(personStatus(person).stage, "Intake & triage");
  Object.assign(intake, {
    status: "Completed",
    outcome: "Proceed",
    consentRecorded: true,
    consentReference: "Demo consent record",
    respondentPreference: "Person",
    identityChecked: true,
    permissionChecked: true,
    supportChecked: true,
    triageChecked: true,
    decisionBy: "Jess Taylor",
    decisionAt: "2026-09-15T10:00",
    assessmentOwner: "Jess Taylor",
  });
  assert.equal(personStatus(person).stage, "Assessment");
});

test('People bundle summary uses the instance name and aggregate questionnaire progress', async () => {
 const {peopleBundleSummary} = await import('./people.js');
 const collections = [{id:'one',bundleId:'template',bundleInstanceId:'instance',response:'Submitted'},
   {id:'two',bundleId:'template',bundleInstanceId:'instance',response:'Draft',assignment:'Active'}];
 const episode = {collections,assessmentBundleInstances:[{id:'instance',name:'My review',customName:true}]};
 const row = {collection:collections[0],episode,label:'Instrument',status:'Completed'};
 const summary = peopleBundleSummary(row,{scheduleAssessments:false});
 assert.equal(summary.label,'My review');assert.equal(summary.status,'In progress');
 assert.equal(summary.detail,'1 of 2 questionnaires completed');
 assert.equal(peopleBundleSummary({...row,collection:{id:'individual'},episode:{collections:[{id:'individual'}]}},{}).label,'No bundle scheduled');
});
test('MVP bundle summary reports an overdue pending assessment with scheduling off', async () => {
 const {peopleBundleSummary} = await import('./people.js');
 const collections = [
   {id:'one',bundleId:'review',bundleInstanceId:'instance',response:'Not started',assignment:'Planned',due:'2026-09-13'},
   {id:'two',bundleId:'review',bundleInstanceId:'instance',response:'Not started',assignment:'Planned',due:'2026-09-13'},
 ];
 const episode = {collections,assessmentBundleInstances:[{id:'instance',name:'90-day review',customName:true}]};
 const summary = peopleBundleSummary({episode,collection:collections[0]}, {scheduleAssessments:false,advancedAssessmentOptions:false});
 assert.equal(summary.status,'Overdue');
 assert.equal(summary.due,'2026-09-13');
 assert.match(summary.detail,/Due 13 Sep 2026/);
});
