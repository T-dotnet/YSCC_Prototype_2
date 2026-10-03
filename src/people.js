import { collectionStatus, formatDate, TODAY } from "./model.js";
import { canAssess, intakeReady, intakeStage, intakeTasks } from "./intake.js";
import { assessmentBundleGroups } from "./assessmentBundles.js";
import { mvpAssessmentMode } from './mvpAssessmentPathway.js';
import { initialAssessmentReadyForOutcome, initialAssessmentStatusChange } from './assessmentOutcome.js';
import { assessmentBundleStatus } from './assessmentBundleStatus.js';
import { currentCollection, currentMvpStageCollection } from "./workflow.js";
import { derivedEpisodeStatus } from "./batch1Registration.js";

export const episodeDisplayStatus = (episode, settings) =>
  episode ? derivedEpisodeStatus({}, episode, settings) : "Intake";

const openIntake = (intake) =>
  !["Completed", "Closed incomplete"].includes(intake.status) ||
  (intakeReady(intake) && !intake.episodeId);

export function peopleInEpisodes(people, status = "All episodes", settings) {
  return (people || []).filter((person) =>
    status === "Archived" ? !!person.archivedAt : !person.archivedAt,
  ).flatMap((person) => {
    if (status === "Archived")
      return [{ person, episode: person.episodes?.[0], status: "Archived", label: "Archived person record", detail: "Record retained for review" }];
    const episode = person.episodes?.find((e) => e.status === "Active") ||
      person.episodes?.find((e) => e.status === "Paused") ||
      person.episodes?.[0];
    const row = { person, episode, ...personStatus(person, episode) };
    const currentStatus = episodeDisplayStatus(episode, settings);
    // Keep each person in one current-stage tab, matching the Episode column.
    if (status !== "All episodes" && status !== currentStatus &&
        !(status === "Active" && episode?.status === "Active")) return [];
    return [row];
  });
}

export function peopleForList(people, status = "All episodes", query = "", settings) {
  const search = query.trim().toLowerCase();
  return peopleInEpisodes(people, status, settings).filter(({ person }) =>
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
        ? "Closure measures and care experience feedback complete"
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
  const collection = person.mvpProfile ? currentMvpStageCollection(episode) : currentCollection(episode);
  if (!collection) {
    return {
      status: "Not scheduled",
      label: "No measure planned",
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
  if (!row.episode) return {...row, label:row.stage ? `Intake review · ${row.stage}` : 'No assessment yet'};
  const groups = assessmentBundleGroups(row.episode, row.episode.collections, settings?.assessmentScheduleRules);
  const matching = groups.find(item => item.records.some(record => record.id === row.collection?.id));
  const group = matching && matching.key !== 'individual' ? matching : groups.find(item => item.key !== 'individual');
  if (!group || group.key === 'individual') return {...row, label:'No assessment scheduled', detail:'Measures are recorded individually'};
  const showDueStatus = settings?.scheduleAssessments || mvpAssessmentMode(settings);
  const outcomePending = initialAssessmentReadyForOutcome(row.episode, settings) && !row.episode.assessmentOutcome?.value;
  const { status, label: statusLabel, completedCount, nextDue } = assessmentBundleStatus(group.records, TODAY, {
    showDueDates: showDueStatus,
    awaitingOutcome: record => outcomePending && record.mvpInitialAssessment &&
      initialAssessmentStatusChange(record, settings) === 'Ongoing review',
  });
  const due = showDueStatus ? nextDue?.due || '' : '';
  return {...row, collection:nextDue || group.records[0], label:group.name, status:statusLabel, bundleStatus:status, due,
    detail:`${completedCount} of ${group.records.length} measures completed${status === 'record-outcome' ? ' · Outcome required' : due ? ` · Due ${formatDate(due)}` : ''}`};
}
