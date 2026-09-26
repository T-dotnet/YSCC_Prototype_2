export const EPISODE_REVIEW_TYPES = {
  outcome: { label: "Outcome review", days: 90 },
  experience: { label: "Experience check", months: 1 },
};

export const validReviewDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
  !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) &&
  new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;

export function addCalendarMonths(date, months) {
  if (!validReviewDate(date)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(day, lastDay));
  return first.toISOString().slice(0, 10);
}

export function addDays(date, days) {
  if (!validReviewDate(date)) return null;
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

const localToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export function nextProposedReviewDate(start, months, today = localToday()) {
  if (!validReviewDate(start)) return null;
  let cadencePoint = 1;
  let due = addCalendarMonths(start, months * cadencePoint);
  while (due < today) due = addCalendarMonths(start, months * ++cadencePoint);
  return due;
}

export function nextRollingOutcomeDate(start, today = localToday()) {
  if (!validReviewDate(start)) return null;
  let due = addDays(start, 90);
  while (due < today) due = addDays(due, 90);
  return due;
}

export function episodeReviewSchedule(episode, today = localToday()) {
  const saved = episode?.reviewSchedule || {};
  const tracks = Object.fromEntries(Object.entries(EPISODE_REVIEW_TYPES).map(([kind, config]) => [
    kind,
    {
      due: saved[kind]?.due || (episode?.status === "Active"
        ? (kind === "outcome"
          ? nextRollingOutcomeDate(episode.reviewAnchorDate || episode.start, today)
          : nextProposedReviewDate(episode.start, config.months, today)) : null),
      history: Array.isArray(saved[kind]?.history) ? saved[kind].history : [],
    },
  ]));
  return { confirmed: saved.confirmed === true, ...tracks };
}

export function reviewTiming(due, today) {
  if (!validReviewDate(due) || !validReviewDate(today)) return "Not scheduled";
  const days = Math.round((Date.parse(`${due}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
  if (days === 0) return "Due today";
  if (days > 0) return `In ${days} day${days === 1 ? "" : "s"}`;
  return `${-days} day${days === -1 ? "" : "s"} overdue`;
}

export function episodeReviewActionError(episode, action, today) {
  if (!episode || episode.status !== "Active")
    return "Episode reviews can only be changed in an active care episode.";
  if (action.type === "SCHEDULE_EPISODE_REVIEWS") {
    if (![action.outcomeDue, action.experienceDue].every((date) =>
      validReviewDate(date) && date >= episode.start))
      return "Choose valid review dates on or after the episode began.";
    if (!action.reason?.trim()) return "Record why the review schedule changed.";
    if (typeof action.confirmed !== "boolean") return "Confirm the cadence status.";
    const current = episodeReviewSchedule(episode, today);
    if (current.outcome.due === action.outcomeDue &&
        current.experience.due === action.experienceDue &&
        current.confirmed === action.confirmed)
      return "The review schedule has not changed.";
    return null;
  }
  if (action.type === "RECORD_EPISODE_REVIEW") {
    if (!EPISODE_REVIEW_TYPES[action.kind]) return "Choose an episode review type.";
    if (!episodeReviewSchedule(episode, today).confirmed)
      return "Confirm the episode review cadence before recording a scheduled review.";
    if (!validReviewDate(action.completedDate) || action.completedDate < episode.start || action.completedDate > today)
      return "Choose a completed date within this care episode and no later than today.";
    if (!action.summary?.trim()) return "Record the review outcome and next step.";
    if (!validReviewDate(action.nextDue) || action.nextDue <= action.completedDate)
      return "Choose a next review date after the completed review.";
    if (episodeReviewSchedule(episode, today)[action.kind].history.some((item) => item.date === action.completedDate))
      return "A review of this type is already recorded on that date.";
    return null;
  }
  return "This is not an episode review action.";
}
