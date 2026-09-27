import { getInstrument } from "./instruments.js";
import { assessmentContactLinks } from "./assessmentContacts.js";

// A read-only view of the proposed YSCC hierarchy. Source workflow records stay
// where they were entered; this view never turns a plan into a completed event.
const isoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
  !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) &&
  new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;

const levelRank = { Low: 1, Mid: 2, High: 3 };

export function careJourneys(person) {
  const episodes = person?.episodes || [];
  const byId = new Map(episodes.map((episode) => [episode.id, episode]));
  const groups = new Map();
  for (const episode of episodes) {
    let root = episode;
    const visited = new Set([episode.id]);
    while (root.previousEpisodeId && byId.has(root.previousEpisodeId) &&
      !visited.has(root.previousEpisodeId)) {
      root = byId.get(root.previousEpisodeId);
      visited.add(root.id);
    }
    const key = root.careJourneyKey || root.id;
    if (!groups.has(key)) groups.set(key, { key, personId: person.id, episodes: [] });
    groups.get(key).episodes.push(episode);
  }
  return [...groups.values()].map((journey) => ({
    ...journey,
    episodes: journey.episodes.sort((a, b) =>
      (a.start || "").localeCompare(b.start || "") || a.id.localeCompare(b.id)),
  }));
}

export function careJourneyForEpisode(person, episodeId) {
  return careJourneys(person).find((journey) =>
    journey.episodes.some((episode) => episode.id === episodeId)) || null;
}

export function episodeCareLevel(episode) {
  const levels = [...new Set((episode?.carePeriods || [])
    .map((period) => period.careLevel).filter(Boolean))];
  return levels.length === 1 ? levels[0] : null;
}

export function episodeLinkReason(episode, previous) {
  if (!previous) return "initial";
  if (episode.programStream !== previous.programStream) return "stream_change";
  const before = levelRank[episodeCareLevel(previous)];
  const after = levelRank[episodeCareLevel(episode)];
  if (before && after && after > before) return "step_up";
  if (before && after && after < before) return "step_down";
  return null;
}

export function ysccEpisodeFacts(person, episode) {
  const journey = careJourneyForEpisode(person, episode.id);
  const previous = person.episodes?.find((item) => item.id === episode.previousEpisodeId);
  const careLevel = episodeCareLevel(episode);
  return {
    episodeKey: episode.id,
    careJourneyKey: journey?.key || null,
    personKey: person.id,
    previousEpisodeKey: previous?.id || null,
    stream: episode.programStream || null,
    careLevel,
    startDate: isoDate(episode.start) ? episode.start : null,
    endDate: isoDate(episode.end) ? episode.end : null,
    linkReason: episode.linkReason || episodeLinkReason(episode, previous),
    // The prototype start is a workflow date. It has not been reconciled with
    // the MDS first-contact derivation and is not labelled a submission date.
    startDateSource: "prototype_episode_start",
  };
}

export function ysccCareEvents(episode) {
  const events = [];
  for (const contact of episode?.appointments || []) {
    const occurred = contact.attendance === "Attended" || contact.attendance === "Did not attend";
    const date = contact.actualDate || (contact.attendance === "Did not attend" ? contact.plannedDate : null);
    if (!occurred || !isoDate(date)) continue;
    events.push({
      key: contact.id, episodeKey: episode.id, date, type: "direct_contact",
      sourceType: "appointment", sourceId: contact.id,
      attendance: contact.attendance,
    });
  }
  for (const collection of episode?.collections || []) {
    const date = collection.submittedAt?.slice(0, 10);
    if (collection.response !== "Submitted" || !isoDate(date)) continue;
    events.push({
      key: collection.id, episodeKey: episode.id, date,
      type: collection.closureKind === "feedback" ? "feedback_collection" : "outcome_measurement",
      sourceType: "collection", sourceId: collection.id,
      linkedContactKeys: assessmentContactLinks(episode)
        .filter((link) => link.collectionId === collection.id)
        .map((link) => link.appointmentId),
      instrumentVersion: collection.version || null,
    });
  }
  for (const [kind, track] of Object.entries(episode?.reviewSchedule || {})) {
    if (!track || !Array.isArray(track.history)) continue;
    for (const review of track.history) {
      if (!isoDate(review.date)) continue;
      events.push({
        key: review.id, episodeKey: episode.id, date: review.date,
        type: kind === "outcome" ? "outcome_review" : "experience_review",
        sourceType: "review", sourceId: review.id,
      });
    }
  }
  for (const event of episode?.events || []) {
    if (!(["ADD_CARE_EVENT", "CORRECT_CARE_EVENT"].includes(event.actionType) &&
      event.eventType === "indirect-activity" && isoDate(event.eventDate || event.date))) continue;
    events.push({
      key: event.id, episodeKey: episode.id, date: event.eventDate || event.date,
      type: "indirect_activity", sourceType: "care_event", sourceId: event.id,
    });
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}

export function ysccMeasureItems(episode) {
  return (episode?.collections || []).flatMap((collection) => {
    const date = collection.submittedAt?.slice(0, 10);
    const instrument = getInstrument(collection.version);
    if (collection.response !== "Submitted" || !isoDate(date) || !instrument ||
      !Array.isArray(collection.answers)) return [];
    return instrument.questions.flatMap((question, index) => {
      const value = collection.answers[index];
      if (value === undefined || value === null || value === "") return [];
      return [{ careEventKey: collection.id, instrumentVersion: collection.version,
        itemKey: question.id, value, sourceType: "collection_answer",
        mappingStatus: "prototype_item_not_approved_for_yscc_submission" }];
    });
  });
}

export function ysccAlignmentIssues(person) {
  const issues = [];
  for (const episode of person?.episodes || []) {
    if (!episodeCareLevel(episode))
      issues.push({ episodeKey: episode.id, reason: "One episode-level care level cannot be established." });
    if (episode.previousEpisodeId && !person.episodes.some((item) => item.id === episode.previousEpisodeId))
      issues.push({ episodeKey: episode.id, reason: "The previous episode is unavailable in this person record." });
    if (episode.previousEpisodeId && !(episode.linkReason || episodeLinkReason(episode,
      person.episodes.find((item) => item.id === episode.previousEpisodeId))))
      issues.push({ episodeKey: episode.id, reason: "The episode link needs an explicit reason." });
  }
  return issues;
}

// This is an evidence inventory for the proposed Stage 2 shape, not a national
// submission. Missing entities remain empty, and unsupported codes remain raw.
export function ysccDraftProjection(state) {
  const people = state?.people || [];
  const journeys = people.flatMap(careJourneys);
  return {
    status: "draft_not_submission_ready",
    organisations: [],
    practitioners: [],
    clients: people.map((person) => ({
      clientKey: person.id,
      dateOfBirth: isoDate(person.dob) ? person.dob : null,
      statisticalLinkageKey: null,
    })),
    clientAttributes: [],
    careJourneys: journeys.map((journey) => ({
      careJourneyKey: journey.key,
      clientKey: journey.personId,
      startDate: journey.episodes[0]?.start || null,
      endDate: journey.episodes.at(-1)?.end || null,
    })),
    episodesOfCare: people.flatMap((person) =>
      (person.episodes || []).map((episode) => ysccEpisodeFacts(person, episode))),
    careEvents: people.flatMap((person) => (person.episodes || [])
      .flatMap(ysccCareEvents)),
    measureItems: people.flatMap((person) => (person.episodes || [])
      .flatMap(ysccMeasureItems)),
    measureScores: [],
    issues: [
      ...people.flatMap((person) => ysccAlignmentIssues(person)
        .map((issue) => ({ personKey: person.id, ...issue }))),
      { reason: "Organisation, practitioner, dated client attribute and approved score mappings are not available from the prototype." },
    ],
  };
}
