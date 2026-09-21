export const CARE_EVENT_TYPES = [
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
    label: "Inpatient admission",
    description:
      "A contextual record of an admission, discharge or known inpatient change, generated automatically upon successful intake.",
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
  [...CARE_EVENT_TYPES, ...SYSTEM_EVENT_TYPES, ...LEGACY_EVENT_TYPES].find(
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
  if (action.eventType === "medication") {
    if (!action.medicationName?.trim()) return "Enter the medication name.";
    if (!LEGACY_MEDICATION_CHANGES.includes(action.medicationChange))
      return "Choose what changed about the medication.";
  }
  if (action.eventType === "medication-adverse" && !action.medicationName?.trim())
    return "Enter the medication name if it is known.";
  if (action.eventType !== "medication" && !action.summary?.trim())
    return "Enter a factual event summary.";
  if (action.type === "CORRECT_CARE_EVENT" && !action.correctionReason?.trim())
    return "Explain why this event is being corrected.";
  return null;
}

const clean = (value) => value?.trim() || null;

export function careEventContent(action) {
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
    },
  };
}

export function careEventDetails(event) {
  const fields = event.fields ?? {};
  return [
    ["Medication", fields.medicationName],
    ["Source or observer", fields.source],
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
