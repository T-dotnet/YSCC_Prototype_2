import test from "node:test";
import assert from "node:assert/strict";
import { createSeed, currentStaff, reducer, TODAY } from "./model.js";
import { currentCollection } from "./workflow.js";
import { collectionSetupLabel, overviewNextStep } from "./overview.js";

function fixture(index = 4) {
  const state = createSeed();
  const person = state.people[index];
  const episode = person.episodes[0];
  const collection = currentCollection(episode);
  const step = () =>
    overviewNextStep(person, episode, collection, currentStaff(state));
  return { state, person, episode, collection, step };
}

test("overdue active links lead to inspection, while expired links lead to replacement", () => {
  const active = fixture();
  assert.equal(active.step().primary.modal, "collection-details");
  assert.match(active.step().description, /link is still active/);
  assert.match(active.step().dueText, /14 Sep 2026 · 1 day overdue/);
  const expired = fixture(0);
  assert.equal(expired.step().primary.modal, "collection");
  assert.equal(expired.step().primary.label, "Replace expired link");
  assert.match(expired.step().description, /draft.*cannot be resumed/);
  assert.match(expired.step().dueText, /3 days overdue/);
});

test("preparing another attempt changes the recommendation without creating a new collection", () => {
  const { state, person, episode, collection } = fixture();
  const next = reducer(state, {
    type: "DELIVER",
    personId: person.id,
    episodeId: episode.id,
    collectionId: collection.id,
    channel: "Clinic tablet",
    respondent: "Person",
    assistance: "Supported",
  });
  const p = next.people[4];
  const e = p.episodes[0];
  const c = currentCollection(e);
  const step = overviewNextStep(p, e, c, currentStaff(next));
  assert.equal(e.collections.length, episode.collections.length);
  assert.equal(c.id, collection.id);
  assert.match(step.description, /collection session is active/);
  assert.doesNotMatch(step.description, /link is still active/);
  assert.equal(step.primary.modal, "collection-details");
});

test("an unsent questionnaire can be arranged whether overdue, due today or scheduled", () => {
  const { collection, step } = fixture(2);
  for (const [due, status, title] of [
    ["2026-09-10", "Overdue", /overdue questionnaire/],
    [TODAY, "Due today", /Arrange questionnaire collection/],
    ["2026-12-01", "Scheduled", /scheduled questionnaire/],
  ]) {
    collection.due = due;
    assert.equal(step().badge, status);
    assert.match(step().title, title);
    assert.equal(step().primary.modal, "collection");
    assert.match(step().description, /No collection attempt/);
  }
});

test("draft and revoked links require inspection without offering a false resume action", () => {
  const { collection, step } = fixture();
  collection.response = "Draft";
  assert.equal(step().primary.modal, "collection-details");
  assert.match(step().description, /cannot be resumed/);
  collection.link = "Revoked";
  assert.match(step().title, /revoked/);
  assert.equal(step().primary.modal, "collection-details");
});

test("blocked participation or contact leads to its settings before any new attempt", () => {
  const { person, collection, step } = fixture(0);
  for (const [consent, contact] of [
    ["Withdrawn", "Suitable"],
    ["Not recorded", "Suitable"],
    ["Recorded", "Unsuitable"],
    ["Recorded", "Not confirmed"],
  ]) {
    person.consent = consent;
    person.contact = contact;
    assert.equal(collection.link, "Expired");
    assert.equal(step().primary.tab, "Consent & respondents");
    assert.equal(step().badge, "Collection blocked");
    assert.equal(step().primary.modal, undefined);
  }
});

test("intake requirements take priority over expired links and participation settings", () => {
  const { person, step } = fixture(0);
  person.intakes[0].status = "Awaiting information";
  person.consent = "Not recorded";
  assert.equal(step().primary.tab, "Intake");
  assert.equal(step().badge, "Intake required");
});

test("paused and cancelled collections do not offer collection setup", () => {
  const { collection, step } = fixture(0);
  for (const status of ["Paused", "Cancelled"]) {
    collection.assignment = status;
    assert.equal(step().badge, status);
    assert.equal(step().primary.modal, "collection-details");
    assert.doesNotMatch(step().dueText, /overdue/);
  }
});

test("closed and paused care show the episode state and history instead of overdue work", () => {
  const { episode, step } = fixture();
  for (const status of ["Closed", "Paused"]) {
    episode.status = status;
    episode.nextCareStep = "Recorded next arrangement";
    assert.equal(step().badge, status);
    assert.equal(step().primary.tab, "History");
    assert.equal(step().description, episode.nextCareStep);
    assert.doesNotMatch(step().dueText, /overdue/);
  }
});

test("submitted evidence remains reviewable after participation changes; completed review stays on the record", () => {
  const { state, person, collection, step } = fixture(1);
  person.consent = "Withdrawn";
  assert.equal(step().primary.label, "Review responses");
  collection.review = "Reviewed";
  assert.equal(step().primary.label, "View clinical review");
  assert.equal(step().primary.modal, "review");
  collection.needsReview = true;
  assert.equal(step().primary.label, "Review updated answers");
  state.staffId = "ananya";
  assert.equal(step().primary.label, "View responses");
  assert.equal(step().primary.modal, "review");
});

test("unknown questionnaire versions never offer delivery", () => {
  const { collection, step } = fixture(0);
  collection.version = "Unavailable version";
  assert.equal(step().badge, "Version unavailable");
  assert.equal(step().primary.modal, "collection-details");
});

test("calculating recommendations is read-only and preserves exact historical collection context", () => {
  const { state, person, episode } = fixture(0);
  const before = structuredClone(state);
  const prior = episode.collections[0];
  const step = overviewNextStep(person, episode, prior, currentStaff(state));
  assert.match(step.dueText, /Due 15 Jun 2026/);
  assert.equal(step.primary.label, "View clinical review");
  assert.deepEqual(state, before);
});

test("setup titles distinguish initial collection from replacement and options review", () => {
  const { collection } = fixture(2);
  assert.equal(collectionSetupLabel(collection), "Set up collection");
  collection.link = "Expired";
  assert.equal(collectionSetupLabel(collection), "Replace expired link");
  collection.link = "Active";
  assert.equal(collectionSetupLabel(collection), "Review collection options");
});
