import { getInstrument } from "./instruments.js";
import { isCompletedScore } from "./outcomeMeasures.js";
import { responseDate } from "./progress.js";

export const assessmentType = (collection) => {
  const instrument = getInstrument(collection.version);
  // Older initial-assessment records used the general questionnaire version.
  // Keep their follow-ups under the same visible assessment type.
  const initialAssessment = collection.label?.split(" · ")[0]?.trim() === "Initial assessment";
  return {
    key: initialAssessment ? "Initial assessment" : instrument?.measureKey || instrument?.name || collection.version || collection.label,
    name: initialAssessment ? "Initial assessment" : instrument?.name || collection.version || collection.label,
    measureKey: initialAssessment ? null : instrument?.measureKey || null,
  };
};

const recordDate = (collection) => responseDate(collection) || collection.due || "";
const newestFirst = (a, b) =>
  recordDate(b).localeCompare(recordDate(a)) ||
  (b.submittedAt || "").localeCompare(a.submittedAt || "") ||
  b.id.localeCompare(a.id);

export const simpleAssessmentDate = (collection) => responseDate(collection) ||
  (collection.response === "Draft" ? collection.attempts?.at(-1)?.savedAt?.slice(0, 10) : null) ||
  collection.createdAt?.slice(0, 10) || null;

export function prioritizeSimpleAssessmentGroups(groups, visibleCollections) {
  const visibleIds = new Set(visibleCollections.map((collection) => collection.id));
  const isPending = (collection) => collection.response !== "Submitted";
  return groups.map((group, originalIndex) => ({
    ...group,
    originalIndex,
    records: group.collections.filter((collection) => visibleIds.has(collection.id))
      .sort((a, b) =>
        Number(isPending(b)) - Number(isPending(a)) ||
        (simpleAssessmentDate(b) || "").localeCompare(simpleAssessmentDate(a) || "") ||
        b.id.localeCompare(a.id)),
  })).sort((a, b) =>
    Number(b.records.some(isPending)) - Number(a.records.some(isPending)) ||
    a.originalIndex - b.originalIndex);
}

export function linkedAssessmentScore(episode, collection) {
  const measureKey = assessmentType(collection).measureKey;
  if (!measureKey) return null;
  const measure = (episode.reportOutcomeMeasures || []).find((item) => item.key === measureKey);
  const record = measure?.records?.find((item) =>
    item.sourceCollectionId === collection.id && isCompletedScore(item));
  return record ? { value: Number(record.value), range: measure.scoreRange || null } : null;
}

export function assessmentScoreLabel(score) {
  if (score) return `${score.value}${score.range ? ` / ${score.range[1]}` : ""}`;
  return "Not scored";
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
