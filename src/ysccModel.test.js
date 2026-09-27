import test from "node:test";
import assert from "node:assert/strict";
import { careJourneyForEpisode, careJourneys, episodeLinkReason, ysccAlignmentIssues, ysccCareEvents, ysccDraftProjection, ysccEpisodeFacts, ysccMeasureItems } from "./ysccModel.js";
import { DEMO_INSTRUMENT } from "./instruments.js";

test("linked episodes form one journey without resetting its key", () => {
  const person = { id: "P1", episodes: [
    { id: "E2", previousEpisodeId: "E1", start: "2026-04-01", programStream: "General", carePeriods: [{ careLevel: "High" }] },
    { id: "E1", start: "2026-01-01", end: "2026-03-31", programStream: "General", carePeriods: [{ careLevel: "Mid" }] },
  ] };
  const journey = careJourneyForEpisode(person, "E2");
  assert.equal(careJourneys(person).length, 1);
  assert.equal(journey.key, "E1");
  assert.deepEqual(journey.episodes.map((episode) => episode.id), ["E1", "E2"]);
  assert.equal(ysccEpisodeFacts(person, person.episodes[0]).linkReason, "step_up");
  assert.equal(episodeLinkReason(person.episodes[0], person.episodes[1]), "step_up");
  assert.deepEqual(ysccAlignmentIssues(person), []);
});

test("only recorded activity becomes a reporting care event", () => {
  const episode = { id: "E1", appointments: [
    { id: "planned", attendance: "Planned", plannedDate: "2026-01-02" },
    { id: "attended", attendance: "Attended", actualDate: "2026-01-03" },
  ], collections: [
    { id: "pending", response: "Not started", due: "2026-01-04" },
    { id: "submitted", response: "Submitted", submittedAt: "2026-01-03T12:00:00Z", version: "K10 sample" },
  ], assessmentContactLinks: [{ collectionId: "submitted", appointmentId: "attended" }] };
  const events = ysccCareEvents(episode);
  assert.deepEqual(events.map((event) => event.key), ["attended", "submitted"]);
  assert.deepEqual(events[1].linkedContactKeys, ["attended"]);
});

test("submitted answers retain item and instrument identity without inventing a score", () => {
  const episode = { collections: [{
    id: "A1", response: "Submitted", submittedAt: "2026-01-03T12:00:00Z",
    version: DEMO_INSTRUMENT.version,
    answers: [DEMO_INSTRUMENT.questions[0].options[0]],
  }] };
  assert.deepEqual(ysccMeasureItems(episode), [{
    careEventKey: "A1", instrumentVersion: DEMO_INSTRUMENT.version,
    itemKey: DEMO_INSTRUMENT.questions[0].id,
    value: DEMO_INSTRUMENT.questions[0].options[0],
    sourceType: "collection_answer",
    mappingStatus: "prototype_item_not_approved_for_yscc_submission",
  }]);
});

test("draft Stage 2 projection leaves unsupported entities empty", () => {
  const projection = ysccDraftProjection({ people: [{ id: "P1", dob: "2008-01-01", episodes: [
    { id: "E1", start: "2026-01-01", programStream: "General", carePeriods: [{ careLevel: "Mid" }] },
  ] }] });
  assert.equal(projection.status, "draft_not_submission_ready");
  assert.equal(projection.clients.length, 1);
  assert.equal(projection.careJourneys[0].careJourneyKey, "E1");
  assert.equal(projection.episodesOfCare[0].careLevel, "Mid");
  assert.deepEqual(projection.organisations, []);
  assert.deepEqual(projection.clientAttributes, []);
  assert.deepEqual(projection.measureScores, []);
});
