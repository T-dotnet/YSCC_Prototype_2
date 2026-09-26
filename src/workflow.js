import {
  collectionStatus,
  currentStaff,
  hasPendingClinicalReview,
} from "./model.js";

export function isOutstanding(collection) {
  return (
    !["Paused", "Cancelled"].includes(collection.assignment) &&
    (collection.response !== "Submitted" || hasPendingClinicalReview(collection))
  );
}

export function compareCollections(a, b) {
  const rank = (c) =>
    ({ Overdue: 0, "Ready for review": 1, "Due today": 2, Scheduled: 3 })[
      collectionStatus(c)
    ] ?? 4;
  return (
    rank(a) - rank(b) || (a.due || "").localeCompare(b.due || "") || a.id.localeCompare(b.id)
  );
}

export function currentCollection(episode) {
  return (
    episode.collections.filter(isOutstanding).sort(compareCollections)[0] ||
    [...episode.collections].sort((a, b) => (b.due || "").localeCompare(a.due || ""))[0]
  );
}

export function matchesWorkOwner(owner, state, ownership) {
  const assignedOwner = owner && owner !== "Unassigned" ? owner : null;
  return ownership === "team" ||
    (ownership === "unassigned"
      ? !assignedOwner
      : assignedOwner === currentStaff(state)?.name);
}

export function ownedTasks(tasks, state, ownership) {
  const reviewDate = (task) =>
    task.collection?.due || task.record?.reviewDate || "9999-12-31";
  return tasks
    .filter(({ person, episode, owner: taskOwner }) => {
      const owner = taskOwner || episode?.owner || person.owner;
      return matchesWorkOwner(owner, state, ownership);
    })
    .sort((a, b) => {
      const rank = (task) =>
        task.status === "Overdue"
          ? 0
          : task.status === "Ready for review"
            ? 1
            : 2;
      return (
        rank(a) - rank(b) ||
        reviewDate(a).localeCompare(reviewDate(b))
      );
    });
}

export function safeReturnTo(value) {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/people";
  try {
    const url = new URL(value, "http://prototype.local");
    return url.origin === "http://prototype.local" &&
      ["/", "/people", "/quality"].includes(url.pathname)
      ? url.pathname + url.search
      : "/people";
  } catch {
    return "/people";
  }
}

export function taskHref(
  { person, episode, collection, kind, record },
  returnTo,
) {
  if (kind) {
    const params = new URLSearchParams({
      returnTo: safeReturnTo(returnTo),
    });
    if (kind !== "intake") params.set("tab", "referrals");
    if (kind === "referral") params.set("referral", record.id);
    return `/people/${encodeURIComponent(person.id)}?${params}`;
  }
  const params = new URLSearchParams({
    episode: episode.id,
    collection: collection.id,
    tab: "assessment",
    returnTo: safeReturnTo(returnTo),
  });
  return `/people/${encodeURIComponent(person.id)}?${params}`;
}
