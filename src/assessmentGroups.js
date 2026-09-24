import { getInstrument } from "./instruments.js";
import { isCompletedScore } from "./outcomeMeasures.js";
import { responseDate } from "./progress.js";

export const assessmentType = (collection) => {
  const instrument = getInstrument(collection.version);
  return {
    key: instrument?.measureKey || instrument?.name || collection.version || collection.label,
    name: instrument?.name || collection.version || collection.label,
    measureKey: instrument?.measureKey || null,
  };
};

const recordDate = (collection) => responseDate(collection) || collection.due || "";
const newestFirst = (a, b) =>
  recordDate(b).localeCompare(recordDate(a)) ||
  (b.submittedAt || "").localeCompare(a.submittedAt || "") ||
  b.id.localeCompare(a.id);

export function linkedAssessmentScore(episode, collection) {
  const measureKey = assessmentType(collection).measureKey;
  if (!measureKey) return null;
  const measure = (episode.reportOutcomeMeasures || []).find((item) => item.key === measureKey);
  const record = measure?.records?.find((item) =>
    item.sourceCollectionId === collection.id && isCompletedScore(item));
  return record ? { value: Number(record.value), range: measure.scoreRange || null } : null;
}

export function assessmentTypeGroups(episode, visibleCollections) {
  const allByType = new Map();
  for (const collection of episode.collections || []) {
    const type = assessmentType(collection);
    if (!allByType.has(type.key)) allByType.set(type.key, { ...type, collections: [] });
    allByType.get(type.key).collections.push(collection);
  }

  const visibleKeys = [...new Set(visibleCollections.map((collection) => assessmentType(collection).key))];
  return visibleKeys.map((key) => {
    const group = allByType.get(key);
    const collections = [...group.collections].sort(newestFirst);
    const titles = new Set(collections.map((collection) =>
      collection.label?.split(" · ")[0]?.trim()).filter(Boolean));
    const lastDone = collections
      .filter((collection) => collection.response === "Submitted" && responseDate(collection))
      .sort((a, b) =>
        responseDate(b).localeCompare(responseDate(a)) ||
        (b.submittedAt || "").localeCompare(a.submittedAt || "") ||
        b.id.localeCompare(a.id),
      )[0] || null;
    const linkedScore = lastDone ? linkedAssessmentScore(episode, lastDone) : null;
    const previousScore = linkedScore
      ? collections
        .filter((collection) =>
          collection.id !== lastDone.id && collection.response === "Submitted" &&
          responseDate(collection) && responseDate(collection) < responseDate(lastDone))
        .map((collection) => linkedAssessmentScore(episode, collection))
        .find(Boolean)
      : null;

    return {
      ...group,
      name: titles.size === 1 ? [...titles][0] : group.name,
      collections,
      lastDone,
      score: linkedScore?.value ?? null,
      scoreRange: linkedScore?.range || null,
      scoreChange: previousScore ? linkedScore.value - previousScore.value : null,
    };
  });
}

export const assessmentTypeCount = (episode) =>
  new Set((episode.collections || []).map((collection) => assessmentType(collection).key)).size;
