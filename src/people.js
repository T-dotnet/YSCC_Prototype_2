import { collectionStatus, formatDate, TODAY } from "./model.js";
import { canAssess, intakeReady, intakeStage, intakeTasks } from "./intake.js";
import { currentCollection } from "./workflow.js";

const openIntake = (intake) =>
  !["Completed", "Closed incomplete"].includes(intake.status) ||
  (intakeReady(intake) && !intake.episodeId);

export function peopleInEpisodes(people, status = "All episodes") {
  return people.flatMap((person) => {
    const episode =
      status === "Intake"
        ? undefined
        : status === "All episodes"
          ? person.episodes.find((e) => e.status === "Active") ||
            person.episodes.find((e) => e.status === "Paused") ||
            person.episodes[0]
          : person.episodes.find((e) => e.status === status);
    if (status === "Intake") {
      if (person.episodes.length && !person.intakes?.some(openIntake))
        return [];
    } else if (status !== "All episodes" && !episode) return [];
    return [{ person, episode, ...personStatus(person, episode) }];
  });
}

export function personStatus(person, episode) {
  if (!episode) {
    const intake = person.intakes?.find(openIntake) || person.intakes?.[0];
    const task = intakeTasks({ people: [person] }, TODAY).find(
      (task) => task.kind === "intake" && task.record.id === intake?.id,
    );
    return {
      status: task?.status || intake?.status || "Intake",
      label: "Intake",
      stage: intakeStage(intake),
      detail: intake?.reviewDate
        ? `Review due ${formatDate(intake.reviewDate)}`
        : "Assessment not yet planned",
      due: intake?.reviewDate,
    };
  }
  if (episode.status !== "Active") {
    return {
      status: episode.status,
      label: `${episode.status} care episode`,
      detail: episode.nextCareStep || "No active assessment tasks",
    };
  }
  if (!canAssess(person, episode)) {
    return {
      status: "Intake required",
      label: "Complete intake",
      detail: "Resolve intake before assessment",
    };
  }
  const collection = currentCollection(episode);
  if (!collection) {
    return {
      status: "Not scheduled",
      label: "No assessment planned",
      detail: "Plan the next collection",
    };
  }
  const status = collectionStatus(collection);
  const daysOverdue = Math.round(
    (Date.parse(TODAY) - Date.parse(collection.due)) / 86400000,
  );
  const detail =
    status === "Overdue"
      ? `${daysOverdue} ${daysOverdue === 1 ? "day" : "days"} overdue · Due ${formatDate(collection.due)}`
      : status === "Ready for review"
        ? collection.needsReview
          ? "Responses updated · Re-review required"
          : "Response received · Review pending"
        : status === "Reviewed"
          ? collection.reviewDate
            ? `Reviewed ${formatDate(collection.reviewDate)}`
            : "Clinical review complete"
          : status === "Completed"
            ? "Completed · no clinical review required"
          : status === "Paused" || status === "Cancelled"
            ? `Collection ${status.toLowerCase()}`
            : status === "Due today"
              ? `Due today · ${formatDate(collection.due)}`
              : `Due ${formatDate(collection.due)}`;
  return {
    status,
    label: collection.label,
    detail,
    due: collection.due,
    collection,
  };
}

export function comparePeople(a, b) {
  const rank = (row) =>
    ({ Overdue: 0, "Ready for review": 1, "Due today": 2, Scheduled: 3 })[
      row.status
    ] ?? 4;
  return (
    rank(a) - rank(b) ||
    (a.due || "9999").localeCompare(b.due || "9999") ||
    a.person.name.localeCompare(b.person.name)
  );
}
