import test from "node:test";
import assert from "node:assert/strict";
import { reducer } from "./model.js";
import { emptyDraftSeed as createSeed } from "./testFixtures.js";
import { getInstrument, questionnaireState } from "./instruments.js";
import { createSampleAnswers } from "./sampleQuestionnaires.js";
import { answerSession, contactContribution, sessionAnswerCounts, sessionContribution } from "./responseSessions.js";
import { assessmentsForContact, contactsForAssessment } from "./assessmentContacts.js";

const context = { personId: "YS-1024", episodeId: "EP-1024-01", collectionId: "A-0-current" };
const collection = (state) => state.people[0].episodes[0].collections.at(-1);
const deliver = (state, channel, assistance) => reducer(state, {
  ...context, type: "DELIVER", channel, assistance, respondent: "Person",
});

test("answers saved in one channel remain attributed to it after completion in another", () => {
  const started = deliver(createSeed(), "SMS link", "Independent");
  const instrument = getInstrument(collection(started).version);
  const complete = questionnaireState(instrument, createSampleAnswers({ participation: "In person" })).answers;
  const firstSession = collection(started).attempts.at(-1).id;
  const partial = complete.map((answer, index) => index < 2 ? answer : null);
  const saved = reducer(started, { ...context, type: "SAVE_RESPONSE_PROGRESS", channel: "SMS link", attemptId: firstSession, answers: partial });
  assert.equal(collection(saved).response, "Draft");
  assert.equal(collection(saved).draftAnswerSources[instrument.questions[0].id], firstSession);

  const resumed = deliver(saved, "Clinician entry", "Transcribed");
  const secondSession = collection(resumed).attempts.at(-1).id;
  assert.notEqual(firstSession, secondSession);
  assert.equal(reducer(resumed, { ...context, type: "SAVE_RESPONSE_PROGRESS", channel: "SMS link", attemptId: firstSession, answers: complete }), resumed);
  assert.equal(reducer(resumed, { ...context, type: "DELIVER", channel: "Clinic tablet", assistance: "Independent", respondent: "Family respondent" }), resumed);
  const submitted = reducer(resumed, { ...context, type: "SUBMIT", channel: "Clinician entry", attemptId: secondSession, answers: complete });
  const c = collection(submitted);
  assert.equal(c.response, "Submitted");
  assert.equal(c.submittedAttemptId, secondSession);
  assert.equal(answerSession(c, instrument.questions[0].id)?.channel, "SMS link");
  assert.equal(answerSession(c, instrument.questions[2].id)?.channel, "Clinician entry");
  assert.equal([...sessionAnswerCounts(c, instrument).values()].reduce((sum, count) => sum + count, 0),
    questionnaireState(instrument, c.answers).answered);
  const counts = sessionAnswerCounts(c, instrument);
  assert.deepEqual(sessionContribution(c, c.attempts.find((attempt) => attempt.id === firstSession), counts), {
    answerCount: counts.get(firstSession), status: "Partial",
  });
  assert.deepEqual(sessionContribution(c, c.attempts.find((attempt) => attempt.id === secondSession), counts), {
    answerCount: counts.get(secondSession),
    status: "Completed",
  });
  const linked = {
    ...c,
    attempts: c.attempts.map((attempt) => ({
      ...attempt,
      appointmentId: attempt.id === firstSession ? "contact-1" : attempt.id === secondSession ? "contact-2" : attempt.appointmentId,
    })),
  };
  assert.equal(contactContribution(linked, "contact-1", instrument).status, "Partial");
  assert.equal(contactContribution(linked, "contact-2", instrument).status, "Completed");
  assert.equal(contactContribution(linked, "contact-2", instrument).totalAnswers,
    questionnaireState(instrument, c.answers).total);
  assert.deepEqual(contactContribution(linked, "contact-3", instrument).methods, []);
  assert.equal(contactContribution(linked, "contact-3", instrument).status, "None");
});

test("changing a saved answer moves only that answer to the new session", () => {
  const first = deliver(createSeed(), "SMS link", "Independent");
  const instrument = getInstrument(collection(first).version);
  const complete = questionnaireState(instrument, createSampleAnswers({ participation: "In person" })).answers;
  const firstId = collection(first).attempts.at(-1).id;
  const saved = reducer(first, { ...context, type: "SAVE_RESPONSE_PROGRESS", channel: "SMS link", attemptId: firstId, answers: complete });
  const second = deliver(saved, "Clinician entry", "Transcribed");
  const changed = [...complete];
  const changeIndex = questionnaireState(instrument, complete).visible.at(-1).index;
  changed[changeIndex] = instrument.questions[changeIndex].options.find((option) => option !== complete[changeIndex]);
  const secondId = collection(second).attempts.at(-1).id;
  const submitted = reducer(second, { ...context, type: "SUBMIT", channel: "Clinician entry", attemptId: secondId, answers: changed });
  const c = collection(submitted);
  assert.equal(c.answerSources[instrument.questions[changeIndex].id], secondId);
  assert.equal(c.answerSources[instrument.questions[0].id], firstId);
});

test("Jordan's sample shows an SMS contact with partial answers before clinic completion", () => {
  const state = createSeed();
  const episode = state.people.find((person) => person.id === "YS-1034").episodes[0];
  const checkIn = episode.collections.find((item) => item.id === "A-7-life-care-twelve-weeks");
  const instrument = getInstrument(checkIn.version);
  const sms = episode.appointments.find((item) => item.id === "APT-7-sms-check-in");
  const clinic = episode.appointments.find((item) => item.id === "APT-7-twelve-weeks");

  assert.equal(sms.deliveryMode, "SMS");
  assert.equal(sms.attendance, "Attended");
  assert.equal(sms.actualDate, "2026-09-07");
  assert.equal(checkIn.submittedAt.slice(0, 10), "2026-09-08");
  assert.equal(contactContribution(checkIn, sms.id, instrument).status, "Partial");
  assert.equal(contactContribution(checkIn, sms.id, instrument).answerCount, 2);
  assert.equal(contactContribution(checkIn, clinic.id, instrument).status, "Completed");
  assert.equal(contactContribution(checkIn, clinic.id, instrument).answerCount, 4);
  assert.equal(contactContribution(checkIn, sms.id, instrument).totalAnswers, 6);
  assert.ok(contactsForAssessment(episode, checkIn.id).some((item) => item.id === sms.id));
  assert.ok(assessmentsForContact(episode, sms.id).some((item) => item.id === checkIn.id));
});
