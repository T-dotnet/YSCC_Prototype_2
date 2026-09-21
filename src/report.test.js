import test from "node:test";
import assert from "node:assert/strict";
import { createSeed, reducer } from "./model.js";
import {
  suggestedReport,
  reportEvidence,
  reportChangeEvidence,
} from "./progress.js";
import {
  reportChangeLog,
  reportEditError,
  progressAnnotationError,
  reportSources,
  reportSourceKey,
} from "./report.js";

function scenario() {
  const state = createSeed();
  const person = state.people.find((p) => p.name === "Zoe Patel");
  const episode = person.episodes[0];
  const action = {
    type: "SAVE_PROGRESS_REPORT",
    personId: person.id,
    episodeId: episode.id,
    expectedRevision: 0,
    expectedSources: reportSourceKey(episode),
    content: {
      ...suggestedReport(person, episode),
      interpretation: "Discuss the changed preferences at the next review.",
      nextSteps: "Check the preferred format together.",
    },
  };
  return { state, person, episode, action };
}

test("clinician report save retains evidence, answers and independent review states across serialization", () => {
  const { state, person, episode, action } = scenario();
  const next = JSON.parse(JSON.stringify(reducer(state, action)));
  const saved = next.people.find((p) => p.id === person.id).episodes[0];
  assert.deepEqual(saved.collections, episode.collections);
  assert.deepEqual(saved.progressReport.sources, reportSources(episode));
  assert.equal(saved.progressReport.actor, "Jess Taylor");
  assert.equal(saved.progressReport.revision, 1);
  assert.equal(
    saved.progressReport.content.interpretation,
    action.content.interpretation,
  );
  assert.equal(episode.progressReport, undefined);
  assert.equal(
    next.people.find((p) => p.id === person.id).episodes[1].progressReport,
    undefined,
  );
});

test("report edits retain earlier narrative and source snapshots", () => {
  const { state, person, action } = scenario();
  const saved = reducer(state, action);
  const nextAction = {
    ...action,
    expectedRevision: 1,
    content: { ...action.content, summary: "Updated summary." },
  };
  const revised = reducer(saved, nextAction).people.find(
    (p) => p.id === person.id,
  ).episodes[0];
  assert.equal(revised.progressReport.revision, 2);
  assert.equal(revised.progressReportHistory.length, 1);
  assert.equal(
    revised.progressReportHistory[0].content.summary,
    action.content.summary,
  );
  assert.equal(revised.progressReport.content.summary, "Updated summary.");
});

test("first report save records initial wording, editor identity, role and time", () => {
  const { state, person, action } = scenario();
  const saved = reducer(state, action).people.find((p) => p.id === person.id)
    .episodes[0];
  const [entry] = reportChangeLog(saved);
  assert.equal(entry.initial, true);
  assert.equal(entry.actorId, "jess");
  assert.equal(entry.role, "Clinician");
  assert.ok(Number.isFinite(Date.parse(entry.timestamp)));
  assert.deepEqual(
    entry.changes.find((change) => change.key === "interpretation"),
    {
      key: "interpretation",
      label: "Clinician interpretation",
      before: "",
      after: action.content.interpretation,
    },
  );
});

test("clinician annotations are append-only, care-period scoped and retain author context", () => {
  const { state, person, episode } = scenario();
  const action = {
    type: "ADD_PROGRESS_ANNOTATION",
    personId: person.id,
    episodeId: episode.id,
    text: "Discuss the preferred support format at the next appointment.",
  };
  const next = reducer(state, action);
  const saved = next.people.find((p) => p.id === person.id).episodes[0];
  const [annotation] = saved.progressAnnotations;
  assert.equal(annotation.text, action.text);
  assert.equal(annotation.actor, "Jess Taylor");
  assert.equal(annotation.role, "Clinician");
  assert.ok(Number.isFinite(Date.parse(annotation.timestamp)));
  assert.equal(annotation.reportRevision, null);
  assert.equal(next.people.find((p) => p.id === person.id).episodes[1].progressAnnotations, undefined);
  assert.equal(saved.events[0].title, "Progress annotation added");
  assert.equal(reducer(next, { ...action, text: "A second annotation." }).people.find((p) => p.id === person.id).episodes[0].progressAnnotations.length, 2);
});

test("annotations reject empty, overlong and non-clinician saves", () => {
  const { state, person, episode } = scenario();
  const action = {
    type: "ADD_PROGRESS_ANNOTATION",
    personId: person.id,
    episodeId: episode.id,
    text: "",
  };
  assert.match(progressAnnotationError(episode, "Clinician", action), /Write an annotation/);
  assert.equal(reducer(state, action), state);
  assert.equal(reducer(state, { ...action, text: "x".repeat(2001) }), state);
  const other = { ...state, staffId: "ananya" };
  assert.equal(reducer(other, { ...action, text: "A note" }), other);
});

test("each report section logs only actual changes, including removal, across reload", () => {
  const { state, person, action } = scenario();
  let saved = reducer(state, action);
  let content = { ...action.content };
  const first = structuredClone(
    saved.people.find((p) => p.id === person.id).episodes[0].progressReport,
  );
  const edits = [
    ["summary", "Updated summary.\n\nA second paragraph."],
    ["interpretation", "Discuss together."],
    ["nextSteps", ""],
  ];
  edits.forEach(([key, after], index) => {
    const before = content[key];
    content = { ...content, [key]: after };
    saved = JSON.parse(
      JSON.stringify(
        reducer(saved, {
          ...action,
          expectedRevision: index + 1,
          content,
        }),
      ),
    );
    const episode = saved.people.find((p) => p.id === person.id).episodes[0];
    const [entry] = reportChangeLog(episode);
    assert.equal(entry.changes.length, 1);
    assert.equal(entry.changes[0].key, key);
    assert.equal(entry.changes[0].before, before);
    assert.equal(entry.changes[0].after, after);
    assert.equal(episode.progressReportHistory.length, index + 1);
    assert.deepEqual(episode.progressReportHistory.at(-1), first);
  });
});

test("unchanged and whitespace-only saves do not create log entries or events", () => {
  const { state, person, action } = scenario();
  const saved = reducer(state, action);
  const episode = saved.people.find((p) => p.id === person.id).episodes[0];
  const unchanged = {
    ...action,
    expectedRevision: 1,
    content: { ...action.content, summary: `  ${action.content.summary} \n` },
  };
  assert.equal(
    reportEditError(episode, "Clinician", unchanged),
    "No changes to save.",
  );
  assert.equal(reducer(saved, unchanged), saved);
});

test("evidence-only reconciliation retains a version without claiming narrative edits", () => {
  const { state, person, action } = scenario();
  const saved = reducer(state, action);
  const episode = saved.people.find((p) => p.id === person.id).episodes[0];
  episode.collections[0].reviewNote = "Updated sample review evidence.";
  const next = reducer(saved, {
    ...action,
    expectedRevision: 1,
    expectedSources: reportSourceKey(episode),
  });
  const revised = next.people.find((p) => p.id === person.id).episodes[0];
  assert.deepEqual(revised.progressReport.changes, []);
  assert.equal(revised.progressReport.revision, 2);
  assert.match(
    revised.events[0].detail,
    /Evidence updated; narrative unchanged/,
  );
});

test("legacy report versions gain comparisons without modifying their saved metadata", () => {
  const { state, person, action } = scenario();
  const saved = reducer(state, action);
  const next = reducer(saved, {
    ...action,
    expectedRevision: 1,
    content: { ...action.content, summary: "Legacy revised summary." },
  });
  const episode = next.people.find((p) => p.id === person.id).episodes[0];
  for (const version of [
    episode.progressReport,
    ...episode.progressReportHistory,
  ]) {
    delete version.changes;
    delete version.role;
  }
  const before = structuredClone(episode);
  const [entry] = reportChangeLog(episode);
  assert.deepEqual(
    entry.changes.map(({ key }) => key),
    ["summary"],
  );
  assert.equal(entry.changes[0].before, action.content.summary);
  assert.equal(entry.role, undefined);
  assert.deepEqual(episode, before);
  episode.progressReportHistory = [];
  assert.equal(reportChangeLog(episode)[0].changes, null);
});

test("readable report comparisons retain saved evidence after current answers change", () => {
  const { state, person, action } = scenario();
  const saved = reducer(state, action).people.find((p) => p.id === person.id);
  const episode = saved.episodes[0];
  const comparison = reportChangeEvidence(saved, episode).groups[0].comparison;
  episode.collections[0].answers[0] = "A different current answer";
  episode.collections[0].revision = 1;
  assert.deepEqual(
    reportChangeEvidence(saved, episode).groups[0].comparison,
    comparison,
  );
  assert.notDeepEqual(
    reportEvidence(saved, episode).groups[0].comparison,
    comparison,
  );
});

test("readable report comparisons never replace clinician-authored changes", () => {
  const { state, person, action } = scenario();
  const changes = "Taking part has changed.\n\nDiscuss preferences together.";
  const saved = reducer(state, {
    ...action,
    content: { ...action.content, changes },
  }).people.find((p) => p.id === person.id);
  assert.equal(reportChangeEvidence(saved, saved.episodes[0]), null);
  assert.equal(saved.episodes[0].progressReport.content.changes, changes);
});

test("unauthorised, stale or invalid report saves change nothing", () => {
  const { state, action } = scenario();
  for (const invalid of [
    { expectedRevision: 9 },
    { expectedSources: "old evidence" },
    { content: { ...action.content, summary: "  " } },
    { content: { ...action.content, changes: "x".repeat(20001) } },
    { episodeId: "missing" },
  ]) {
    assert.equal(reducer(state, { ...action, ...invalid }), state);
  }
  for (const staffId of ["ananya", "unknown"]) {
    const other = { ...state, staffId };
    assert.equal(reducer(other, action), other);
  }
});

test("new evidence flags saved report without replacing clinician wording", () => {
  const { state, person, action } = scenario();
  const saved = reducer(state, action);
  const episode = saved.people.find((p) => p.id === person.id).episodes[0];
  const content = structuredClone(episode.progressReport.content);
  const priorSource = JSON.stringify(episode.progressReport.sources);
  episode.collections[0].answers[0] = "On my own device";
  episode.collections[0].revision = 1;
  episode.collections[0].needsReview = true;
  assert.notEqual(priorSource, reportSourceKey(episode));
  assert.deepEqual(episode.progressReport.content, content);
  assert.equal(reducer(saved, { ...action, expectedRevision: 1 }), saved);
  const fresh = reducer(saved, {
    ...action,
    expectedRevision: 1,
    expectedSources: reportSourceKey(episode),
  });
  const refreshed = fresh.people.find((p) => p.id === person.id).episodes[0];
  assert.equal(
    JSON.stringify(refreshed.progressReport.sources),
    reportSourceKey(refreshed),
  );
  assert.equal(
    JSON.stringify(refreshed.progressReportHistory[0].sources),
    priorSource,
  );
});

test("reports summarise the full adaptive questionnaire by section and separate perspectives", () => {
  const { person, episode } = scenario();
  const extra = {
    ...structuredClone(episode.collections[1]),
    id: "family",
    respondent: "Family respondent",
    respondentName: "Another respondent",
  };
  episode.collections.push(extra);
  const evidence = reportEvidence(person, episode);
  assert.equal(evidence.groups.length, 2);
  assert.ok(
    evidence.groups.every((g) =>
      g.points.every((c) => c.respondent === g.role),
    ),
  );
  const draft = suggestedReport(person, episode);
  assert.match(draft.changes, /Taking part:/);
  assert.match(draft.changes, /Everyday activities:/);
  assert.match(draft.changes, /Collection context changed:/);
  assert.equal(draft.interpretation, "");
  assert.equal(draft.nextSteps, "");
});

test("all timepoints are retained while unknown dates, versions and same-date ordering remain explicit", () => {
  const { person, episode } = scenario();
  episode.collections.push({
    ...structuredClone(episode.collections[1]),
    id: "middle",
    submittedAt: "2026-08-01",
  });
  assert.equal(reportEvidence(person, episode).groups[0].points.length, 3);
  episode.collections.push({
    ...structuredClone(episode.collections[1]),
    id: "same-date",
  });
  assert.match(
    reportEvidence(person, episode).groups[0].comparison.reason,
    /Several responses/,
  );
  episode.collections.push({
    ...structuredClone(episode.collections[0]),
    id: "undated",
    submittedAt: null,
  });
  assert.equal(reportEvidence(person, episode).undated.length, 1);
  assert.match(suggestedReport(person, episode).summary, /no submission date/);
  episode.collections.push({
    ...structuredClone(episode.collections[0]),
    id: "unknown-version",
    version: "unknown",
  });
  assert.equal(reportEvidence(person, episode).groups.length, 2);
});

test("empty and single-response reports do not invent longitudinal findings", () => {
  const { person, episode } = scenario();
  episode.collections = [];
  assert.match(suggestedReport(person, episode).summary, /No questionnaires/);
  const one = scenario();
  one.episode.collections = [one.episode.collections[0]];
  assert.match(
    suggestedReport(one.person, one.episode).changes,
    /second submitted response/,
  );
});

test("closed care-period report edits preserve closure and cannot leak to current care", () => {
  const { state, person, action } = scenario();
  const closed = person.episodes[1];
  const next = reducer(state, {
    ...action,
    episodeId: closed.id,
    expectedSources: reportSourceKey(closed),
    content: suggestedReport(person, closed),
  });
  const saved = next.people.find((p) => p.id === person.id);
  assert.equal(saved.episodes[1].status, "Closed");
  assert.equal(saved.episodes[1].progressReport.revision, 1);
  assert.deepEqual(saved.episodes[0], person.episodes[0]);
});
