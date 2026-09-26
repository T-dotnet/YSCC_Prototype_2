import { carePeriodAt } from "./carePeriods.js";
import { assessmentsForContact } from "./assessmentContacts.js";

export const APPOINTMENT_ATTENDANCE = [
  "Planned",
  "Attended",
  "Cancelled",
  "Did not attend",
];

export const APPOINTMENT_DELIVERY_MODES = [
  "In person",
  "Phone",
  "Video",
  "Outreach or community",
  "Other",
];

// Candidate prototype values. The approved program and PMHC-MDS mappings are still pending.
export const CONTACT_RECIPIENTS = ["Young person", "Related person"];
export const CONTACT_TYPES = [
  "Assessment", "Care review", "Family work", "Group", "Functional recovery",
  "Physical health", "Peer work", "Other direct contact",
];
export const CONTACT_VENUES = [
  "Clinic", "Home", "School", "Community", "Outreach", "On Country",
  "Telehealth", "Other",
];
export const CONTACT_PARTICIPANTS = ["Individual", "Group", "With family"];
export const CONTACT_YES_NO = ["Yes", "No"];

const validDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
  Number.isFinite(new Date(`${value}T12:00:00`).getTime()) &&
  new Date(`${value}T12:00:00`).toISOString().slice(0, 10) === value;

const validTime = (value) =>
  /^\d{2}:\d{2}$/.test(value || "") &&
  (() => {
    const [hours, minutes] = value.split(":").map(Number);
    return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60;
  })();

const validDuration = (value) =>
  /^\d+$/.test(String(value || "")) && Number(value) > 0 && Number(value) <= 600;

const withinCarePeriod = (episode, date, today) =>
  date >= episode.start &&
  date <= (episode.end && episode.end < today ? episode.end : today);

const validContact = (action, prior = {}) => {
  const value = (key) => key in action ? action[key] : prior[key];
  const recipient = value("recipientType");
  const contactType = value("contactType");
  const primary = value("primaryPractitioner");
  if (!CONTACT_RECIPIENTS.includes(recipient))
    return "Choose who received the direct contact.";
  if (recipient === "Related person" && !value("relatedPersonName")?.trim())
    return "Enter the related person's name.";
  if (!CONTACT_TYPES.includes(contactType))
    return "Choose a direct contact type.";
  if (!primary?.trim())
    return "Enter the primary practitioner for the attended contact.";
  for (const [key, values, label] of [
    ["venue", CONTACT_VENUES, "venue"],
    ["participants", CONTACT_PARTICIPANTS, "participants"],
    ["interpreter", CONTACT_YES_NO, "interpreter use"],
    ["copayment", CONTACT_YES_NO, "co-payment"],
    ["finalContact", CONTACT_YES_NO, "final-contact status"],
  ]) {
    const selected = value(key);
    if (selected && !values.includes(selected)) return `Choose a valid ${label}.`;
  }
  if (value("postcode") && !/^\d{4}$/.test(value("postcode")))
    return "Enter a four-digit contact postcode.";
  return null;
};

export function appointmentError(episode, action, today) {
  if (!episode) return "The selected care episode is unavailable.";
  if (!validDate(action.plannedDate) || !validTime(action.plannedTime))
    return "Enter a valid planned date and time.";
  if (action.plannedDate < episode.start || (episode.end && action.plannedDate > episode.end))
    return "The planned contact must be within this care episode.";
  if (!validDuration(action.plannedDurationMinutes))
    return "Enter a planned duration between 1 and 600 minutes.";
  if (!action.practitionerService?.trim())
    return "Enter the practitioner or service.";
  if (!APPOINTMENT_DELIVERY_MODES.includes(action.deliveryMode))
    return "Choose a delivery mode.";
  if (!APPOINTMENT_ATTENDANCE.includes(action.attendance))
    return "Choose the contact status.";
  const duplicate = (episode.appointments || []).some(
    (appointment) =>
      appointment.plannedDate === action.plannedDate &&
      appointment.plannedTime === action.plannedTime &&
      appointment.practitionerService === action.practitionerService,
  );
  if (duplicate)
    return "A contact with the same planned date, time and practitioner or service already exists. Check the existing record before adding another.";
  const collectionIds = action.collectionIds ?? (action.collectionId ? [action.collectionId] : []);
  if (!Array.isArray(collectionIds) || new Set(collectionIds).size !== collectionIds.length)
    return "Choose valid assessments to associate with this contact.";
  for (const collectionId of collectionIds) {
    const collection = episode.collections?.find((item) => item.id === collectionId);
    if (!collection || ["Cancelled", "Paused"].includes(collection.assignment))
      return "A selected assessment is unavailable in this care episode.";
  }
  if (action.attendance !== "Attended") return null;
  const contactError = validContact(action);
  if (contactError) return contactError;
  if (!validDate(action.actualDate) || !validTime(action.actualTime))
    return "Enter the actual contact date and time.";
  if (!withinCarePeriod(episode, action.actualDate, today))
    return "The actual contact must be within this care episode and cannot be in the future.";
  if (!validDuration(action.actualDurationMinutes))
    return "Enter the actual duration between 1 and 600 minutes.";
  return null;
}

export function appointmentOutcomeError(episode, appointment, action, today) {
  if (!episode || !appointment)
    return "The selected appointment or service contact is unavailable.";
  if (episode.status !== "Active")
    return "An outcome can only be recorded while this care episode is active.";
  if (appointment.attendance !== "Planned")
    return "An outcome has already been recorded for this appointment or service contact.";
  if (!APPOINTMENT_ATTENDANCE.includes(action.attendance) || action.attendance === "Planned")
    return "Choose an attended, cancelled or did-not-attend outcome.";
  if (action.attendance !== "Attended") return null;
  const contactError = validContact(action, appointment);
  if (contactError) return contactError;
  if (!validDate(action.actualDate) || !validTime(action.actualTime))
    return "Enter the actual contact date and time.";
  if (!withinCarePeriod(episode, action.actualDate, today))
    return "The actual contact must be within this care episode and cannot be in the future.";
  if (!validDuration(action.actualDurationMinutes))
    return "Enter the actual duration between 1 and 600 minutes.";
  return null;
}

const clean = (value) => value?.trim() || null;
const names = (value) =>
  (Array.isArray(value) ? value : value?.split(",") || [])
    .map((name) => name.trim()).filter(Boolean);

export function contactAttributes(action) {
  return {
    recipientType: clean(action.recipientType),
    relatedPersonName: action.recipientType === "Related person" ? clean(action.relatedPersonName) : null,
    contactType: clean(action.contactType),
    venue: clean(action.venue),
    participants: clean(action.participants),
    postcode: clean(action.postcode),
    registeredUnit: clean(action.registeredUnit),
    servicingUnit: clean(action.servicingUnit),
    deliveringUnit: clean(action.deliveringUnit),
    primaryPractitioner: clean(action.primaryPractitioner),
    additionalPractitioners: names(action.additionalPractitioners),
    interpreter: clean(action.interpreter),
    copayment: clean(action.copayment),
    fundingSource: clean(action.fundingSource),
    finalContact: clean(action.finalContact),
  };
}

export function appointmentContent(action) {
  const actual =
    action.attendance === "Attended"
      ? {
          actualDate: action.actualDate,
          actualTime: action.actualTime,
          actualDurationMinutes: Number(action.actualDurationMinutes),
        }
      : {
          actualDate: null,
          actualTime: null,
          actualDurationMinutes: null,
        };
  return {
    plannedDate: action.plannedDate,
    plannedTime: action.plannedTime,
    plannedDurationMinutes: Number(action.plannedDurationMinutes),
    practitionerService: action.practitionerService.trim(),
    deliveryMode: action.deliveryMode,
    attendance: action.attendance,
    assessmentIntakeId: action.assessmentIntakeId || null,
    purpose: clean(action.purpose),
    impact: clean(action.impact),
    notes: clean(action.notes),
    ...contactAttributes(action),
    ...actual,
  };
}

export function appointmentOutcomeContent(action, appointment) {
  const actual =
    action.attendance === "Attended"
      ? {
          actualDate: action.actualDate,
          actualTime: action.actualTime,
          actualDurationMinutes: Number(action.actualDurationMinutes),
        }
      : {
          actualDate: null,
          actualTime: null,
          actualDurationMinutes: null,
        };
  return {
    attendance: action.attendance,
    assessmentIntakeId: Object.hasOwn(action, "assessmentIntakeId")
      ? action.assessmentIntakeId || null : appointment.assessmentIntakeId || null,
    outcomeNotes: clean(action.outcomeNotes),
    ...contactAttributes({ ...appointment, ...action }),
    ...actual,
  };
}


export function appointmentRecordDate(appointment) {
  return appointment.attendance === "Attended" && appointment.actualDate
    ? appointment.actualDate
    : appointment.plannedDate;
}

export function appointmentIsOverdue(appointment, today) {
  return appointment.attendance === "Planned" && appointment.plannedDate < today;
}

export function appointmentTitle(appointment) {
  const noun = appointment.contactType ? "Service contact" : "Appointment";
  return appointment.attendance === "Planned"
    ? `Planned ${noun.toLowerCase()}`
    : `${noun} ${appointment.attendance.toLowerCase()}`;
}

export function appointmentSummary(appointment) {
  const planned = `Planned ${appointment.plannedDate} at ${appointment.plannedTime} · ${appointment.plannedDurationMinutes} min · ${appointment.practitionerService} · ${appointment.deliveryMode}`;
  const actual = appointment.actualDate
    ? ` · Actual ${appointment.actualDate} at ${appointment.actualTime} · ${appointment.actualDurationMinutes} min`
    : "";
  const notes = [appointment.notes, appointment.outcomeNotes]
    .filter(Boolean)
    .join(" · ");
  const contact = [appointment.contactType, appointment.recipientType, appointment.relatedPersonName]
    .filter(Boolean).join(" · ");
  return `${planned} · ${appointment.attendance}${actual}${contact ? ` · ${contact}` : ""}${notes ? ` · ${notes}` : ""}`;
}

export function appointmentMatchesCollectionDate(appointment, collection) {
  const appointmentDates = [appointment.plannedDate, appointment.actualDate].filter(Boolean);
  const collectionDates = [collection.due, collection.submittedAt?.slice(0, 10)].filter(Boolean);
  return appointmentDates.some((date) => collectionDates.includes(date));
}

export function associatedCollections(appointment, episode) {
  return assessmentsForContact(episode, appointment.id);
}

export function appointmentDetails(appointment, episode) {
  const associated = associatedCollections(appointment, episode);
  const contactDate = appointment.attendance === "Planned"
    ? null
    : appointment.actualDate || appointment.plannedDate;
  const levelAtContact = carePeriodAt(episode, contactDate);
  const details = [
    ["Planned date", appointment.plannedDate],
    ["Planned time", appointment.plannedTime],
    ["Planned duration", appointment.plannedDurationMinutes && `${appointment.plannedDurationMinutes} min`],
    ["Practitioner or service", appointment.practitionerService],
    ["Delivery mode", appointment.deliveryMode],
    ["Attendance", appointment.attendance],
    ["Initial assessment", appointment.assessmentIntakeId ? "Associated" : null],
    ["Care level on contact date", levelAtContact?.careLevel],
    ["Direct contact type", appointment.contactType],
    ["Recipient", appointment.recipientType],
    ["Related person", appointment.relatedPersonName],
    ["Venue", appointment.venue],
    ["Participants", appointment.participants],
    ["Contact postcode", appointment.postcode],
    ["Registered unit", appointment.registeredUnit],
    ["Servicing unit", appointment.servicingUnit],
    ["Delivering unit", appointment.deliveringUnit],
    ["Primary practitioner", appointment.primaryPractitioner],
    ["Other practitioners", appointment.additionalPractitioners?.join(", ")],
    ["Interpreter used", appointment.interpreter],
    ["Co-payment", appointment.copayment],
    ["Funding source", appointment.fundingSource],
    ["Final contact", appointment.finalContact],
    ["Actual date", appointment.actualDate],
    ["Actual time", appointment.actualTime],
    ["Actual duration", appointment.actualDurationMinutes && `${appointment.actualDurationMinutes} min`],
    ["Purpose or care context", appointment.purpose],
    ["Impact on care or coordination", appointment.impact],
    ["Notes", appointment.notes],
    ["Outcome notes", appointment.outcomeNotes],
  ];
  if (associated.length > 0) {
    details.push([
      "Associated assignment" + (associated.length > 1 ? "s" : ""),
      associated.map((c) => c.label).join(", "),
    ]);
  }
  return details.filter(([, value]) => value);
}

export function appointmentChanges(appointment) {
  return [
    ["plannedDate", "Planned date", appointment.plannedDate],
    ["plannedTime", "Planned time", appointment.plannedTime],
    ["plannedDurationMinutes", "Planned duration", `${appointment.plannedDurationMinutes} min`],
    ["practitionerService", "Practitioner or service", appointment.practitionerService],
    ["deliveryMode", "Delivery mode", appointment.deliveryMode],
    ["attendance", "Attendance", appointment.attendance],
    ["assessmentIntakeId", "Initial assessment association", appointment.assessmentIntakeId],
    ["contactType", "Direct contact type", appointment.contactType],
    ["recipientType", "Recipient", appointment.recipientType],
    ["relatedPersonName", "Related person", appointment.relatedPersonName],
    ["venue", "Venue", appointment.venue],
    ["participants", "Participants", appointment.participants],
    ["postcode", "Contact postcode", appointment.postcode],
    ["registeredUnit", "Registered unit", appointment.registeredUnit],
    ["servicingUnit", "Servicing unit", appointment.servicingUnit],
    ["deliveringUnit", "Delivering unit", appointment.deliveringUnit],
    ["primaryPractitioner", "Primary practitioner", appointment.primaryPractitioner],
    ["additionalPractitioners", "Other practitioners", appointment.additionalPractitioners?.join(", ")],
    ["interpreter", "Interpreter used", appointment.interpreter],
    ["copayment", "Co-payment", appointment.copayment],
    ["fundingSource", "Funding source", appointment.fundingSource],
    ["finalContact", "Final contact", appointment.finalContact],
    ["actualDate", "Actual date", appointment.actualDate],
    ["actualTime", "Actual time", appointment.actualTime],
    ["actualDurationMinutes", "Actual duration", appointment.actualDurationMinutes && `${appointment.actualDurationMinutes} min`],
    ["purpose", "Purpose or care context", appointment.purpose],
    ["impact", "Impact on care or coordination", appointment.impact],
    ["notes", "Notes", appointment.notes],
    ["outcomeNotes", "Outcome notes", appointment.outcomeNotes],
  ]
    .filter(([, , value]) => value)
    .map(([key, label, after]) => ({ key, label, before: null, after }));
}
