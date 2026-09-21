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

export function appointmentError(episode, action, today) {
  if (!episode) return "The selected care period is unavailable.";
  if (!validDate(action.plannedDate) || !validTime(action.plannedTime))
    return "Enter a valid planned date and time.";
  if (action.plannedDate < episode.start || (episode.end && action.plannedDate > episode.end))
    return "The planned contact must be within this care period.";
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
  if (action.attendance !== "Attended") return null;
  if (!validDate(action.actualDate) || !validTime(action.actualTime))
    return "Enter the actual contact date and time.";
  if (!withinCarePeriod(episode, action.actualDate, today))
    return "The actual contact must be within this care period and cannot be in the future.";
  if (!validDuration(action.actualDurationMinutes))
    return "Enter the actual duration between 1 and 600 minutes.";
  return null;
}

export function appointmentOutcomeError(episode, appointment, action, today) {
  if (!episode || !appointment)
    return "The selected appointment or service contact is unavailable.";
  if (episode.status !== "Active")
    return "An outcome can only be recorded while this care period is active.";
  if (appointment.attendance !== "Planned")
    return "An outcome has already been recorded for this appointment or service contact.";
  if (!APPOINTMENT_ATTENDANCE.includes(action.attendance) || action.attendance === "Planned")
    return "Choose an attended, cancelled or did-not-attend outcome.";
  if (action.attendance !== "Attended") return null;
  if (!validDate(action.actualDate) || !validTime(action.actualTime))
    return "Enter the actual contact date and time.";
  if (!withinCarePeriod(episode, action.actualDate, today))
    return "The actual contact must be within this care period and cannot be in the future.";
  if (!validDuration(action.actualDurationMinutes))
    return "Enter the actual duration between 1 and 600 minutes.";
  return null;
}

const clean = (value) => value?.trim() || null;

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
    notes: clean(action.notes),
    ...actual,
  };
}

export function appointmentOutcomeContent(action) {
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
    outcomeNotes: clean(action.outcomeNotes),
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
  return appointment.attendance === "Planned"
    ? "Appointment planned"
    : `Appointment ${appointment.attendance.toLowerCase()}`;
}

export function appointmentSummary(appointment) {
  const planned = `Planned ${appointment.plannedDate} at ${appointment.plannedTime} · ${appointment.plannedDurationMinutes} min · ${appointment.practitionerService} · ${appointment.deliveryMode}`;
  const actual = appointment.actualDate
    ? ` · Actual ${appointment.actualDate} at ${appointment.actualTime} · ${appointment.actualDurationMinutes} min`
    : "";
  const notes = [appointment.notes, appointment.outcomeNotes]
    .filter(Boolean)
    .join(" · ");
  return `${planned} · ${appointment.attendance}${actual}${notes ? ` · ${notes}` : ""}`;
}

export function appointmentDetails(appointment) {
  return [
    ["Planned date", appointment.plannedDate],
    ["Planned time", appointment.plannedTime],
    ["Planned duration", appointment.plannedDurationMinutes && `${appointment.plannedDurationMinutes} min`],
    ["Practitioner or service", appointment.practitionerService],
    ["Delivery mode", appointment.deliveryMode],
    ["Attendance", appointment.attendance],
    ["Actual date", appointment.actualDate],
    ["Actual time", appointment.actualTime],
    ["Actual duration", appointment.actualDurationMinutes && `${appointment.actualDurationMinutes} min`],
    ["Notes", appointment.notes],
    ["Outcome notes", appointment.outcomeNotes],
  ].filter(([, value]) => value);
}

export function appointmentChanges(appointment) {
  return [
    ["plannedDate", "Planned date", appointment.plannedDate],
    ["plannedTime", "Planned time", appointment.plannedTime],
    ["plannedDurationMinutes", "Planned duration", `${appointment.plannedDurationMinutes} min`],
    ["practitionerService", "Practitioner or service", appointment.practitionerService],
    ["deliveryMode", "Delivery mode", appointment.deliveryMode],
    ["attendance", "Attendance", appointment.attendance],
    ["actualDate", "Actual date", appointment.actualDate],
    ["actualTime", "Actual time", appointment.actualTime],
    ["actualDurationMinutes", "Actual duration", appointment.actualDurationMinutes && `${appointment.actualDurationMinutes} min`],
    ["notes", "Notes", appointment.notes],
    ["outcomeNotes", "Outcome notes", appointment.outcomeNotes],
  ]
    .filter(([, , value]) => value)
    .map(([key, label, after]) => ({ key, label, before: null, after }));
}
