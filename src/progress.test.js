import { createSampleAnswers } from "./sampleQuestionnaires.js";
import {
  DEMO_INSTRUMENT,
  LIKERT_INSTRUMENT,
  questionnaireState,
  setQuestionAnswer,
} from "./instruments.js";
import test from "node:test";
import assert from "node:assert/strict";
import { createSeed, reducer, TODAY } from "./model.js";
import {
  patientProgress,
  questionnaireProgress,
  questionnaireDashboardGroups,
  compareResponses,
  reportEvidence,
  responseDate,
} from "./progress.js";

function scenario() {
  const state = createSeed();
  const person = state.people.find((p) => p.name === "Zoe Patel");
  const episode = person.episodes[0];
  return {
    state,
    person,
    episode,
    before: episode.collections[0],
    latest: episode.collections[1],
  };
}

test("progress compares original submitted dates and stays within the selected episode", () => {
  const { person, episode, before, latest } = scenario();
  before.due = "2027-01-01";
  episode.collections.reverse();
  const result = patientProgress(person, episode);
  assert.equal(result.latest.id, latest.id);
  assert.equal(result.baseline.id, before.id);
  assert.equal(result.responses.length, 2);
  assert.equal(result.pendingReviews.length, 1);
  assert.equal(result.latestReview.id, before.id);
  assert.equal(compareResponses(person, before, latest).comparable, 13);
  const historical = patientProgress(person, person.episodes[1]);
  assert.equal(historical.latest.label, "Discharge check-in");
  assert.equal(historical.pendingReviews.length, 0);
  assert.ok(historical.responses.every((c) => c.id.includes("history")));
});

test("Mia has four comparable Likert responses in one care episode", () => {
  const state = createSeed();
  const person = state.people.find((p) => p.name === "Mia Robinson");
  const episode = person.episodes[0];
  const result = questionnaireProgress(
    person,
    episode,
    LIKERT_INSTRUMENT.version,
  );
  assert.equal(person.episodes.length, 1);
  assert.equal(result.responses.length, 4);
  assert.equal(result.dated.length, 4);
  assert.equal(result.earlier.length, 3);
  assert.equal(
    result.baseline.label,
    "Life and care check-in · Starting point",
  );
  assert.equal(result.latest.label, "Life and care check-in · 12 weeks");
  assert.deepEqual(result.dated.map(responseDate), [
    "2026-06-16",
    "2026-07-14",
    "2026-08-11",
    "2026-09-08",
  ]);
  assert.ok(
    result.responses.every(
      (response) =>
        questionnaireState(LIKERT_INSTRUMENT, response.answers).complete,
    ),
  );
  const comparison = compareResponses(person, result.baseline, result.latest);
  assert.equal(comparison.comparable, 6);
  assert.equal(comparison.changed, 6);
});

test("Mia has multiple qualitative responses alongside the Likert series", () => {
  const state = createSeed();
  const person = state.people.find((p) => p.name === "Mia Robinson");
  const episode = person.episodes[0];
  const result = questionnaireProgress(
    person,
    episode,
    DEMO_INSTRUMENT.version,
  );
  assert.equal(result.responses.length, 5);
  assert.equal(result.dated.length, 5);
  assert.equal(result.baseline.label, "Initial assessment");
  assert.equal(result.latest.label, "Everyday life check-in · 12 weeks");
  assert.ok(
    result.responses.every(
      (response) =>
        questionnaireState(DEMO_INSTRUMENT, response.answers).complete,
    ),
  );
});

test("dashboard data keeps each Likert question, scale and timepoint explicit", () => {
  const state = createSeed();
  const person = state.people.find((p) => p.name === "Mia Robinson");
  const episode = person.episodes[0];
  const groups = questionnaireDashboardGroups(reportEvidence(person, episode));
  const group = groups.find(
    (item) => item.version === LIKERT_INSTRUMENT.version,
  );
  assert.equal(group.instrumentName, LIKERT_INSTRUMENT.name);
  assert.equal(group.likertTrends.length, 6);
  assert.equal(group.likertChanges.length, 6);
  assert.equal(group.likertQuestions.length, 6);
  assert.equal(group.likertScore.latest.answered, 6);
  assert.equal(group.likertScore.latest.total, 6);
  assert.equal(group.likertScore.baseline.answered, 6);
  assert.ok(group.likertScore.latest.value > group.likertScore.baseline.value);
  assert.equal(group.qualitativeQuestions.length, 0);
  assert.equal(group.qualitativeChanges.length, 0);
  assert.equal(group.responseHistory.length, 4);
  assert.equal(group.responseHistory[0].previous, null);
  assert.equal(group.responseHistory[1].changedCount, 5);
  assert.equal(group.responseHistory[1].likertChangedCount, 5);
  assert.equal(group.responseHistory[1].qualitativeChanges.length, 0);
  assert.equal(
    group.likertTrends[0].question,
    "In the past 2 weeks, how often did your daily routine work well enough for you?",
  );
  assert.deepEqual(group.likertTrends[0].scale.options, [
    "Never",
    "Rarely",
    "Sometimes",
    "Often",
    "Always",
  ]);
  assert.deepEqual(
    group.likertTrends[0].points.map(({ date, answer, value }) => ({
      date,
      answer,
      value,
    })),
    [
      { date: "2026-06-16", answer: "Rarely", value: 2 },
      { date: "2026-07-14", answer: "Sometimes", value: 3 },
      { date: "2026-08-11", answer: "Sometimes", value: 3 },
      { date: "2026-09-08", answer: "Often", value: 4 },
    ],
  );
});

test("Mia's dashboard keeps Likert and qualitative series separate", () => {
  const state = createSeed();
  const person = state.people.find((p) => p.name === "Mia Robinson");
  const episode = person.episodes[0];
  const groups = questionnaireDashboardGroups(reportEvidence(person, episode));
  const qualitative = groups.find(
    (item) => item.version === DEMO_INSTRUMENT.version,
  );
  assert.equal(qualitative.responseHistory.length, 5);
  assert.equal(qualitative.likertTrends.length, 0);
  assert.equal(qualitative.likertChanges.length, 0);
  assert.equal(qualitative.likertQuestions.length, 0);
  assert.equal(qualitative.likertScore, null);
  assert.ok(qualitative.qualitativeQuestions.length > 0);
  assert.ok(qualitative.qualitativeChanges.length > 0);
});

test("dashboard data separates changed qualitative answers from Likert trends", () => {
  const { person, episode } = scenario();
  const [group] = questionnaireDashboardGroups(reportEvidence(person, episode));
  assert.equal(group.instrumentName, DEMO_INSTRUMENT.name);
  assert.equal(group.likertTrends.length, 0);
  assert.equal(group.likertChanges.length, 0);
  assert.ok(group.qualitativeQuestions.length > 0);
  assert.ok(group.qualitativeChanges.length > 0);
  assert.ok(
    group.qualitativeChanges.every(
      (change) =>
        change.question &&
        change.comparison.before &&
        change.comparison.after &&
        change.comparison.change === "Changed",
    ),
  );
  assert.equal(group.responseHistory.length, 2);
  assert.ok(group.responseHistory[1].qualitativeChanges.length > 0);
  assert.ok(
    group.responseHistory[1].qualitativeChanges.every(
      (change) =>
        change.question && change.comparison.before && change.comparison.after,
    ),
  );
});

test("changes are per answer and never convert nonresponse or invalid data into a trend", () => {
  const { person, before, latest } = scenario();
  latest.answers = [
    "On my own device",
    "Prefer not to answer",
    "invalid answer",
  ];
  const result = compareResponses(person, before, latest);
  assert.equal(result.changed, 1);
  assert.equal(result.comparable, 1);
  assert.deepEqual(
    result.rows.map((r) => r.change),
    ["Changed", ...Array(23).fill("Not comparable")],
  );
  before.answers[0] = undefined;
  latest.answers[1] = before.answers[1] = "Prefer not to answer";
  assert.equal(compareResponses(person, before, latest).comparable, 0);
});

test("unknown dates are explicit and never replaced by due dates", () => {
  const { person, episode, before, latest } = scenario();
  delete latest.submittedAt;
  const result = patientProgress(person, episode);
  assert.equal(result.latest.id, before.id);
  assert.equal(result.undated[0].id, latest.id);
  assert.match(
    compareResponses(person, before, latest).reason,
    /date is missing/,
  );
  assert.equal(responseDate({ submittedAt: "2026-02-31" }), null);
  assert.equal(responseDate({ submittedAt: "bad" }), null);
  assert.equal(responseDate({ submittedAt: "2026-09-15T12:31:00Z" }), TODAY);
});

test("different versions, identities and respondent roles cannot be compared", () => {
  const { person, before, latest } = scenario();
  assert.match(
    compareResponses(person, before, { ...latest, version: "Unknown" }).reason,
    /versions/,
  );
  assert.match(
    compareResponses(person, before, {
      ...latest,
      respondent: "Family respondent",
    }).reason,
    /respondents/,
  );
  assert.match(
    compareResponses(person, before, {
      ...latest,
      respondentName: "Another person",
    }).reason,
    /respondents/,
  );
  assert.match(
    compareResponses(
      person,
      { ...before, respondent: null },
      { ...latest, respondent: null },
    ).reason,
    /respondents/,
  );
  assert.match(
    compareResponses(
      person,
      { ...before, respondent: "Family respondent", respondentName: null },
      { ...latest, respondent: "Family respondent", respondentName: null },
    ).reason,
    /respondents/,
  );
});

test("the default baseline uses the earliest comparable response from the same respondent", () => {
  const { person, episode, before, latest } = scenario();
  episode.collections.push({
    ...before,
    id: "other-perspective",
    submittedAt: "2026-05-01",
    respondent: "Family respondent",
    respondentName: "A family member",
  });
  const result = patientProgress(person, episode);
  assert.equal(result.baseline.id, before.id);
  assert.equal(result.latest.id, latest.id);
});

test("same-date responses do not imply a longitudinal trend and drafts cannot be compared", () => {
  const { person, before, latest } = scenario();
  assert.match(
    compareResponses(person, before, {
      ...latest,
      submittedAt: before.submittedAt,
    }).reason,
    /earlier date/,
  );
  assert.match(
    compareResponses(person, before, { ...latest, response: "Draft" }).reason,
    /submitted/,
  );
  assert.match(
    compareResponses(person, null, latest).reason,
    /second submitted response/,
  );
});

test("next collection uses the earliest outstanding due date and excludes cancelled work", () => {
  const { person, episode, latest } = scenario();
  for (const [id, due, assignment] of [
    ["later", "2026-11-01", "Planned"],
    ["cancelled", "2026-08-01", "Cancelled"],
    ["next", "2026-09-12", "Active"],
  ]) {
    episode.collections.push({
      ...latest,
      id,
      due,
      assignment,
      response: "Not started",
      answers: [],
      review: "Pending",
    });
  }
  const result = patientProgress(person, episode);
  assert.equal(result.open[0].id, "next");
  assert.equal(result.open.length, 2);
  assert.equal(result.overdue.length, 1);
  assert.equal(result.responses.length, 2);
  episode.status = "Closed";
  assert.equal(patientProgress(person, episode).open.length, 0);
  episode.status = "Paused";
  assert.equal(patientProgress(person, episode).open.length, 0);
});

test("new, undated and single-response episodes have honest empty states", () => {
  const { person, episode, before } = scenario();
  episode.collections = [];
  let result = patientProgress(person, episode);
  assert.equal(result.latest, null);
  assert.equal(result.responses.length, 0);
  episode.collections = [{ ...before, submittedAt: undefined }];
  result = patientProgress(person, episode);
  assert.equal(result.latest, null);
  assert.equal(result.undated.length, 1);
  episode.collections = [before];
  assert.equal(patientProgress(person, episode).baseline, null);
});

test("same-day submissions stay selectable without implying their within-day order", () => {
  const { person, episode, latest, before } = scenario();
  episode.collections.push({
    ...latest,
    id: "same-day-followup",
    label: "Another check-in",
    answers: setQuestionAnswer(
      DEMO_INSTRUMENT,
      before.answers,
      23,
      "Let me ask any final questions",
    ),
  });
  const selected = patientProgress(person, episode, "same-day-followup");
  assert.equal(selected.latestOptions.length, 2);
  assert.equal(selected.latest.id, "same-day-followup");
  assert.equal(selected.baseline.id, before.id);
  assert.equal(
    compareResponses(person, selected.baseline, selected.latest).changed,
    1,
  );
  assert.equal(
    patientProgress(person, episode, latest.id).latest.id,
    latest.id,
  );
});

test("editing a reviewed response changes the comparison, retains the date, and requires re-review", () => {
  let { state, person, episode, latest } = scenario();
  const context = {
    personId: person.id,
    episodeId: episode.id,
    collectionId: latest.id,
  };
  state = reducer(state, {
    type: "REVIEW",
    ...context,
    note: "Discussed next steps.",
  });
  state = reducer(state, {
    type: "EDIT_RESPONSE",
    ...context,
    expectedRevision: 0,
    answers: setQuestionAnswer(
      DEMO_INSTRUMENT,
      latest.answers,
      23,
      "Let me ask any final questions",
    ),
    reason: "Corrected against sample source.",
  });
  person = state.people.find((p) => p.id === person.id);
  episode = person.episodes[0];
  const result = patientProgress(person, episode);
  assert.equal(result.latest.submittedAt, latest.submittedAt);
  assert.equal(result.latest.needsReview, true);
  assert.equal(result.pendingReviews.length, 1);
  assert.equal(
    compareResponses(
      person,
      { ...latest, id: "prior-latest", submittedAt: "2026-09-13" },
      result.latest,
    ).changed,
    1,
  );
});

test("questionnaire selection scopes responses, comparisons, reviews and follow-ups by version", () => {
  const { person, episode, before, latest } = scenario();
  const other = {
    ...before,
    id: "other-questionnaire",
    version: "Another questionnaire v1.0",
    submittedAt: "2026-09-16",
    reviewDate: "2026-09-16",
  };
  const pending = {
    ...latest,
    id: "other-follow-up",
    version: other.version,
    response: "Not started",
    review: "Pending",
  };
  const undated = { ...other, id: "other-undated", submittedAt: null };
  episode.collections.push(other, pending, undated);
  const result = questionnaireProgress(person, episode, latest.version);
  assert.deepEqual(result.questionnaires, [latest.version, other.version]);
  assert.equal(result.latest.id, latest.id);
  assert.equal(result.baseline.id, before.id);
  assert.equal(result.latestReview.id, before.id);
  assert.equal(result.responses.length, 2);
  assert.equal(result.undated.length, 0);
  assert.equal(result.open.length, 0);
  const switched = questionnaireProgress(
    person,
    episode,
    other.version,
    latest.id,
  );
  assert.equal(switched.latest.id, other.id);
  assert.equal(switched.baseline, null);
  assert.equal(switched.latestReview.id, other.id);
  assert.deepEqual(
    switched.open.map((c) => c.id),
    [pending.id],
  );
  assert.deepEqual(
    switched.undated.map((c) => c.id),
    [undated.id],
  );
  assert.equal(questionnaireProgress(person, episode).version, other.version);
  assert.equal(
    questionnaireProgress(person, episode, "Unavailable").version,
    other.version,
  );
});

test("questionnaire selection supports draft-only and unknown-version collections", () => {
  const { person, episode, latest } = scenario();
  episode.collections.push({
    ...latest,
    id: "draft-only",
    version: "Upcoming questionnaire v1.0",
    response: "Draft",
  });
  const draft = questionnaireProgress(
    person,
    episode,
    "Upcoming questionnaire v1.0",
  );
  assert.equal(draft.latest, null);
  assert.equal(draft.responses.length, 0);
  assert.equal(draft.open[0].id, "draft-only");
  episode.collections.push({
    ...latest,
    id: "unknown-version",
    version: null,
    submittedAt: null,
  });
  const unknown = questionnaireProgress(person, episode, "");
  assert.equal(unknown.latest, null);
  assert.equal(unknown.undated[0].id, "unknown-version");
  assert.equal(unknown.collections.length, 1);
  const empty = questionnaireProgress(person, { ...episode, collections: [] });
  assert.deepEqual(empty.questionnaires, []);
  assert.equal(empty.latest, null);
});
