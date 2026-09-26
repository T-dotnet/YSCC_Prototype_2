import test from "node:test";
import assert from "node:assert/strict";
import { createSeed, reducer, TODAY, upgradeSampleData } from "./model.js";
import { addCalendarMonths, addDays, episodeReviewActionError, episodeReviewSchedule, nextRollingOutcomeDate, nextProposedReviewDate, reviewTiming } from "./episodeReviews.js";

const personId = "YS-1028";
const episodeId = "EP-1028-01";
const episodeIn = (state) => state.people.find((person) => person.id === personId)
  .episodes.find((episode) => episode.id === episodeId);

test("outcome reviews use rolling 90-day dates while experience checks use calendar months", () => {
  assert.equal(addCalendarMonths("2025-01-31", 1), "2025-02-28");
  assert.equal(addCalendarMonths("2024-01-31", 1), "2024-02-29");
  const episode = episodeIn(createSeed());
  const collections = structuredClone(episode.collections);
  const schedule = episodeReviewSchedule(episode, TODAY);
  assert.equal(schedule.confirmed, false);
  assert.equal(schedule.outcome.due, nextRollingOutcomeDate(episode.start, TODAY));
  assert.equal(schedule.experience.due, nextProposedReviewDate(episode.start, 1, TODAY));
  assert.equal(nextRollingOutcomeDate("2026-06-15", "2026-09-26"), "2026-12-12");
  assert.equal(addDays("2026-06-15", 90), "2026-09-13");
  assert.equal(nextProposedReviewDate("2025-01-31", 1, "2025-03-01"), "2025-03-31");
  assert.equal(episodeReviewSchedule(createSeed().people.find((person) => person.id === "YS-1034").episodes[0], "2026-09-26").outcome.due, "2026-12-12");
  assert.deepEqual(episode.collections, collections);
  assert.equal(reviewTiming(TODAY, TODAY), "Due today");
});

test("confirming the cadence and recording a review advances only its own clock", () => {
  const seed = createSeed();
  const originalCollections = structuredClone(episodeIn(seed).collections);
  const provisional = episodeReviewSchedule(episodeIn(seed));
  const reviewAction = {
    type: "RECORD_EPISODE_REVIEW", personId, episodeId, kind: "outcome",
    completedDate: TODAY, nextDue: addDays(TODAY, 90), summary: "Goals discussed; continue agreed support.",
  };
  assert.match(episodeReviewActionError(episodeIn(seed), reviewAction, TODAY), /Confirm/);
  assert.equal(reducer(seed, reviewAction), seed);

  const confirmed = reducer(seed, {
    type: "SCHEDULE_EPISODE_REVIEWS", personId, episodeId,
    outcomeDue: provisional.outcome.due,
    experienceDue: provisional.experience.due,
    confirmed: true,
    reason: "Service review cadence agreed for this episode.",
  });
  assert.notEqual(confirmed, seed);
  assert.equal(episodeReviewSchedule(episodeIn(confirmed)).confirmed, true);
  const reviewed = reducer(confirmed, reviewAction);
  const schedule = episodeReviewSchedule(episodeIn(reviewed));
  assert.equal(schedule.outcome.due, reviewAction.nextDue);
  assert.equal(schedule.outcome.history.length, 1);
  assert.equal(schedule.outcome.history[0].scheduledDue, provisional.outcome.due);
  assert.equal(schedule.experience.due, provisional.experience.due);
  assert.equal(schedule.experience.history.length, 0);
  assert.deepEqual(episodeIn(reviewed).collections, originalCollections);
  assert.equal(reducer(reviewed, reviewAction), reviewed);

  const upgraded = upgradeSampleData(reviewed);
  assert.deepEqual(episodeReviewSchedule(episodeIn(upgraded)), schedule);
});

test("an inpatient event leaves both episode review dates intact", () => {
  const seed = createSeed();
  const episode = episodeIn(seed);
  const due = episodeReviewSchedule(episode);
  const changed = reducer(seed, {
    type: "ADD_CARE_EVENT", personId, episodeId, eventType: "inpatient",
    eventDate: TODAY, summary: "Admission reported by the care team.",
  });
  assert.notEqual(changed, seed);
  assert.equal(episodeIn(changed).events[0].eventType, "inpatient");
  assert.deepEqual(episodeReviewSchedule(episodeIn(changed)), due);
});
