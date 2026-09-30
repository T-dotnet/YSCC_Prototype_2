import test from "node:test";
import assert from "node:assert/strict";
import { createSeed, createDefaultWorkspace, getTasks, reducer } from "./model.js";
import { DEMO_INSTRUMENT } from "./instruments.js";
import { createSampleAnswers } from "./sampleQuestionnaires.js";

test("new sample workspaces use the selected assessment configuration", () => {
  const defaults = {
    simpleAssessments: true,
    scheduleAssessments: false,
    showAssessmentDueDates: true,
    groupAssessmentsByBundle: false,
    bundleAccordions: false,
    automaticAssessmentDueDates: false,
    assessmentScheduleRules: [],
    linkAssessmentAppointments: true,
    assessmentSms: true,
    uiColorSetup: 1,
  };
  assert.deepEqual(createSeed().settings, defaults);
  assert.deepEqual(reducer(createSeed(), { type: "RESET" }).settings, createDefaultWorkspace().settings);
});

test("simple assessments move from creation to draft to completion without a schedule or contact", () => {
  let state = createSeed();
  state = reducer(state, { type: "SET_ASSESSMENT_FEATURE", feature: "linkAssessmentAppointments", enabled: false });
  state = reducer(state, { type: "SET_ASSESSMENT_FEATURE", feature: "assessmentSms", enabled: true });
  const person = state.people.find((item) => item.id === "YS-1034");
  const context = { personId: person.id, episodeId: person.episodes[0].id, collectionId: "simple-assessment-test" };
  const collection = (current) => current.people.find((item) => item.id === context.personId)
    .episodes.find((item) => item.id === context.episodeId)
    .collections.find((item) => item.id === context.collectionId);

  state = reducer(state, { type: "SET_SIMPLE_ASSESSMENTS", enabled: true });
  state = reducer(state, {
    type: "PLAN", ...context, id: context.collectionId, label: "Simple assessment",
    due: "", version: DEMO_INSTRUMENT.version, respondent: "Person",
  });
  assert.equal(collection(state).response, "Not started");
  assert.equal(collection(state).due, "");
  assert.equal(collection(state).scheduleFree, true);
  assert.equal(collection(state).appointmentId, null);
  assert.ok(collection(state).createdAt);
  assert.equal(getTasks(state).find((task) => task.collection?.id === context.collectionId)?.status, "Not started");

  const linked = reducer(state, {
    type: "LINK_ASSESSMENT_CONTACT", ...context,
    appointmentId: person.episodes[0].appointments[0]?.id,
  });
  assert.equal(linked, state);

  const deliver = (current) => reducer(current, {
    type: "DELIVER", ...context, channel: "SMS link", respondent: "Person",
    assistance: "Independent", appointmentId: null,
  });
  state = deliver(state);
  let attempt = collection(state).attempts.at(-1);
  assert.equal(attempt.appointmentId, null);
  state = reducer(state, {
    type: "SAVE_RESPONSE_PROGRESS", ...context, channel: "SMS link",
    attemptId: attempt.id, answers: ["In person"], contactLink: { kind: "none" },
  });
  assert.equal(collection(state).response, "Draft");
  assert.equal(getTasks(state).find((task) => task.collection?.id === context.collectionId)?.status, "Draft");

  state = deliver(state);
  attempt = collection(state).attempts.at(-1);
  state = reducer(state, {
    type: "SUBMIT", ...context, channel: "SMS link", attemptId: attempt.id,
    answers: createSampleAnswers({
      participation: "In person", support: "A little support", next: "My next steps",
    }),
  });
  assert.equal(collection(state).response, "Submitted");
  assert.equal(collection(state).submittedAppointmentId, null);
  assert.equal(getTasks(state).some((task) => task.collection?.id === context.collectionId), false);

  state = reducer(state, { type: "SET_SIMPLE_ASSESSMENTS", enabled: false });
  assert.equal(collection(state).scheduleFree, true);
});

test("simple tablet drafts and completions save confirmed assistance", () => {
  let state = reducer(createSeed(), { type: "SET_SIMPLE_ASSESSMENTS", enabled: true });
  state = reducer(state, { type: "SET_ASSESSMENT_FEATURE", feature: "linkAssessmentAppointments", enabled: false });
  const context = { personId: "YS-1034", episodeId: "EP-1034-01", collectionId: "simple-tablet-assistance" };
  const collection = (current) => current.people.find((item) => item.id === context.personId)
    .episodes.find((item) => item.id === context.episodeId)
    .collections.find((item) => item.id === context.collectionId);
  state = reducer(state, {
    type: "PLAN", ...context, id: context.collectionId, label: "Tablet check-in",
    due: "", version: DEMO_INSTRUMENT.version, respondent: "Person",
  });
  const deliver = (current) => reducer(current, {
    type: "DELIVER", ...context, channel: "Clinic tablet", respondent: "Person",
    assistance: "Independent", appointmentId: null,
  });
  state = deliver(state);
  let attempt = collection(state).attempts.at(-1);
  const draftAction = {
    type: "SAVE_RESPONSE_PROGRESS", ...context, channel: "Clinic tablet", attemptId: attempt.id,
    answers: ["In person"], contactLink: { kind: "none" }, completionMethod: "Clinic tablet",
  };
  assert.equal(reducer(state, { ...draftAction, assistance: "Assisted" }), state);
  state = reducer(state, { ...draftAction, assistance: "Supported" });
  assert.equal(collection(state).response, "Draft");
  assert.equal(collection(state).assistance, "Supported");
  assert.equal(collection(state).attempts.at(-1).assistance, "Supported");
  assert.ok(collection(state).attempts.at(-1).assistanceConfirmedAt);

  state = deliver(state);
  attempt = collection(state).attempts.at(-1);
  const submitAction = {
    type: "SUBMIT", ...context, channel: "Clinic tablet", attemptId: attempt.id,
    answers: createSampleAnswers({ participation: "In person" }),
  };
  assert.equal(reducer(state, { ...submitAction, assistance: "Assisted" }), state);
  state = reducer(state, { ...submitAction, assistance: "Independent" });
  assert.equal(collection(state).response, "Submitted");
  assert.equal(collection(state).assistance, "Independent");
  assert.equal(collection(state).attempts.at(-1).assistance, "Independent");
  assert.ok(collection(state).attempts.at(-1).assistanceConfirmedAt);
});
