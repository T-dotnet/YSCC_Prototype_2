import { appointmentDetails, appointmentTitle } from "./appointments.js";
import { assessmentsForContact, contactsForAssessment } from "./assessmentContacts.js";
import { careEventDetails, careEventType } from "./careEvents.js";
import { clinicalRecordDetails, clinicalRecordType } from "./clinicalRecords.js";

const CARE_LEVEL_ACTIONS = ["SET_INITIAL_CARE_LEVEL", "CHANGE_CARE_LEVEL", "END_CARE_EPISODE_FOR_LEVEL_CHANGE"];

export const historyDate = (entry) =>
  CARE_LEVEL_ACTIONS.includes(entry.actionType)
    ? entry.effectiveDate || entry.date || null
    : entry.type === "appointment"
    ? entry.actualDate || entry.plannedDate || entry.date || null
    : entry.type === "assessment"
      ? entry.date || entry.due || null
    : entry.type === "clinical-record"
      ? entry.recordDate || entry.date || null
      : entry.eventDate || entry.timestamp || entry.date || null;

export const historyCategory = (entry) =>
  CARE_LEVEL_ACTIONS.includes(entry.actionType)
    ? "care-level"
    : entry.type === "appointment" ? "appointment"
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
  "care-period": "Care episode",
  "care-level": "Care level changes",
};

const fact = (label, value) => ({ label, value });
const populated = ([, value]) => value !== null && value !== undefined && value !== "";

export function associatedCareItems(entry, episode) {
  if (entry.type === "appointment") {
    const appointmentId = entry.id?.replace(/^appointment-/, "");
    const appointment = episode.appointments?.find((item) => item.id === appointmentId);
    return (appointment ? assessmentsForContact(episode, appointmentId) : [])
      .map((collection) => ({
        id: collection.id,
        type: "Assessment",
        title: collection.label,
        subtitle: collection.version,
        date: collection.response === "Submitted" && collection.submittedAt
          ? collection.submittedAt.slice(0, 10) : collection.due,
        dateLabel: collection.response === "Submitted" && collection.submittedAt ? "Response" : "Due",
      }));
  }
  if (entry.type === "assessment") {
    const collection = episode.collections?.find((item) => item.id === entry.collectionId);
    if (!collection) return [];
    return contactsForAssessment(episode, collection.id)
      .map((appointment) => ({
        id: appointment.id,
        type: "Appointment",
        title: appointmentTitle(appointment),
        subtitle: appointment.contactType || appointment.appointmentType || appointment.practitionerService,
        date: appointment.actualDate || appointment.plannedDate,
        dateLabel: appointment.actualDate ? "Actual" : "Planned",
      }));
  }
  return [];
}

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
      subtitle: appointment.contactType || appointment.appointmentType || "Service contact",
      date: historyDate(entry),
      dateLabel: appointment.actualDate ? "Actual contact"
        : appointment.attendance === "Cancelled" ? "Cancelled contact"
          : appointment.attendance === "Did not attend" ? "Missed contact"
            : "Planned contact",
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

  if (entry.type === "assessment") {
    const collection = episode.collections.find((item) => item.id === entry.collectionId);
    const contacts = collection ? contactsForAssessment(episode, collection.id) : [];
    if (collection) return {
      subtitle: collection.version,
      date: historyDate(entry),
      dateLabel: collection.response === "Submitted" && collection.submittedAt
        ? "Response date" : "Due date",
      primary: [
        fact("Response", collection.response),
        fact("Due date", collection.due),
        ...(contacts.length ? [fact("Related contacts", contacts.map((item) =>
          `${item.contactType || item.appointmentType || "Service contact"} · ${item.actualDate || item.plannedDate}`).join(", "))] : []),
      ],
      more: [
        fact("Collection method", collection.channel || "Not set up"),
        fact("Assignment", collection.assignment),
        fact("Review", collection.review),
      ],
    };
  }

  if (entry.eventDate) {
    const details = careEventDetails(entry).map(([label, value]) => fact(label, value));
    const rawDetail = formatDetail(entry.detail);
    const note = entry.fields?.notes;
    const usefulDetail = rawDetail && rawDetail !== note && rawDetail !== entry.fields?.status && rawDetail !== "Contextual care event recorded."
      ? [fact("Summary", rawDetail)]
      : [];
    const primaryLabels = ["Source or observer", "Source or authority", "Source status", "Impact on care", "Medication"];
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

  if (entry.actionType === "END_CARE_EPISODE_FOR_LEVEL_CHANGE") {
    return {
      subtitle: "Care episode transition",
      date: historyDate(entry),
      dateLabel: "Effective",
      primary: [
        fact("From level", entry.fromCareLevel),
        fact("New level", entry.toCareLevel),
        fact("Next care episode", entry.nextEpisodeNumber),
      ],
      more: [fact("Reason", entry.entryReason || episode.reason), ...metadata],
    };
  }

  if (["SET_INITIAL_CARE_LEVEL", "CHANGE_CARE_LEVEL"].includes(entry.actionType)) {
    const period = episode.carePeriods?.find((item) => item.id === entry.carePeriodId);
    const review = episode.collections?.find((item) => item.id === period?.triggeringReviewId);
    return {
      subtitle: "Care level",
      date: historyDate(entry),
      dateLabel: "Effective",
      primary: [
        ...(period?.programStream ? [fact("Program stream", period.programStream)] : []),
        ...(period?.previousCareLevel ? [fact("From level", period.previousCareLevel)] : []),
        ...(period ? [fact("Care level", period.careLevel), fact("Delivering team or pod", period.deliveringUnit)] : []),
      ],
      more: [
        ...(period?.entryReason ? [fact("Reason", period.entryReason)] : []),
        ...(review ? [fact("Triggering review", review.label)] : []),
        ...(period?.authorisingPractitioner ? [fact("Authorising clinician", period.authorisingPractitioner)] : []),
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
    subtitle: entry.scope?.startsWith("Referral") ? "Referral" : entry.scope === "Intake" ? "Intake" : assessment ? "Assessment activity" : entry.actionType === "SAVE_PROGRESS_REPORT" ? "Report" : entry.title?.startsWith("Care episode") ? "Care episode" : entry.scope || "Care history",
    date: historyDate(entry),
    dateLabel: null,
    primary: primary.slice(0, 3),
    more: [...primary.slice(3), ...metadata, ...(entry.scope?.startsWith("Referral") ? [fact("Destination", entry.scope.slice(11))] : [])],
  };
}
