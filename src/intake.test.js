import test from "node:test";
import assert from "node:assert/strict";
import {
  createSeed,
  reducer,
  getTasks,
  upgradeSampleData,
  TODAY,
} from "./model.js";
import {
  canAssess,
  intakeReady,
  intakeActionError,
  INTAKE_CHECKS,
} from "./intake.js";
import { ownedTasks, taskHref } from "./workflow.js";

const registration = {
  type: "ADD_PERSON",
  name: "Alex Intake Test",
  requestId: "registration-1",
  owner: "Jess Taylor",
  nextAction: "Complete intake",
  reviewDate: TODAY,
};
const registered = () => reducer(createSeed(), registration);
const person = (s) => s.people.at(-1);
const save = (s, values = {}) =>
  reducer(s, {
    type: "SAVE_INTAKE",
    personId: person(s).id,
    intakeId: person(s).intakes[0].id,
    revision: person(s).intakes[0].revision,
    values: {
      ...person(s).intakes[0],
      changeReason: "Reviewed sample intake",
      ...values,
    },
  });
const complete = (s, outcome = "Proceed") =>
  save(s, {
    status: "Completed",
    outcome,
    consentRecorded: true,
    consentReference: "Demo consent record",
    respondentPreference: "Person",
    ...Object.fromEntries(INTAKE_CHECKS.map(([key]) => [key, true])),
    checkEvidence: "Fictional source checked",
    summary: "Sample intake reviewed",
    decisionAt: "2026-09-15T10:00",
    assessmentOwner: "Jess Taylor",
  });
const start = (s) =>
  reducer(s, {
    type: "START_ASSESSMENT",
    personId: person(s).id,
    intakeId: person(s).intakes[0].id,
    revision: person(s).intakes[0].revision,
    due: TODAY,
  });
const reopen = (s) =>
  reducer(s, {
    type: "REOPEN_INTAKE",
    personId: person(s).id,
    intakeId: person(s).intakes[0].id,
    revision: person(s).intakes[0].revision,
  });
const addReferral = (s) =>
  reducer(s, {
    type: "ADD_REFERRAL",
    personId: person(s).id,
    intakeId: person(s).intakes[0].id,
    episodeId: person(s).episodes[0]?.id,
    requestId: "referral-1",
    values: {
      destination: "Sample support service",
      purpose: "Agreed further support",
      owner: "Jess Taylor",
      reviewDate: TODAY,
      nextAction: "Check receipt",
    },
  });
const referralEvent = (s, kind, fields = {}) =>
  reducer(s, {
    type: "REFERRAL_EVENT",
    personId: person(s).id,
    referralId: person(s).referrals[0].id,
    revision: person(s).referrals[0].revision,
    values: {
      kind,
      occurredAt: "2026-09-15T11:00",
      system: "External sample system",
      evidence: "Fictional reference 123",
      nextAction: "Check the next step",
      owner: "Jess Taylor",
      reviewDate: TODAY,
      permissionReference: "Demo permission",
      permittedInformation: "Agreed referral summary",
      ...fields,
    },
  });

test("AC-23: registration creates an owned intake with unknown DOB and no episode or assessment", () => {
  const s = registered(),
    p = person(s);
  assert.equal(p.dob, null);
  assert.equal(p.episodes.length, 0);
  assert.equal(p.intakes[0].status, "Received");
  assert.equal(p.consent, "Not recorded");
  assert.equal(intakeReady(p.intakes[0]), false);
  assert.equal(start(s), s);
  assert.equal(
    reducer(s, { type: "PLAN", personId: p.id, label: "Bypass", due: TODAY }),
    s,
  );
  assert.equal(getTasks(s).filter((t) => t.person.id === p.id).length, 1);
  assert.match(
    taskHref(
      getTasks(s).find((t) => t.kind === "intake"),
      "/",
    ),
    /tab=intake/,
  );
});
test("AC-24: partial save works; required checks, waiting ownership and non-proceeding states block progression", () => {
  const s = registered();
  assert.equal(save(s, { status: "Completed", outcome: "Proceed" }), s);
  assert.equal(
    save(s, { status: "Waiting", waitingReason: "", waitingOn: "" }),
    s,
  );
  const closed = save(s, {
    status: "Closed incomplete",
    summary: "Unable to finish; agreed support route retained",
  });
  assert.notEqual(closed, s);
  assert.equal(start(closed), closed);
  const stopped = complete(s, "Do not proceed");
  assert.equal(start(stopped), stopped);
  assert.equal(person(stopped).intakes[0].outcome, "Do not proceed");
});
test("consent and an initial respondent are required before intake can complete", () => {
  const s = registered();
  const withoutConsent = save(s, {
    status: "Completed",
    outcome: "Proceed",
    ...Object.fromEntries(INTAKE_CHECKS.map(([key]) => [key, true])),
    checkEvidence: "Fictional source checked",
    summary: "Sample intake reviewed",
    decisionAt: "2026-09-15T10:00",
    assessmentOwner: "Jess Taylor",
    respondentPreference: "Person",
  });
  assert.equal(
    withoutConsent,
    s,
    "completion stays blocked until consent is recorded",
  );
  const done = complete(s);
  assert.notEqual(done, s);
  assert.equal(person(done).consent, "Recorded");
  assert.equal(intakeReady(person(done).intakes[0]), true);
});
test("AC-25: waiting resumes with history; proceed leaves an owned assessment queue until explicit planning", () => {
  const waiting = save(registered(), {
    status: "Awaiting information",
    waitingReason: "Source needs checking",
    waitingOn: "Referring service",
  });
  assert.equal(
    person(waiting).intakes[0].history[0].snapshot.history,
    undefined,
  );
  const resumed = save(waiting, {
    status: "In progress",
    changeReason: "Information received",
  });
  const done = complete(resumed);
  assert.equal(person(done).episodes.length, 0);
  assert.ok(
    getTasks(done).some(
      (t) =>
        t.person.id === person(done).id &&
        t.status === "Waiting for assessment",
    ),
  );
  const planned = start(done),
    p = person(planned);
  assert.equal(p.episodes.length, 1);
  assert.equal(p.episodes[0].collections.length, 1);
  assert.equal(p.episodes[0].disposition, "Undecided");
  assert.ok(canAssess(p, p.episodes[0]));
  assert.equal(p.intakes[0].history.length, 5);
  assert.equal(start(planned), planned);
  assert.equal(
    getTasks(planned).filter((t) => t.person.id === p.id && t.kind === "intake")
      .length,
    0,
  );
});
test("a completed intake can be reopened before assessment planning while retaining its decision history", () => {
  const completed = complete(registered());
  const reopened = reopen(completed);
  const intake = person(reopened).intakes[0];
  assert.notEqual(reopened, completed);
  assert.equal(intake.status, "In progress");
  assert.equal(intake.outcome, "");
  assert.equal(intake.decisionAt, "");
  assert.equal(intake.decisionBy, "");
  assert.equal(intake.history[0].title, "Intake reopened");
  assert.equal(intake.history[1].title, "Intake completed");
  assert.equal(start(reopened), reopened);
  assert.equal(reopen(reopened), reopened);
});
test("AC-26/27: external sending failures, retries, receipt, decision and handover remain separate after episode closure", () => {
  let s = addReferral(start(complete(registered())));
  s = referralEvent(s, "Sending attempt", { result: "Failed" });
  assert.equal(person(s).referrals[0].receipt, "Unconfirmed");
  assert.ok(
    getTasks(s).some(
      (t) => t.kind === "referral" && t.status === "Sending failed",
    ),
  );
  s = referralEvent(s, "Sending attempt", { result: "Sent" });
  assert.equal(person(s).referrals[0].attempts.length, 2);
  s = referralEvent(s, "Receipt acknowledged");
  assert.equal(person(s).referrals[0].decision, "Pending");
  s = referralEvent(s, "Accepted");
  assert.ok(getTasks(s).some((t) => t.kind === "referral"));
  assert.equal(
    referralEvent(s, "Handover confirmed", { plan: "Agreed support" }),
    s,
  );
  s = reducer(s, {
    type: "EPISODE",
    personId: person(s).id,
    episodeId: person(s).episodes[0].id,
    status: "Closed",
    reason: "Transfer",
    end: TODAY,
    closureCategory: "Transferred or handed over",
    handoverStatus: "Confirmed",
    handoverDestination: "Sample receiving service",
    receivingResponsiblePerson: "Receiving service team",
    handoverConfirmedAt: "2026-09-15T11:00",
    handoverConfirmationReference: "Sample receiving service confirmation",
    finalMeasureStatus: "Outstanding",
    nextCareStep: "Referral remains owned",
    nextCareOwner: "Jess Taylor",
    unresolvedReferralRule: "Reconciliation task required",
    referralReconciliationOwner: "Jess Taylor",
    referralReconciliationDue: TODAY,
    referralReconciliationAction: "Verify receiving-service responsibility through the agreed channel",
  });
  assert.ok(
    ownedTasks(getTasks(s), s, "me").some((t) => t.kind === "referral"),
  );
  assert.equal(
    person(s).episodes[0].referralReconciliation.status,
    "Required",
  );
  assert.equal(
    person(s).referrals[0].closureReconciliation.owner,
    "Jess Taylor",
  );
  assert.equal(
    person(s).referrals[0].history[0].title,
    "Closure reconciliation assigned",
  );
  s = referralEvent(s, "Handover confirmed", {
    externalOwner: "Receiving service team",
    receivingResponsibility: "Confirmed",
    plan: "Receiving team confirmed responsibility and the next contact",
  });
  assert.equal(getTasks(s).filter((t) => t.kind === "referral").length, 0);
  assert.equal(person(s).referrals[0].receivingResponsibility, "Confirmed");
  assert.equal(
    person(s).referrals[0].handoverConfirmedAt,
    "2026-09-15T11:00",
  );
  assert.equal(
    person(s).referrals[0].history[0].system,
    "External sample system",
  );
});
test("Unknown sending outcomes require verification before retry; acceptance does not fabricate receipt", () => {
  let s = referralEvent(addReferral(registered()), "Sending attempt", {
    result: "Outcome unknown",
  });
  assert.equal(referralEvent(s, "Sending attempt", { result: "Sent" }), s);
  s = referralEvent(s, "Verify sending outcome", { result: "Failed" });
  assert.equal(person(s).referrals[0].attempts[0].result, "Outcome unknown");
  s = referralEvent(s, "Sending attempt", { result: "Sent" });
  s = referralEvent(s, "Accepted");
  assert.equal(person(s).referrals[0].receipt, "Unconfirmed");
  s = referralEvent(s, "Declined");
  assert.ok(getTasks(s).some((t) => t.kind === "referral"));
  s = referralEvent(s, "Alternative plan", {
    plan: "Agreed alternative with a named owner",
  });
  assert.equal(getTasks(s).filter((t) => t.kind === "referral").length, 0);
});
test("AC-28: ongoing reviews stay in the same episode; gates are checked again at plan/deliver/submit boundaries", () => {
  const s = start(complete(registered())),
    p = person(s),
    ep = p.episodes[0],
    c = ep.collections[0];
  const planned = reducer(s, {
    type: "PLAN",
    personId: p.id,
    episodeId: ep.id,
    label: "Follow-up",
    due: "2026-12-15",
  });
  assert.equal(person(planned).episodes.length, 1);
  assert.equal(person(planned).intakes.length, 1);
  for (const outcome of ["Do not proceed", ""]) {
    const blocked = structuredClone(s);
    person(blocked).intakes[0].outcome = outcome;
    person(blocked).consent = "Recorded";
    person(blocked).contact = "Suitable";
    for (const type of ["PLAN", "DELIVER", "SUBMIT"])
      assert.equal(
        reducer(blocked, {
          type,
          personId: p.id,
          episodeId: ep.id,
          collectionId: c.id,
          label: "Bypass",
          due: TODAY,
          channel: "Clinic tablet",
          respondent: "Person",
          assistance: "Independent",
          answers: ["In person", "A little support", "My next steps"],
        }),
        blocked,
      );
  }
});
test("AC-29: duplicate registration, repeated save and stale intake revisions do not create more records", () => {
  const s = registered();
  assert.equal(reducer(s, registration), s);
  assert.equal(reducer(s, { ...registration, requestId: "other" }), s);
  const changed = save(s, { status: "In progress" });
  assert.equal(
    reducer(changed, {
      type: "SAVE_INTAKE",
      personId: person(s).id,
      intakeId: person(s).intakes[0].id,
      revision: 0,
      values: { ...person(s).intakes[0], changeReason: "Stale" },
    }),
    changed,
  );
  const unnamed = reducer(s, {
    ...registration,
    requestId: "unknown",
    name: "",
    nameUnknown: true,
  });
  assert.equal(person(unnamed).nameUnknown, true);
});
test("Migration preserves saved assessments and adds pending intake for earlier custom registrations", () => {
  const s = createSeed(),
    custom = structuredClone(s.people[0]);
  custom.id = "YS-1100";
  custom.name = "Earlier custom record";
  delete custom.intakes;
  delete custom.referrals;
  s.people.push(custom);
  s.sampleRevision = 4;
  delete s.intakeRevision;
  const migrated = upgradeSampleData(s),
    p = person(migrated);
  assert.deepEqual(p.episodes, custom.episodes);
  assert.equal(p.intakes[0].status, "Awaiting information");
  assert.equal(canAssess(p, p.episodes[0]), false);
  assert.equal(upgradeSampleData(migrated), migrated);
});
test("legacy mock records with a completed intake are upgraded for assessment work", () => {
  const legacy = createSeed();
  const mia = legacy.people.find((item) => item.name === "Mia Robinson");
  legacy.intakeRevision = 2;
  mia.intakes[0].consentRecorded = false;
  mia.intakes[0].consentReference = "";
  const upgraded = upgradeSampleData(legacy);
  const migratedMia = upgraded.people.find(
    (item) => item.name === "Mia Robinson",
  );
  assert.equal(upgraded.intakeRevision, 3);
  assert.equal(migratedMia.intakes[0].consentRecorded, true);
  assert.ok(canAssess(migratedMia, migratedMia.episodes[0]));
});
test("Only the sample clinician can record a triage decision; malformed dates fail closed", () => {
  const s = registered();
  s.staffId = "ananya";
  assert.equal(complete(s), s);
  assert.match(
    intakeActionError(
      createSeed(),
      { ...registration, reviewDate: "2026-02-31" },
      { name: "Jess", role: "Clinician" },
    ),
    /review date/,
  );
});

test("Information arriving during intake updates unknown identity and retains its earlier values", () => {
  const s = registered();
  const next = save(s, {
    displayName: "Alex Morgan",
    dob: "2009-01-02",
    sourceReference: "Fictional referral",
  });
  assert.equal(person(next).name, "Alex Morgan");
  assert.equal(person(next).dob, "2009-01-02");
  assert.equal(person(next).intakes[0].history[0].priorIdentity.dob, "Unknown");
  assert.equal(save(next, { displayName: "Kai Thompson" }), next);
  assert.equal(save(next, { dob: "2026-02-31" }), next);
});
