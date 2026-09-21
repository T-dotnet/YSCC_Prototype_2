import test from "node:test";
import assert from "node:assert/strict";
import {
  createSeed,
  reducer,
  getTasks,
  qualityResolutionError,
} from "./model.js";
import {
  currentCollection,
  ownedTasks,
  safeReturnTo,
  taskHref,
  isOutstanding,
} from "./workflow.js";

test("a future follow-up cannot displace outstanding collection or review work", () => {
  const state = createSeed();
  const episode = state.people[0].episodes[0];
  const current = currentCollection(episode);
  const next = reducer(state, {
    type: "PLAN",
    personId: state.people[0].id,
    episodeId: episode.id,
    label: "Future follow-up",
    due: "2026-12-15",
  });
  assert.equal(currentCollection(next.people[0].episodes[0]).id, current.id);
  assert.ok(isOutstanding(current));
  assert.equal(isOutstanding(episode.collections[0]), false);
});

test("ownership filters use the current staff member and the episode owner", () => {
  const state = createSeed();
  state.people[0].episodes[0].owner = "Ananya";
  state.people[2].owner = "";
  const tasks = getTasks(state);
  const mine = ownedTasks(tasks, state, "me");
  assert.ok(
    mine.every(
      ({ person, episode }) =>
        (episode?.owner || person.owner) === "Jess Taylor",
    ),
  );
  state.staffId = "ananya";
  assert.deepEqual(
    ownedTasks(tasks, state, "me").map((t) => t.person.id),
    ["YS-1024"],
  );
  assert.ok(
    ownedTasks(tasks, state, "unassigned").every(
      (t) => !t.person.owner && !t.episode?.owner,
    ),
  );
  assert.equal(ownedTasks(tasks, state, "team").length, tasks.length);
});

test("task links preserve exact collection, episode and filtered return view", () => {
  const state = createSeed();
  const task = getTasks(state).find((item) => item.kind !== "intake");
  const from = "/?q=Kai&filter=Needs+attention&owner=team";
  const url = new URL(taskHref(task, from), "http://prototype.local");
  assert.equal(url.searchParams.get("collection"), task.collection.id);
  assert.equal(url.searchParams.get("episode"), task.episode.id);
  assert.equal(url.searchParams.get("returnTo"), from);
  assert.equal(url.searchParams.get("tab"), "assessment");
  for (const invalid of [
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "javascript:alert(1)",
    "/people/YS-1024",
  ])
    assert.equal(safeReturnTo(invalid), "/people");
});

test("confirmation resolves an issue without fabricating a correction", () => {
  const state = createSeed();
  const issue = state.issues[0];
  const action = {
    type: "RESOLVE_ISSUE",
    personId: issue.personId,
    issueId: issue.id,
    resolution: "Confirmed unchanged",
    source: "Fictional QA referral",
    reason: "The existing date matches the source.",
  };
  const next = reducer(state, action);
  assert.deepEqual(next.people, state.people);
  assert.equal(next.issues[0].status, "Resolved");
  assert.equal(next.audit[0].priorValue, next.audit[0].newValue);
  assert.equal(next.audit[0].source, action.source);
  assert.equal(next.audit[0].actor, "Jess Taylor");
});

test("investigation remains open and records a responsible owner and next step", () => {
  const state = { ...createSeed(), staffId: "ananya" };
  const issue = state.issues[0];
  const action = {
    type: "RESOLVE_ISSUE",
    personId: issue.personId,
    issueId: issue.id,
    resolution: "Needs investigation",
    source: "Fictional conflicting records",
    reason: "Source is inconclusive.",
    nextStep: "Confirm the original referral with the care owner.",
  };
  const next = reducer(state, action);
  assert.deepEqual(next.people, state.people);
  assert.equal(next.issues[0].status, "Open");
  assert.equal(next.issues[0].owner, "Ananya");
  assert.equal(next.issues[0].nextStep, action.nextStep);
  assert.equal(reducer(state, { ...action, nextStep: "" }), state);
});

test("corrections reject unchanged values, invalid dates and mismatched people", () => {
  const state = createSeed();
  const issue = state.issues[0];
  const person = state.people.find((p) => p.id === issue.personId);
  const action = {
    type: "RESOLVE_ISSUE",
    personId: person.id,
    issueId: issue.id,
    resolution: "Corrected value",
    source: "Fictional QA source",
    reason: "Correcting the sample date.",
  };
  for (const value of [
    person.dob,
    "2009-13-01",
    "2009-02-31",
    "2027-01-01",
    "bad",
  ]) {
    assert.ok(qualityResolutionError(state, { ...action, value }));
    assert.equal(reducer(state, { ...action, value }), state);
  }
  assert.equal(
    reducer(state, {
      ...action,
      personId: state.people[1].id,
      value: "2009-01-01",
    }),
    state,
  );
});

test("participation updates retain source, previous settings, actor and time", () => {
  const state = { ...createSeed(), staffId: "ananya" };
  const person = state.people[0];
  const next = reducer(state, {
    type: "CONSENT",
    personId: person.id,
    consent: "Withdrawn",
    contact: "Unsuitable",
    source: "Fictional discussion note",
    reason: "Sample participation decision.",
  });
  assert.equal(next.people[0].participationRecord.actor, "Ananya");
  assert.ok(next.people[0].participationRecord.timestamp);
  assert.equal(next.audit[0].prior.consent, person.consent);
  assert.equal(next.audit[0].source, "Fictional discussion note");
  assert.equal(
    next.people[0].episodes[0].collections.find((c) => c.link === "Active"),
    undefined,
  );
});

test("episode actions retain next care step and owner, and reject unsupported transitions", () => {
  const state = createSeed();
  const person = state.people[0],
    episode = person.episodes[0];
  const action = {
    type: "EPISODE",
    personId: person.id,
    episodeId: episode.id,
    status: "Paused",
    reason: "Sample pause",
    nextCareStep: "Confirm the next appointment.",
    nextCareOwner: "Jess Taylor",
  };
  const next = reducer(state, action);
  assert.equal(next.people[0].episodes[0].nextCareStep, action.nextCareStep);
  assert.equal(next.people[0].episodes[0].nextCareOwner, action.nextCareOwner);
  assert.equal(reducer(state, { ...action, status: "Unknown" }), state);
  assert.equal(reducer(next, action), next);
});
