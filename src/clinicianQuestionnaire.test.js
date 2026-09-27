import test from "node:test";
import assert from "node:assert/strict";
import {
  reducer,
  getTasks,
  collectionActor,
  TODAY,
} from "./model.js";
import { emptyDraftSeed as createSeed } from "./testFixtures.js";
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

test("clinician and tablet completion save a confirmed linked appointment outcome with the response", () => {
  for (const channel of ["Clinician entry", "Clinic tablet"]) {
    const appointmentId = `APT-completion-${channel}`;
    const withAppointment = reducer(createSeed(), {
      type: "ADD_APPOINTMENT",
      personId: context.personId,
      episodeId: context.episodeId,
      id: appointmentId,
      plannedDate: TODAY,
      plannedTime: "10:00",
      plannedDurationMinutes: 60,
      practitionerService: "Jess Taylor · Northside Centre",
      deliveryMode: "In person",
      attendance: "Planned",
    });
    const started = begin(withAppointment, {
      channel,
      assistance: channel === "Clinic tablet" ? "Independent" : "Transcribed",
      appointmentId,
    });
    const submitAction = {
      ...submission(started),
      channel,
      completionMethod: channel,
      appointmentOutcome: {
        appointmentId,
        attendance: "Attended",
        recipientType: "Young person",
        contactType: "Assessment",
        primaryPractitioner: "Jess Taylor",
        actualDate: TODAY,
        actualTime: "10:00",
        actualDurationMinutes: 60,
      },
    };
    const invalid = reducer(started, {
      ...submitAction,
      appointmentOutcome: {
        ...submitAction.appointmentOutcome,
        actualDurationMinutes: 0,
      },
    });
    assert.equal(invalid, started);
    const saved = reducer(started, submitAction);
    const appointment = saved.people[0].episodes[0].appointments.find(
      (item) => item.id === appointmentId,
    );
    assert.equal(collection(saved).response, "Submitted");
    assert.equal(collection(saved).submittedAppointmentId, appointmentId);
    assert.equal(appointment.attendance, "Attended");
    assert.equal(appointment.actualDate, TODAY);
    assert.equal(appointment.contactType, "Assessment");
    assert.equal(
      collection(saved).attempts.at(-1).methodConfirmedBy,
      "Jess Taylor",
    );

    const correctedMethod =
      channel === "Clinic tablet" ? "Clinician entry" : "Clinic tablet";
    const corrected = reducer(started, {
      ...submitAction,
      completionMethod: correctedMethod,
    });
    const correctedCollection = collection(corrected);
    assert.equal(correctedCollection.channel, correctedMethod);
    assert.equal(correctedCollection.attempts.at(-1).startedChannel, channel);
    assert.equal(
      correctedCollection.recorderName,
      correctedMethod === "Clinician entry" ? "Jess Taylor" : "Kai Thompson",
    );
    assert.equal(
      correctedCollection.review,
      correctedMethod === "Clinician entry" ? "Not required" : "Pending",
    );

    const didNotAttend = reducer(started, {
      ...submitAction,
      appointmentOutcome: {
        appointmentId,
        attendance: "Did not attend",
        outcomeNotes: "Contact did not take place",
      },
    });
    assert.equal(collection(didNotAttend).response, "Submitted");
    assert.equal(
      didNotAttend.people[0].episodes[0].appointments.find(
        (item) => item.id === appointmentId,
      ).attendance,
      "Did not attend",
    );
  }
});

test("completion confirms the collection method without a linked appointment", () => {
  const seed = createSeed();
  seed.people[0].episodes[0].appointments = [];
  const started = begin(seed);
  const saved = reducer(started, {
    ...submission(started),
    completionMethod: "Clinic tablet",
  });
  assert.equal(collection(saved).response, "Submitted");
  assert.equal(collection(saved).channel, "Clinic tablet");
  assert.equal(collection(saved).submittedAppointmentId, null);
  assert.equal(
    collection(saved).attempts.at(-1).startedChannel,
    "Clinician entry",
  );
});

test("completion can use another attended contact without changing its outcome", () => {
  const seed = createSeed();
  const episode = seed.people[0].episodes[0];
  episode.appointments.push({
    id: "APT-already-attended", attendance: "Attended", actualDate: TODAY,
    plannedDate: TODAY, plannedTime: "09:00", actualTime: "09:00",
    plannedDurationMinutes: 30, actualDurationMinutes: 30,
    practitionerService: "Northside Centre", primaryPractitioner: "Jess Taylor",
    deliveryMode: "Clinic tablet", recipientType: "Young person", contactType: "Assessment",
  });
  const started = begin(seed);
  const saved = reducer(started, {
    ...submission(started), completionMethod: "Clinician entry",
    contactLink: { kind: "existing", appointmentId: "APT-already-attended" },
  });
  assert.equal(collection(saved).submittedAppointmentId, "APT-already-attended");
  assert.equal(collection(saved).attempts.at(-1).appointmentId, "APT-already-attended");
  assert.equal(saved.people[0].episodes[0].appointments.length, episode.appointments.length);
  assert.equal(reducer(started, {
    ...submission(started), contactLink: { kind: "existing", appointmentId: "missing" },
  }), started);
});

test("completion can create a new attended contact with the response", () => {
  const started = begin(createSeed());
  const contact = {
    attendance: "Attended", plannedDate: TODAY, actualDate: TODAY,
    plannedTime: "11:30", actualTime: "11:30",
    plannedDurationMinutes: 40, actualDurationMinutes: 40,
    practitionerService: "Northside Centre", primaryPractitioner: "Jess Taylor",
    deliveryMode: "Clinician entry", recipientType: "Young person", contactType: "Assessment",
  };
  const invalid = reducer(started, {
    ...submission(started), completionMethod: "Clinician entry",
    contactLink: { kind: "new", contact: { ...contact, actualDate: "2030-01-01" } },
  });
  assert.equal(invalid, started);
  const saved = reducer(started, {
    ...submission(started), completionMethod: "Clinician entry",
    contactLink: { kind: "new", contact },
  });
  const id = collection(saved).submittedAppointmentId;
  const recorded = saved.people[0].episodes[0].appointments.find((item) => item.id === id);
  assert.equal(collection(saved).response, "Submitted");
  assert.equal(recorded.attendance, "Attended");
  assert.equal(recorded.deliveryMode, "Clinician entry");
  assert.equal(collection(saved).attempts.at(-1).appointmentId, id);
});

test("a planned contact must have an attended outcome before completion links it", () => {
  const seed = reducer(createSeed(), {
    type: "ADD_APPOINTMENT", personId: context.personId, episodeId: context.episodeId,
    id: "APT-planned-completion", plannedDate: TODAY, plannedTime: "12:00",
    plannedDurationMinutes: 45, practitionerService: "Northside Centre",
    deliveryMode: "In person", attendance: "Planned",
  });
  const started = begin(seed, { appointmentId: "APT-planned-completion" });
  const base = { ...submission(started), completionMethod: "Clinician entry",
    contactLink: { kind: "existing", appointmentId: "APT-planned-completion" } };
  assert.equal(reducer(started, base), started);
  const saved = reducer(started, { ...base, appointmentOutcome: {
    appointmentId: "APT-planned-completion", attendance: "Attended",
    recipientType: "Young person", contactType: "Assessment",
    primaryPractitioner: "Jess Taylor", actualDate: TODAY,
    actualTime: "12:10", actualDurationMinutes: 45,
  } });
  assert.equal(collection(saved).response, "Submitted");
  assert.equal(saved.people[0].episodes[0].appointments.find((item) => item.id === "APT-planned-completion").actualTime, "12:10");
});
