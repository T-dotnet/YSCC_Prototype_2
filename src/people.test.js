import test from "node:test";
import assert from "node:assert/strict";
import { createSeed, TODAY } from "./model.js";
import { newIntake } from "./intake.js";
import { comparePeople, peopleInEpisodes, personStatus } from "./people.js";

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

test("paused, closed and intake-blocked care never show stale overdue assessment work", () => {
  const person = createSeed().people[0];
  const episode = person.episodes[0];
  for (const status of ["Paused", "Closed"]) {
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
