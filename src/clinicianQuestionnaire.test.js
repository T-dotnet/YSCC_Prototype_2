import test from "node:test";
import assert from "node:assert/strict";
import { createSeed, reducer, getTasks, collectionActor } from "./model.js";
import { createSampleAnswers } from "./sampleQuestionnaires.js";

const context = {
  personId: "YS-1024",
  episodeId: "EP-1024-01",
  collectionId: "A-0-current",
};
const collection = (state) => state.people[0].episodes[0].collections.at(-1);
const begin = (state, options = {}) =>
  reducer(state, {
    ...context,
    type: "DELIVER",
    channel: "Clinician entry",
    respondent: "Person",
    assistance: "Transcribed",
    ...options,
  });
const submission = (state) => ({
  ...context,
  type: "SUBMIT",
  channel: "Clinician entry",
  attemptId: collection(state).attempts.at(-1)?.id,
  answers: createSampleAnswers({ participation: "In person" }),
});

test("clinician can fill and submit patient answers within the same assessment", () => {
  const seed = createSeed();
  const started = begin(seed);
  const saved = reducer(started, submission(started));
  const c = collection(saved);
  assert.equal(c.response, "Submitted");
  assert.equal(c.assignment, "Fulfilled");
  assert.equal(c.review, "Not required");
  assert.equal(c.respondent, "Person");
  assert.equal(
    collectionActor(saved.people[0], c, "respondent"),
    "Kai Thompson",
  );
  assert.equal(c.recorderName, "Jess Taylor");
  assert.equal(c.recorderId, "jess");
  assert.equal(c.assistance, "Transcribed");
  assert.equal(c.submittedAttemptId, c.attempts.at(-1).id);
  assert.ok(Number.isFinite(Date.parse(c.submittedTimestamp)));
  assert.deepEqual(
    saved.people[0].episodes[0].collections[0],
    seed.people[0].episodes[0].collections[0],
  );
  assert.equal(saved.people[0].episodes[0].collections.length, 2);
  assert.equal(
    getTasks(saved).some((task) => task.person.id === context.personId),
    false,
  );
  assert.equal(reducer(saved, submission(started)), saved);
});

test("joint family completion keeps the family answer source and clinician recorder distinct", () => {
  const state = begin(createSeed(), {
    respondent: "Family respondent",
    assistance: "Joint completion",
  });
  const saved = reducer(state, submission(state));
  assert.equal(collection(saved).respondentName, "Deb Thompson");
  assert.equal(collection(saved).recorderName, "Jess Taylor");
  assert.equal(collection(saved).assistance, "Joint completion");
});

test("Data Manager cannot begin or submit clinician completion", () => {
  const seed = createSeed();
  const manager = reducer(seed, { type: "SWITCH_STAFF", staffId: "ananya" });
  assert.equal(begin(manager), manager);
  const state = begin(seed);
  const switched = reducer(state, { type: "SWITCH_STAFF", staffId: "ananya" });
  assert.equal(reducer(switched, submission(state)), switched);
});

test("replacing a collection session rejects stale answers and preserves attempt provenance", () => {
  const started = begin(createSeed());
  const stale = submission(started);
  const reissued = begin(started, {
    respondent: "Family respondent",
    assistance: "Joint completion",
  });
  assert.equal(reducer(reissued, stale), reissued);
  assert.equal(
    collection(reissued).attempts.at(-2).respondentName,
    "Kai Thompson",
  );
  assert.equal(
    collection(reissued).attempts.at(-1).respondentName,
    "Deb Thompson",
  );
  assert.equal(
    reducer(reissued, { ...submission(reissued), attemptId: undefined }),
    reissued,
  );
  assert.equal(
    reducer(reissued, { ...submission(reissued), channel: "SMS link" }),
    reissued,
  );
});

test("incomplete answers, consent withdrawal and paused care cannot be submitted", () => {
  const state = begin(createSeed());
  assert.equal(reducer(state, { ...submission(state), answers: [] }), state);
  const withdrawn = reducer(state, {
    ...context,
    type: "CONSENT",
    consent: "Withdrawn",
    contact: "Suitable",
  });
  assert.equal(begin(withdrawn), withdrawn);
  assert.equal(reducer(withdrawn, submission(state)), withdrawn);
  const paused = reducer(state, {
    ...context,
    type: "EPISODE",
    status: "Paused",
    reason: "Pause sample care",
  });
  assert.equal(begin(paused), paused);
  assert.equal(reducer(paused, submission(state)), paused);
});

test("patient delivery still submits with its current attempt and replaces clinician recorder metadata", () => {
  const started = begin(createSeed());
  const patient = begin(started, {
    channel: "Clinic tablet",
    assistance: "Independent",
  });
  const saved = reducer(patient, {
    ...submission(patient),
    channel: "Clinic tablet",
  });
  assert.equal(collection(saved).response, "Submitted");
  assert.equal(collection(saved).recorderName, "Kai Thompson");
  assert.equal(collection(saved).recorderId, null);
  assert.equal(collection(saved).review, "Pending");
});
