import { appointmentDetails } from "./appointments.js";
import { careEventDetails, careEventType } from "./careEvents.js";
import { clinicalRecordDetails, clinicalRecordType } from "./clinicalRecords.js";

export const historyDate = (entry) =>
  entry.type === "appointment"
    ? entry.actualDate || entry.plannedDate || entry.date || null
    : entry.type === "clinical-record"
      ? entry.recordDate || entry.date || null
      : entry.eventDate || entry.timestamp || entry.date || null;

export const historyCategory = (entry) =>
  entry.type === "appointment" ? "appointment"
    : entry.type === "clinical-record" ? "clinical-record"
      : entry.eventDate ? "contextual-event"
        : entry.collectionId ? "assessment"
          : entry.scope === "Intake" ? "intake"
            : entry.scope?.startsWith("Referral") ? "referral"
              : entry.actionType === "SAVE_PROGRESS_REPORT" ? "report"
                : "care-period";

export const HISTORY_CATEGORIES = {
  appointment: "Appointments",
  "clinical-record": "Structured care records",
  "contextual-event": "Contextual events",
  assessment: "Assessment activity",
  intake: "Intake",
  referral: "Referrals",
  report: "Reports",
  "care-period": "Care period",
};

const fact = (label, value) => ({ label, value });
const populated = ([, value]) => value !== null && value !== undefined && value !== "";

export function historyItem(entry, episode, formatDetail = (value) => value) {
  const appointment = entry.type === "appointment"
    ? episode.appointments?.find((item) => `appointment-${item.id}` === entry.id)
    : null;
  const recordedBy = entry.actor
    ? `${entry.actor}${entry.role ? ` · ${entry.role}` : ""}`
    : null;
  const metadata = [
    ...(recordedBy ? [fact("Recorded by", recordedBy)] : []),
    ...(entry.timestamp && (entry.type === "appointment" || entry.type === "clinical-record" || entry.eventDate || entry.timestamp.slice(0, 10) !== historyDate(entry)?.slice(0, 10))
      ? [fact("Recorded at", entry.timestamp)]
      : []),
  ];

  if (appointment) {
    const primaryLabels = [
      "Practitioner or service",
      "Delivery mode",
      appointment.actualDate ? "Actual duration" : "Planned duration",
    ];
    const shownDateLabel = appointment.actualDate ? "Actual date" : "Planned date";
    const shownTimeLabel = appointment.actualDate ? "Actual time" : "Planned time";
    const details = appointmentDetails(appointment, episode)
      .filter(([label]) => label !== shownDateLabel && label !== shownTimeLabel && label !== "Attendance")
      .map(([label, value]) => fact(label, value));
    return {
      subtitle: "Appointment or service contact",
      date: historyDate(entry),
      dateLabel: appointment.actualDate ? "Actual contact" : "Planned contact",
      time: appointment.actualTime || appointment.plannedTime,
      primary: primaryLabels.map((label) => details.find((detail) => detail.label === label)).filter(Boolean),
      more: [...details.filter(({ label }) => !primaryLabels.includes(label)), ...metadata],
    };
  }

  if (entry.type === "clinical-record") {
    const details = clinicalRecordDetails(entry)
      .filter(([label, value]) => populated([label, value]) && value !== entry.title)
      .map(([label, value]) => fact(label, value));
    const primaryLabels = ["Recorded risk status", "Status", "Recorded change", "Collection status", "Recorded value", "Source or authority"];
    return {
      subtitle: clinicalRecordType(entry.recordType)?.label || "Structured care record",
      date: historyDate(entry),
      dateLabel: "Record date",
      primary: details.filter(({ label }) => primaryLabels.includes(label)),
      more: [...details.filter(({ label }) => !primaryLabels.includes(label)), ...metadata],
    };
  }

  if (entry.eventDate) {
    const details = careEventDetails(entry).map(([label, value]) => fact(label, value));
    const rawDetail = formatDetail(entry.detail);
    const note = entry.fields?.notes;
    const usefulDetail = rawDetail && rawDetail !== note && rawDetail !== "Contextual care event recorded."
      ? [fact("Summary", rawDetail)]
      : [];
    const primaryLabels = ["Source or observer", "Impact on care", "Medication"];
    const primary = [
      ...details.filter(({ label }) => primaryLabels.includes(label)),
      ...usefulDetail,
    ];
    return {
      subtitle: careEventType(entry.eventType)?.label || "Contextual event",
      date: historyDate(entry),
      dateLabel: "Event date",
      primary: primary.length ? primary : details.filter(({ label }) => label === "Notes"),
      more: [
        ...details.filter(({ label }) => !primaryLabels.includes(label) && (primary.length || label !== "Notes")),
        ...metadata,
      ],
    };
  }

  const assessment = entry.collectionId
    ? episode.collections.find((collection) => collection.id === entry.collectionId)
    : null;
  const detail = formatDetail(entry.detail) || "";
  const cleanDetail = assessment && detail.startsWith(`${assessment.label} · `)
    ? detail.slice(assessment.label.length + 3)
    : detail;
  const usefulDetail = cleanDetail === "Clinical review recorded" ? "" : cleanDetail;
  const detailLabel = entry.title === "Questionnaire response received" &&
    usefulDetail === assessment?.version ? "Questionnaire version" : "Summary";
  const primary = [
    ...(assessment ? [fact("Assessment", assessment.label)] : []),
    ...(entry.attemptRespondent ? [fact("Respondent", entry.attemptRespondent)] : []),
    ...(entry.attemptChannel ? [fact("Channel", entry.attemptChannel)] : []),
    ...(entry.attemptStatus ? [fact("Status", entry.attemptStatus)] : []),
    ...(usefulDetail && !entry.attemptRespondent ? [fact(detailLabel, usefulDetail)] : []),
  ];
  return {
    subtitle: entry.scope?.startsWith("Referral") ? "Referral" : entry.scope === "Intake" ? "Intake" : assessment ? "Assessment activity" : entry.actionType === "SAVE_PROGRESS_REPORT" ? "Report" : entry.title?.startsWith("Care episode") ? "Care period" : entry.scope || "Care history",
    date: historyDate(entry),
    dateLabel: null,
    primary: primary.slice(0, 3),
    more: [...primary.slice(3), ...metadata, ...(entry.scope?.startsWith("Referral") ? [fact("Destination", entry.scope.slice(11))] : [])],
  };
}
