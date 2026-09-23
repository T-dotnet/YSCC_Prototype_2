import test from "node:test";
import assert from "node:assert/strict";
import { activityEntries, changeLogEntries } from "./activity.js";
import { appointmentDetails } from "./appointments.js";
import { carePeriodAt, currentCarePeriod } from "./carePeriods.js";
import { historyCategory, historyDate, historyItem } from "./historyItem.js";
import { createSeed, reducer, TODAY, upgradeSampleData } from "./model.js";

const context = { personId: "YS-1024", episodeId: "EP-1024-01" };
const initial = {
  ...context,
  type: "SET_INITIAL_CARE_LEVEL",
  careLevel: "Mid",
  programStream: "General",
  deliveringUnit: "Northside Centre",
};
const change = {
  ...context,
  type: "CHANGE_CARE_LEVEL",
  effectiveDate: "2026-09-12",
  careLevel: "High",
  deliveringUnit: "Northside outreach pod",
  entryReason: "Change in care needs",
  authorisingPractitionerId: "jess",
  triggeringReviewId: "",
};
const episode = (state) => state.people[0].episodes[0];
const unlevelledSeed = () => {
  const state = createSeed();
  delete episode(state).carePeriods;
  return state;
};

test("fictional episodes receive dated starting levels without replacing recorded changes", () => {
  const seed = createSeed();
  for (const person of seed.people) {
    for (const item of person.episodes) {
      if (person.id === "YS-1024" || person.id === "YS-1034") {
        assert.ok(item.carePeriods?.length);
        assert.equal(item.carePeriods[0].startDate, item.start);
      }
    }
  }
  const existing = reducer(seed, change);
  const upgraded = upgradeSampleData(existing);
  assert.deepEqual(episode(upgraded).carePeriods, episode(existing).carePeriods);
});

test("a level change closes one care period and starts another in the same episode", () => {
  const seed = unlevelledSeed();
  assert.equal(episode(seed).carePeriods, undefined);
  const started = reducer(seed, initial);
  const next = reducer(started, change);
  const [first, second] = episode(next).carePeriods;
  assert.equal(episode(next).id, episode(seed).id);
  assert.equal(episode(next).programStream, "General");
  assert.equal(second.programStream, "General");
  assert.equal(next.people[0].episodes.length, 1);
  assert.equal(first.startDate, episode(seed).start);
  assert.equal(first.endDateExclusive, change.effectiveDate);
  assert.equal(second.startDate, change.effectiveDate);
  assert.equal(second.endDateExclusive, null);
  assert.equal(second.previousCareLevel, "Mid");
  assert.equal(second.authorisingPractitionerId, "jess");
  assert.equal(currentCarePeriod(episode(next)).id, second.id);
  assert.equal(carePeriodAt(episode(next), "2026-09-11").careLevel, "Mid");
  assert.equal(carePeriodAt(episode(next), "2026-09-12").careLevel, "High");
  assert.ok(appointmentDetails(episode(next).appointments.find((item) => item.attendance === "Attended"), episode(next))
    .some(([label, value]) => label === "Care level on contact date" && value === "Mid"));
  assert.equal(episode(seed).carePeriods, undefined);
});

test("episode closure ends the final care period without creating another episode", () => {
  const started = reducer(unlevelledSeed(), initial);
  const changed = reducer(started, change);
  const closed = reducer(changed, {
    ...context,
    type: "EPISODE",
    status: "Closed",
    reason: "Sample handover completed",
    end: TODAY,
    closureCategory: "Transferred or handed over",
    handoverStatus: "Confirmed",
    handoverDestination: "Sample receiving service",
    receivingResponsiblePerson: "Sample receiving team",
    handoverConfirmedAt: "2026-09-15T11:00",
    handoverConfirmationReference: "Sample handover confirmation",
    finalMeasureStatus: "Recorded missing",
  });
  assert.notEqual(closed, changed);
  assert.equal(episode(closed).carePeriods.at(-1).endDateExclusive, "2026-09-16");
  assert.equal(currentCarePeriod(episode(closed)), null);
  assert.equal(carePeriodAt(episode(closed), TODAY).careLevel, "High");
  assert.equal(closed.people[0].episodes.length, 1);
});

test("level history retains the effective date, authoriser and field changes", () => {
  const state = reducer(reducer(unlevelledSeed(), initial), change);
  const person = state.people[0];
  const history = activityEntries(person, episode(state), state.audit);
  const transition = history.find((entry) => entry.actionType === "CHANGE_CARE_LEVEL");
  assert.equal(transition.date, change.effectiveDate);
  assert.equal(historyDate(transition), change.effectiveDate);
  assert.equal(historyCategory(transition), "care-level");
  const detail = historyItem(transition, episode(state));
  assert.equal(detail.dateLabel, "Effective");
  assert.ok(detail.more.some((item) => item.label === "Authorising clinician" && item.value === "Jess Taylor"));
  assert.equal(transition.actor, "Jess Taylor");
  assert.equal(transition.collectionId, null);
  assert.ok(transition.changes.some((item) => item.label === "Care level" && item.after === "High"));
  assert.ok(transition.changes.some((item) => item.label === "Level ended before" && item.after === change.effectiveDate));
  assert.ok(changeLogEntries(person, episode(state), state.audit).some((item) => item.id === transition.id));
});

test("level changes reject missing baseline, same-day overlap, unsupported values and non-clinicians", () => {
  const seed = unlevelledSeed();
  assert.equal(reducer(seed, change), seed);
  const started = reducer(seed, initial);
  for (const invalid of [
    { effectiveDate: episode(started).start },
    { effectiveDate: "2026-09-16" },
    { effectiveDate: "2026-02-31" },
    { careLevel: "Mid" },
    { careLevel: "Unsupported" },
    { programStream: "Psychosis" },
    { authorisingPractitionerId: "ananya" },
    { triggeringReviewId: "not-a-review" },
  ]) assert.equal(reducer(started, { ...change, ...invalid }), started);
  const manager = structuredClone(started);
  manager.staffId = "ananya";
  assert.equal(reducer(manager, change), manager);
  assert.equal(reducer(started, initial), started);
  assert.ok(TODAY >= change.effectiveDate);
});
