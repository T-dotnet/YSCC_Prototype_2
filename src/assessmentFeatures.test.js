import test from "node:test";
import assert from "node:assert/strict";
import { createSeed, reducer, TODAY, upgradeSampleData } from "./model.js";
import { DEMO_INSTRUMENT } from "./instruments.js";
import {
  assessmentSchedulingEnabled,
  assessmentDueDatesEnabled,
  assessmentContactLinkingEnabled,
  assessmentSmsEnabled,
  assessmentHistoryEntryVisible,
} from "./assessmentFeatures.js";

const context = { personId: "YS-1034", episodeId: "EP-1034-01" };
const episode = (state) => state.people.find((person) => person.id === context.personId)
  .episodes.find((item) => item.id === context.episodeId);
const plan = (state, id, extra = {}) => reducer(state, {
  type: "PLAN", ...context, id, label: id, version: DEMO_INSTRUMENT.version,
  respondent: "Person", ...extra,
});
const feature = (state, name, enabled) => reducer(state, {
  type: "SET_ASSESSMENT_FEATURE", feature: name, enabled,
});

test("assessment feature switches persist across simplified and full views", () => {
  let state = createSeed();
  assert.equal(assessmentSchedulingEnabled(state.settings), false);
  assert.equal(assessmentContactLinkingEnabled(state.settings), true);
  assert.equal(assessmentSmsEnabled(state.settings), false);
  state = feature(state, "scheduleAssessments", true);
  state = feature(state, "linkAssessmentAppointments", false);
  state = feature(state, "assessmentSms", true);
  state = reducer(state, { type: "SET_SIMPLE_ASSESSMENTS", enabled: false });
  assert.deepEqual(state.settings, {
    simpleAssessments: false,
    scheduleAssessments: true,
    showAssessmentDueDates: true,
    automaticAssessmentDueDates: false,
    assessmentScheduleRules: [],
    linkAssessmentAppointments: false,
    assessmentSms: true,
    uiColorSetup: 1,
  });
  state = reducer(state, { type: "SET_SIMPLE_ASSESSMENTS", enabled: true });
  assert.equal(state.settings.scheduleAssessments, true);
  assert.equal(state.settings.linkAssessmentAppointments, false);
  assert.equal(state.settings.assessmentSms, true);
  assert.deepEqual(upgradeSampleData(state).settings, state.settings);
});

test("turning a feature off hides its earlier history without deleting it", () => {
  const entries = [
    { title: "Follow-up planned", detail: "Assessment due tomorrow" },
    { title: "Assessment contact linked", detail: "Linked to a visit" },
    { title: "SMS link sent", detail: "Sample delivery", channel: "SMS link" },
  ];
  const settings = { scheduleAssessments: false, linkAssessmentAppointments: false, assessmentSms: false };
  assert.deepEqual(entries.map((entry) => assessmentHistoryEntryVisible(entry, settings)), [false, false, false]);
  assert.deepEqual(entries.map((entry) => assessmentHistoryEntryVisible(entry, {
    scheduleAssessments: true, linkAssessmentAppointments: true, assessmentSms: true,
  })), [true, true, true]);
});

test("scheduling off blocks new planned and future contacts but allows recording past contacts", () => {
  const state = createSeed();
  const contact = {
    type: "ADD_APPOINTMENT", ...context, id: "APT-scheduling-switch",
    plannedDate: TODAY, plannedTime: "10:00", plannedDurationMinutes: 30,
    practitionerService: "Northside Centre", deliveryMode: "Phone",
    attendance: "Cancelled",
  };
  assert.equal(reducer(state, { ...contact, attendance: "Planned" }), state);
  assert.equal(reducer(state, { ...contact, plannedDate: "2026-10-20" }), state);
  const recorded = reducer(state, contact);
  assert.ok(episode(recorded).appointments.some((item) => item.id === contact.id));
  const enabled = feature(state, "scheduleAssessments", true);
  const planned = reducer(enabled, { ...contact, attendance: "Planned" });
  assert.ok(episode(planned).appointments.some((item) => item.id === contact.id));
});

test("due-date visibility persists independently and never enables future booking", () => {
  for (const simpleAssessments of [true, false]) {
    let state = reducer(createSeed(), { type: "SET_SIMPLE_ASSESSMENTS", enabled: simpleAssessments });
    assert.equal(assessmentDueDatesEnabled(state.settings), true);
    state = feature(state, "showAssessmentDueDates", false);
    state = feature(state, "showAssessmentDueDates", true);
    assert.equal(assessmentDueDatesEnabled(state.settings), true);
    assert.equal(assessmentSchedulingEnabled(state.settings), false);
    const contact = {
      type: "ADD_APPOINTMENT", ...context, id: "APT-due-display",
      plannedDate: "2099-10-20", plannedTime: "10:00", plannedDurationMinutes: 30,
      practitionerService: "Northside Centre", deliveryMode: "Phone", attendance: "Planned",
    };
    assert.equal(reducer(state, contact), state);
    assert.equal(reducer(state, { ...contact, attendance: "Cancelled" }), state);
    assert.equal(reducer(state, { ...contact, plannedDate: TODAY }), state);
    assert.deepEqual(upgradeSampleData(state).settings, state.settings);
    assert.equal(assessmentDueDatesEnabled(feature(state, "showAssessmentDueDates", false).settings), false);
  }
});

test("old saved settings migrate due visibility on without changing booking permissions", () => {
  const state = createSeed();
  delete state.settings.showAssessmentDueDates;
  const upgraded = upgradeSampleData(state);
  assert.equal(upgraded.settings.showAssessmentDueDates, true);
  assert.equal(upgraded.settings.scheduleAssessments, false);
});

for (const simpleAssessments of [true, false]) {
  test(`scheduling switch controls due dates in ${simpleAssessments ? "simplified" : "full"} view`, () => {
    let state = reducer(createSeed(), { type: "SET_SIMPLE_ASSESSMENTS", enabled: simpleAssessments });
    assert.equal(plan(state, "blocked-due", { due: TODAY }), state);
    state = plan(state, "immediate", { due: "" });
    assert.equal(episode(state).collections.find((item) => item.id === "immediate")?.scheduleFree, true);
    state = feature(state, "scheduleAssessments", true);
    assert.equal(plan(state, "blocked-immediate", { due: "" }), state);
    state = plan(state, "scheduled", { due: TODAY });
    const scheduled = episode(state).collections.find((item) => item.id === "scheduled");
    assert.equal(scheduled?.due, TODAY);
    assert.equal(scheduled?.scheduleFree, false);
  });

  test(`appointment linking works independently in ${simpleAssessments ? "simplified" : "full"} view`, () => {
    let state = reducer(createSeed(), { type: "SET_SIMPLE_ASSESSMENTS", enabled: simpleAssessments });
    state = feature(state, "linkAssessmentAppointments", false);
    state = plan(state, "unlinked", { due: "" });
    const appointmentId = episode(state).appointments[0].id;
    const link = { type: "LINK_ASSESSMENT_CONTACT", ...context, collectionId: "unlinked", appointmentId };
    assert.equal(reducer(state, link), state);
    state = feature(state, "linkAssessmentAppointments", true);
    state = reducer(state, link);
    assert.ok(episode(state).assessmentContactLinks.some((item) =>
      item.collectionId === "unlinked" && item.appointmentId === appointmentId));
    state = feature(state, "linkAssessmentAppointments", false);
    assert.ok(episode(state).assessmentContactLinks.some((item) => item.collectionId === "unlinked"));
  });

  test(`SMS switch controls new assessment delivery in ${simpleAssessments ? "simplified" : "full"} view`, () => {
    let state = reducer(createSeed(), { type: "SET_SIMPLE_ASSESSMENTS", enabled: simpleAssessments });
    state = plan(state, "sms-toggle", { due: "" });
    const delivery = { type: "DELIVER", ...context, collectionId: "sms-toggle",
      channel: "SMS link", respondent: "Person", assistance: "Independent" };
    state = feature(state, "assessmentSms", false);
    assert.equal(reducer(state, delivery), state);
    state = feature(state, "assessmentSms", true);
    state = reducer(state, delivery);
    assert.equal(episode(state).collections.find((item) => item.id === "sms-toggle")?.attempts.at(-1).channel, "SMS link");
  });
}
