import { appointmentDetails, appointmentTitle } from "./appointments.js";
import { careEventDetails, careEventType, recordedCareEvents } from "./careEvents.js";
import {
  clinicalRecordDetails,
  clinicalRecordType,
  recordedClinicalRecords,
} from "./clinicalRecords.js";

const appointmentDate = (appointment) =>
  appointment.actualDate || appointment.plannedDate || null;

const searchText = (entry) =>
  [
    entry.typeLabel,
    entry.title,
    entry.detail,
    entry.actor,
    ...entry.details.flatMap(([label, value]) => [label, value]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();

const timelineEntry = (entry) => ({ ...entry, searchText: searchText(entry) });

export function careRecordTimelineEntries(episode) {
  const appointments = (episode?.appointments ?? []).map((appointment) =>
    timelineEntry({
      id: `appointment-${appointment.id}`,
      sourceId: appointment.id,
      sourceType: "appointment",
      scope: "structured",
      type: "appointment",
      typeLabel: "Appointment or service contact",
      date: appointmentDate(appointment),
      time: appointment.actualTime || appointment.plannedTime || null,
      dateLabel: appointment.actualDate ? "Actual contact" : "Planned contact",
      title: appointmentTitle(appointment),
      detail: appointment.practitionerService,
      details: appointmentDetails(appointment),
      actor: appointment.actor,
      role: appointment.role,
      timestamp: appointment.timestamp,
      item: appointment,
    }),
  );
  const records = recordedClinicalRecords(episode).map((record) => {
    const type = clinicalRecordType(record.recordType);
    return timelineEntry({
      id: `clinical-record-${record.id}`,
      sourceId: record.id,
      sourceType: "clinical-record",
      scope: "structured",
      type: record.recordType,
      typeLabel: type?.label || "Structured record",
      date: record.recordDate,
      dateLabel: "Recorded",
      title: record.title,
      detail: record.detail,
      details: clinicalRecordDetails(record),
      actor: record.actor,
      role: record.role,
      timestamp: record.timestamp,
      item: record,
    });
  });
  const events = recordedCareEvents(episode).map((event) => {
    const type = careEventType(event.eventType);
    return timelineEntry({
      id: `contextual-event-${event.id}`,
      sourceId: event.id,
      sourceType: "contextual-event",
      scope: "contextual",
      type: event.eventType,
      typeLabel: type?.label || "Contextual event",
      date: event.eventDate || event.date || null,
      dateLabel: "Recorded",
      title: event.title,
      detail: event.detail,
      details: careEventDetails(event),
      actor: event.actor,
      role: event.role,
      timestamp: event.timestamp,
      item: event,
    });
  });

  return [...appointments, ...records, ...events].toSorted(
    (a, b) =>
      `${b.date || ""}T${b.time || ""}`.localeCompare(
        `${a.date || ""}T${a.time || ""}`,
      ) || (b.timestamp || "").localeCompare(a.timestamp || ""),
  );
}

export function careRecordTimelineTypes(entries, scope = "all") {
  const visibleScopes =
    scope === "all" ? entries : entries.filter((entry) => entry.scope === scope);
  return [
    ...new Map(
      visibleScopes.map((entry) => [entry.type, entry.typeLabel]),
    ).entries(),
  ]
    .map(([value, label]) => ({ value, label }))
    .toSorted((a, b) => a.label.localeCompare(b.label));
}

export function filterCareRecordTimelineEntries(entries, filters = {}) {
  const scope = filters.scope || "all";
  const type = filters.type || "all";
  const startDate = filters.startDate || "";
  const endDate = filters.endDate || "";
  const query = filters.query?.trim().toLocaleLowerCase() || "";
  return entries.filter(
    (entry) =>
      (scope === "all" || entry.scope === scope) &&
      (type === "all" || entry.type === type) &&
      (!startDate || (entry.date && entry.date >= startDate)) &&
      (!endDate || (entry.date && entry.date <= endDate)) &&
      (!query || entry.searchText.includes(query)),
  );
}
