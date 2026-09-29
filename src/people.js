import { collectionStatus, formatDate, TODAY } from "./model.js";
import { canAssess, intakeReady, intakeStage, intakeTasks } from "./intake.js";
import { assessmentBundleGroups } from "./assessmentBundles.js";
import { currentCollection } from "./workflow.js";

const openIntake = (intake) =>
  !["Completed", "Closed incomplete"].includes(intake.status) ||
  (intakeReady(intake) && !intake.episodeId);

export function peopleInEpisodes(people, status = "All episodes") {
  return (people || []).filter((person) =>
    status === "Archived" ? !!person.archivedAt : !person.archivedAt,
  ).flatMap((person) => {
    if (status === "Archived")
      return [{ person, episode: person.episodes?.[0], status: "Archived", label: "Archived person record", detail: "Record retained for review" }];
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

export function peopleForList(people, status = "All episodes", query = "") {
  const search = query.trim().toLowerCase();
  return peopleInEpisodes(people, status).filter(({ person }) =>
    `${person.name} ${person.id}`.toLowerCase().includes(search),
  );
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
      detail: episode.status === "Completed"
        ? "Closure assessment and care experience feedback complete"
        : episode.nextCareStep || "No active assessment tasks",
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

export function peopleBundleSummary(row, settings) {
  if (!row.episode) return {...row, label:row.stage ? `Intake review · ${row.stage}` : 'No bundle yet'};
  const groups = assessmentBundleGroups(row.episode, row.episode.collections, settings?.assessmentScheduleRules);
  const matching = groups.find(item => item.records.some(record => record.id === row.collection?.id));
  const group = matching && matching.key !== 'individual' ? matching : groups.find(item => item.key !== 'individual');
  if (!group || group.key === 'individual') return {...row, label:'No bundle scheduled', detail:'Assessments are recorded individually'};
  const completed = group.records.filter(record => record.response === 'Submitted').length;
  const pending = group.records.filter(record => record.response !== 'Submitted' && !['Cancelled','Paused'].includes(record.assignment));
  const due = pending.map(record => record.due).filter(Boolean).sort()[0] || '';
  const status = completed === group.records.length ? 'Completed'
    : settings?.scheduleAssessments && due && due < TODAY ? 'Overdue'
    : settings?.scheduleAssessments && due === TODAY ? 'Due today'
    : completed || pending.some(record => record.response === 'Draft') ? 'In progress' : 'Not started';
  return {...row, collection:pending[0] || group.records[0], label:group.name, status, due:settings?.scheduleAssessments ? due : '',
    detail:`${completed} of ${group.records.length} questionnaires completed${settings?.scheduleAssessments && due ? ` · Due ${formatDate(due)}` : ''}`};
}
