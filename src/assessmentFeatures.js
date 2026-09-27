// Older saved workspaces have only the presentation-mode setting. Preserve
// their existing behaviour until each feature is explicitly configured.
export const assessmentSchedulingEnabled = (settings) =>
  settings?.scheduleAssessments ?? !settings?.simpleAssessments;

export const assessmentContactLinkingEnabled = (settings) =>
  settings?.linkAssessmentAppointments ?? !settings?.simpleAssessments;

export const assessmentSmsEnabled = (settings) =>
  settings?.assessmentSms ?? true;

export const assessmentHistoryEntryVisible = (entry, settings) => {
  const title = entry.title || "";
  const detail = entry.detail || "";
  if (!assessmentSmsEnabled(settings) &&
      (entry.channel === "SMS link" || entry.deliveryMode === "SMS" || title.includes("SMS") ||
        title === "Sample questionnaire link prepared" || detail.includes("SMS link"))) return false;
  if (!assessmentContactLinkingEnabled(settings) &&
      (title === "Assessment contact linked" || title === "Contact linked to assessment")) return false;
  if (!assessmentSchedulingEnabled(settings) &&
      (title === "Follow-up planned" || title === "Assessment scheduled")) return false;
  return true;
};
