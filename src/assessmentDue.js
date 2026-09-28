import { assessmentType } from "./assessmentGroups.js";

const isPending = (collection) => collection.response !== "Submitted" &&
  !["Paused", "Cancelled"].includes(collection.assignment);
const isInProgress = (collection) => isPending(collection) &&
  (["Draft", "In progress"].includes(collection.response) || collection.assignment === "Active");
const earliestDue = (collections) => [...collections].filter((collection) => collection.due)
  .sort((a, b) => a.due.localeCompare(b.due) || a.id.localeCompare(b.id))[0] || null;

export const earliestPendingAssessment = (collections) => earliestDue(collections.filter(isPending));

export const assessmentDueLabel = (collection, today) =>
  isPending(collection) && collection.due
    ? collection.due < today ? "Past due" : collection.due === today ? "Due today" : null
    : null;

export function assessmentDueByType(collections, today) {
  const byType = new Map();
  for (const collection of collections) {
    const key = assessmentType(collection).key;
    if (!byType.has(key)) byType.set(key, []);
    byType.get(key).push(collection);
  }
  return new Map([...byType].map(([key, records]) => {
    const pending = records.filter(isPending);
    const progress = pending.filter(isInProgress);
    // An undated draft also blocks the next collection: its due date has not been reached.
    const blockers = progress.filter((collection) => !collection.due || collection.due > today);
    const next = blockers.length
      ? earliestDue(blockers)
      : earliestDue(pending.filter((collection) => !isInProgress(collection))) || earliestDue(progress);
    return [key, next];
  }));
}

export function assessmentsWithDueVisibility(collections, today, dueByType = assessmentDueByType(collections, today)) {
  return collections.filter((collection) =>
    collection.bundleId || !isPending(collection) || isInProgress(collection) || !collection.due || collection.due < today ||
    dueByType.get(assessmentType(collection).key)?.id === collection.id);
}
