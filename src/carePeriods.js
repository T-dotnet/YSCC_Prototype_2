export const PROGRAM_STREAMS = ["Psychosis", "Eating Disorder", "Complex", "General"];
export const CARE_LEVELS = ["High", "Mid", "Low"];
export const CARE_LEVEL_REASONS = [
  "Scheduled review",
  "Change in care needs",
  "Change in risk profile",
  "Transfer of care",
  "Other structured reason",
];

const validDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
  Number.isFinite(new Date(`${value}T12:00:00Z`).getTime()) &&
  new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;

export const currentCarePeriod = (episode) =>
  (episode?.carePeriods || []).find((period) => !period.endDateExclusive) || null;

export const carePeriodAt = (episode, date) =>
  date ? (episode?.carePeriods || []).find((period) =>
    period.startDate <= date && (!period.endDateExclusive || date < period.endDateExclusive),
  ) || null : null;

export const nextDate = (date) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
};

export const previousDate = (date) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
};

export function carePeriodError(episode, action, staff, today, clinicians) {
  if (!episode || episode.status !== "Active" || staff?.role !== "Clinician")
    return "Only a clinician can update levels in an active care episode.";
  if (!CARE_LEVELS.includes(action.careLevel))
    return "Choose a care level.";
  if (!action.deliveringUnit?.trim())
    return "Enter the delivering team or pod.";
  const current = currentCarePeriod(episode);
  if (action.type === "SET_INITIAL_CARE_LEVEL") {
    if (episode.carePeriods?.length) return "The starting care level is already recorded.";
    if (!PROGRAM_STREAMS.includes(episode.programStream || action.programStream))
      return "Choose a program stream for this episode.";
    if (episode.programStream && action.programStream && action.programStream !== episode.programStream)
      return "The program stream is already set for this episode.";
    if (!validDate(episode.start) || episode.start > today)
      return "This episode does not have a valid start date.";
    return null;
  }
  if (action.type !== "CHANGE_CARE_LEVEL" || !current)
    return "Record the starting care level before changing it.";
  if (action.programStream && action.programStream !== episode.programStream)
    return "A level change must stay in this episode's program stream.";
  const periods = episode.carePeriods;
  if (periods.at(-1) !== current ||
      periods.filter((period) => !period.endDateExclusive).length !== 1 ||
      periods.some((period, index) => index > 0 && periods[index - 1].endDateExclusive !== period.startDate))
    return "The existing level history needs review before another change.";
  if (!validDate(action.effectiveDate) ||
      action.effectiveDate <= current.startDate || action.effectiveDate > today ||
      (episode.end && action.effectiveDate > episode.end))
    return "Choose a date after the current level began and within this episode.";
  if (action.careLevel === current.careLevel)
    return "Choose a different care level.";
  if (!CARE_LEVEL_REASONS.includes(action.entryReason))
    return "Choose a reason for the level change.";
  if (!clinicians.some((clinician) => clinician.id === action.authorisingPractitionerId))
    return "Choose the authorising clinician.";
  if (action.triggeringReviewId &&
      !episode.collections?.some((collection) =>
        collection.id === action.triggeringReviewId && collection.review === "Reviewed" &&
        (!collection.reviewDate || collection.reviewDate <= action.effectiveDate)))
    return "Choose a recorded clinical review or leave it blank.";
  return null;
}
