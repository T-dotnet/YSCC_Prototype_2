import { validExternalSlot } from "./externalAppointmentSlots.js";

const validDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
  Number.isFinite(new Date(`${value}T12:00:00Z`).getTime()) &&
  new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;

export const REPORT_EVENT_TYPES = [
  {
    value: "medication-course",
    label: "Medication course",
    description: "A documented medication course period.",
  },
  {
    value: "service-period",
    label: "Care setting or service period",
    description: "A documented care or service period.",
  },
  {
    value: "goal-milestone",
    label: "Goal milestone",
    description: "A dated update to a care goal.",
  },
];

export const CARE_EVENT_TYPES = [
  {
    value: "indirect-activity",
    label: "Indirect service activity",
    description:
      "Record service work completed on behalf of the person without a direct contact.",
  },
  {
    value: "harm",
    label: "Harm to self or others",
    description:
      "A factual contextual record. This does not replace an approved safety or risk-management record.",
  },
  {
    value: "medication-adverse",
    label: "Medication adverse event",
    description:
      "A contextual record of an adverse medication event, not a medication chart or prescription instruction.",
  },
  {
    value: "housing",
    label: "Housing instability or homelessness",
    description:
      "A contextual record of a housing change that may affect care coordination.",
  },
  {
    value: "care-transition",
    label: "Major care or service transition",
    description:
      "A step-up, step-down or other major change in care coordination, support, service or provider.",
  },
  {
    value: "other",
    label: "Other contextual event",
    description: "Another event that may help explain the care journey.",
  },
];

export const SYSTEM_EVENT_TYPES = [
  {
    value: "inpatient",
    label: "Inpatient care change",
    description:
      "A contextual record of an admission, discharge or known inpatient change. The episode review dates stay in place.",
  },
];

const LEGACY_EVENT_TYPES = [
  { value: "medication", label: "Medication change (legacy)" },
  { value: "care-service", label: "Care or service change (legacy)" },
  { value: "life-event", label: "Significant life event (legacy)" },
];

const LEGACY_MEDICATION_CHANGES = [
  "Started",
  "Stopped",
  "Dose changed",
  "Medication reviewed",
];

export const careEventType = (value) =>
  [...REPORT_EVENT_TYPES, ...CARE_EVENT_TYPES, ...SYSTEM_EVENT_TYPES, ...LEGACY_EVENT_TYPES].find(
    (type) => type.value === value,
  );

export function careEventError(episode, action, today) {
  if (!episode) return "The selected care period is unavailable.";
  if (!careEventType(action.eventType)) return "Choose an event type.";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(action.eventDate || "") ||
    !Number.isFinite(new Date(`${action.eventDate}T12:00:00`).getTime()) ||
    new Date(`${action.eventDate}T12:00:00`).toISOString().slice(0, 10) !==
      action.eventDate
  )
    return "Enter a valid event date.";
  if (action.eventDate < episode.start)
    return "The event date must be within this care period.";
  const latestDate = episode.end && episode.end < today ? episode.end : today;
  if (action.eventDate > latestDate)
    return "The event date cannot be after this care period or in the future.";
  if (["medication-course", "service-period"].includes(action.eventType)) {
    if (action.eventType === "medication-course" && !action.courseName?.trim())
      return "Enter the medication or course name.";
    if (action.eventType === "service-period" && !action.periodName?.trim())
      return "Enter the care setting or service.";
    if (action.eventType === "medication-course" && !action.endDate)
      return "Enter the documented course end date.";
    if (action.endDate && (!validDate(action.endDate) || action.endDate <= action.eventDate || action.endDate > latestDate))
      return "The end date must be after the start date and within this care period.";
  }
  if (action.eventType === "goal-milestone" && !action.goalTitle?.trim())
    return "Enter the goal.";
  if (action.eventType === "care-transition") {
    if (action.endDate && !action.periodName?.trim())
      return "Enter the service or care period name for its end date.";
    if (action.reportStatus && !action.periodName?.trim())
      return "Enter the service or care period name for its status.";
    if (action.endDate && (!validDate(action.endDate) || action.endDate <= action.eventDate || action.endDate > latestDate))
      return "The period end date must follow its start and be within this care period.";
    if (action.reportStatus && !["Planned", "Started", "Delivered", "Ended"].includes(action.reportStatus))
      return "Choose a valid period status.";
    if (action.periodName?.trim() && !action.source?.trim())
      return "Enter the source or authority for this period.";
  }
  if (["medication-course", "service-period", "goal-milestone"].includes(action.eventType)) {
    const statuses = {
      "medication-course": ["Start and end recorded", "Completed", "Stopped early"],
      "service-period": ["Planned", "Started", "Delivered", "Ended"],
      "goal-milestone": ["Started", "Reviewed", "Progressed", "Achieved", "Paused", "Stopped"],
    };
    if (!statuses[action.eventType].includes(action.reportStatus)) return "Choose a valid source status.";
    if (!action.source?.trim()) return "Enter the source or authority.";
  }
  if (action.externalAppointment &&
      (!validExternalSlot(action.externalAppointment) || action.externalAppointment.date < today))
    return "Choose an available external contact.";
  if (action.eventType === "medication") {
    if (!action.medicationName?.trim()) return "Enter the medication name.";
    if (!LEGACY_MEDICATION_CHANGES.includes(action.medicationChange))
      return "Choose what changed about the medication.";
  }
  if (action.eventType === "medication-adverse" && !action.medicationName?.trim())
    return "Enter the medication name if it is known.";
  if (!["medication", "medication-course", "service-period", "goal-milestone", "care-transition"].includes(action.eventType) && !action.summary?.trim())
    return "Enter a factual event summary.";
  if (action.type === "CORRECT_CARE_EVENT" && !action.correctionReason?.trim())
    return "Explain why this event is being corrected.";
  return null;
}

const clean = (value) => value?.trim() || null;

export function careEventContent(action) {
  if (action.eventType === "care-transition")
    return {
      title: clean(action.summary) || (clean(action.periodName) ? `${clean(action.periodName)} · care or service change` : "Care or service change"),
      detail: clean(action.notes) || "Care or service change recorded.",
      fields: {
        periodName: clean(action.periodName),
        endDate: clean(action.endDate),
        status: clean(action.reportStatus),
        source: clean(action.source),
        impact: clean(action.impact),
        notes: clean(action.notes),
        externalAppointment: action.externalAppointment || null,
      },
    };
  if (["medication-course", "service-period", "goal-milestone"].includes(action.eventType)) {
    const title = action.eventType === "medication-course" ? action.courseName.trim()
      : action.eventType === "service-period" ? action.periodName.trim()
        : action.goalTitle.trim();
    return {
      title,
      detail: action.reportStatus,
      fields: {
        source: action.source.trim(),
        status: action.reportStatus,
        endDate: clean(action.endDate),
        impact: clean(action.impact),
        notes: clean(action.notes),
      },
    };
  }
  if (action.eventType === "medication") {
    const medicationName = action.medicationName.trim();
    const medicationChange = action.medicationChange;
    return {
      title:
        medicationChange === "Dose changed"
          ? `${medicationName} dose changed`
          : medicationChange === "Medication reviewed"
            ? `${medicationName} reviewed`
            : `${medicationName} ${medicationChange.toLowerCase()}`,
      detail: clean(action.notes) || `${medicationChange} recorded.`,
      fields: {
        medicationName,
        medicationChange,
        dose: clean(action.dose),
        reason: clean(action.reason),
        notes: clean(action.notes),
      },
    };
  }
  return {
    title: action.summary.trim(),
    detail: clean(action.notes) || "Contextual care event recorded.",
    fields: {
      medicationName: clean(action.medicationName),
      source: clean(action.source),
      impact: clean(action.impact),
      notes: clean(action.notes),
      externalAppointment: action.externalAppointment || null,
    },
  };
}

export function careEventDetails(event) {
  const fields = event.fields ?? {};
  const reportItem = ["medication-course", "service-period", "goal-milestone"].includes(event.eventType);
  return [
    ["External contact", fields.externalAppointment && `${fields.externalAppointment.date} at ${fields.externalAppointment.time} · ${fields.externalAppointment.practitionerService} · ${fields.externalAppointment.deliveryMode}`],
    ["Medication", fields.medicationName],
    [reportItem ? "Source or authority" : "Source or observer", fields.source],
    ["Source status", fields.status],
    ["End date", fields.endDate],
    ["Service or care period", fields.periodName],
    ["Impact on care", fields.impact],
    ["Notes", fields.notes],
    ["Correction reason", event.correctionReason],
  ].filter(([, value]) => value);
}

export function recordedCareEvents(episode) {
  return (episode?.events ?? [])
    .filter((event) =>
      ["ADD_CARE_EVENT", "CORRECT_CARE_EVENT"].includes(event.actionType),
    )
    .sort(
      (a, b) =>
        (b.eventDate || b.date || "").localeCompare(
          a.eventDate || a.date || "",
        ) || (b.timestamp || "").localeCompare(a.timestamp || ""),
    );
}

// The overview shows the latest recorded instance of each current event type.
// Historical event labels remain available in the Events timeline, but are not
// presented as current event categories.
export function latestCareEventsByType(episode) {
  const events = recordedCareEvents(episode);
  return CARE_EVENT_TYPES.map((type) => ({
    ...type,
    event: events.find((event) => event.eventType === type.value) || null,
  }));
}
