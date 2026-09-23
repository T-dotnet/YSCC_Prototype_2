import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  FileText,
  Filter,
  MapPin,
  Plus,
} from "lucide-react";
import {
  appointmentDetails,
  appointmentIsOverdue,
  appointmentRecordDate,
  appointmentTitle,
  APPOINTMENT_ATTENDANCE,
} from "../appointments";
import { formatDate, formatTimestamp, TODAY } from "../model";
import {
  Button,
  Empty,
  Notice,
  SearchInput,
  Select,
} from "../components/UI";
import RecordItem from "../components/RecordItem";

const EMPTY_FILTERS = {
  attendance: "all",
  startDate: "",
  endDate: "",
  query: "",
};

const plannedSort = (a, b) =>
  `${a.plannedDate}T${a.plannedTime}`.localeCompare(
    `${b.plannedDate}T${b.plannedTime}`,
  );

const recordedSort = (a, b) =>
  `${appointmentRecordDate(b)}T${b.actualTime || b.plannedTime}`.localeCompare(
    `${appointmentRecordDate(a)}T${a.actualTime || a.plannedTime}`,
  );

const matchesFilters = (appointment, filters) => {
  const recordDate = appointmentRecordDate(appointment);
  const searchable = [
    appointment.practitionerService,
    appointment.contactType,
    appointment.recipientType,
    appointment.relatedPersonName,
    appointment.primaryPractitioner,
    ...(appointment.additionalPractitioners || []),
    appointment.venue,
    appointment.servicingUnit,
    appointment.deliveringUnit,
    appointment.deliveryMode,
    appointment.attendance,
    appointment.notes,
    appointment.outcomeNotes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
  return (
    (filters.attendance === "all" ||
      appointment.attendance === filters.attendance) &&
    (!filters.startDate || recordDate >= filters.startDate) &&
    (!filters.endDate || recordDate <= filters.endDate) &&
    (!filters.query ||
      searchable.includes(filters.query.trim().toLocaleLowerCase()))
  );
};

const displayDeliveryMode = (deliveryMode) =>
  ({ "In person": "Face-to-face", Video: "Telehealth" })[deliveryMode] ||
  deliveryMode;

const appointmentWhen = (appointment) => {
  const isAttended = appointment.attendance === "Attended";
  return {
    label: isAttended ? "Occurred" : "Planned",
    date:
      isAttended && appointment.actualDate
        ? appointment.actualDate
        : appointment.plannedDate,
    time:
      isAttended && appointment.actualTime
        ? appointment.actualTime
        : appointment.plannedTime,
    duration:
      isAttended && appointment.actualDurationMinutes
        ? appointment.actualDurationMinutes
        : appointment.plannedDurationMinutes,
  };
};

function AppointmentCard({ appointment, episode, openModal }) {
  const overdue = appointmentIsOverdue(appointment, TODAY);
  const when = appointmentWhen(appointment);
  const status = overdue ? "Overdue" : appointment.attendance;
  const appointmentType = appointment.contactType || appointment.appointmentType || "Service contact";
  const recordOutcome = () =>
    openModal({
      type: "appointment-outcome",
      episodeId: episode.id,
      appointmentId: appointment.id,
    });
  const addOutcomeMeasure = () =>
    openModal({ type: "clinical-record", episodeId: episode.id });

  return (
    <RecordItem
      title={appointmentTitle(appointment)}
      subtitle={appointmentType}
      status={status}
      headingLevel={4}
      lead={
        <>
          <span className="record-item-lead-icon">
            <CalendarDays size={22} aria-hidden="true" />
          </span>
          <span>
            <strong>{formatDate(when.date)} · {when.time}</strong>
            <small>{when.label} · {when.duration} min</small>
          </span>
        </>
      }
      facts={[
        { label: "Delivery", value: displayDeliveryMode(appointment.deliveryMode) },
        { label: "Clinician or service", value: appointment.practitionerService },
        ...(appointment.recipientType ? [{ label: "Recipient", value: appointment.relatedPersonName || appointment.recipientType }] : []),
        ...(appointment.primaryPractitioner ? [{ label: "Primary practitioner", value: appointment.primaryPractitioner }] : []),
        ...(appointment.venue ? [{ label: "Venue", value: <><MapPin size={14} aria-hidden="true" /> {appointment.venue}</> }] : []),
        ...(appointment.location
          ? [{ label: "Location", value: <><MapPin size={14} aria-hidden="true" /> {appointment.location}</> }]
          : []),
      ]}
      secondary={
        <details className="appointment-more-detail">
          <summary>More detail</summary>
          <dl className="appointment-details">
            {appointmentDetails(appointment, episode)
              .filter(([label]) => !label.toLocaleLowerCase().includes("note"))
              .map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    {label.toLocaleLowerCase().includes("date")
                      ? formatDate(value)
                      : value}
                  </dd>
                </div>
              ))}
            <div>
              <dt>Linked care period</dt>
              <dd>Care period {episode.number}</dd>
            </div>
          </dl>
          <p className="appointment-recorded">
            <FileText size={14} aria-hidden="true" /> Last edited{" "}
            {formatTimestamp(
              appointment.outcomeRecordedAt || appointment.timestamp,
            )}{" "}
            by{" "}
            {appointment.outcomeRecordedBy ||
              appointment.actor ||
              "Staff member"}
          </p>
        </details>
      }
      actions={
        appointment.attendance === "Planned" ? (
          <Button
            variant="secondary"
            disabled={episode.status !== "Active"}
            onClick={recordOutcome}
          >
            Record attendance
          </Button>
        ) : (
          <Button
            variant="secondary"
            disabled={episode.status !== "Active"}
            onClick={addOutcomeMeasure}
          >
            Add outcome measure
          </Button>
        )
      }
    />
  );
}

function AppointmentSection({
  title,
  description,
  appointments,
  episode,
  openModal,
  defaultOpen = true,
}) {
  if (appointments.length === 0) return null;
  const headingId = `${title.replaceAll(" ", "-").toLocaleLowerCase()}-heading`;
  return (
    <details className="appointment-section" open={defaultOpen}>
      <summary aria-labelledby={headingId}>
        <div>
          <h3 id={headingId}>{title}</h3>
          {description && <p>{description}</p>}
        </div>
        <div className="appointment-section-summary-meta">
          <span>{appointments.length}</span>
          <ChevronDown size={18} aria-hidden="true" />
        </div>
      </summary>
      <ol className="appointment-list" aria-label={title}>
        {appointments.map((appointment) => (
          <li key={appointment.id}>
            <AppointmentCard
              appointment={appointment}
              episode={episode}
              openModal={openModal}
            />
          </li>
        ))}
      </ol>
    </details>
  );
}

export default function Appointments({ episode, openModal }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const appointments = episode.appointments || [];
  const visibleAppointments = useMemo(
    () =>
      appointments.filter((appointment) =>
        matchesFilters(appointment, filters),
      ),
    [appointments, filters],
  );
  const overdue = visibleAppointments
    .filter((appointment) => appointmentIsOverdue(appointment, TODAY))
    .sort(plannedSort);
  const upcoming = visibleAppointments
    .filter(
      (appointment) =>
        appointment.attendance === "Planned" &&
        !appointmentIsOverdue(appointment, TODAY),
    )
    .sort(plannedSort);
  const recorded = visibleAppointments
    .filter((appointment) => appointment.attendance !== "Planned")
    .sort(recordedSort);
  const hasFilters = Object.entries(filters).some(
    ([key, value]) => value !== EMPTY_FILTERS[key],
  );
  const setFilter = (key, value) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const addAppointment = () =>
    openModal({ type: "appointment", episodeId: episode.id });

  return (
    <div className="stack appointments">
      <div className="section-toolbar">
        <div>
          <h2>Service contacts</h2>
          <p>Record planned and actual direct contacts, including attendance.</p>
        </div>
        <Button variant="primary" disabled={episode.status !== "Active"} onClick={addAppointment}>
          <Plus size={17} aria-hidden="true" /> Add contact
        </Button>
      </div>
      {appointments.length > 0 && (
        <details
          className={`care-timeline-filters appointment-filters${hasFilters ? " has-active-filters" : ""}`}
          open={filtersOpen}
          onToggle={(event) => setFiltersOpen(event.currentTarget.open)}
        >
          <summary
            className="care-timeline-filter-heading"
            aria-label="Show service contact filters"
          >
            <div>
              <Filter size={18} aria-hidden="true" />
              <span className="sr-only">Filter contacts</span>
            </div>
            <span aria-live="polite">
              Showing {visibleAppointments.length} of {appointments.length}{" "}
              contacts
            </span>
            <ChevronDown
              className="care-timeline-filter-chevron"
              size={18}
              aria-hidden="true"
            />
          </summary>
          <div className="care-timeline-filter-body">
            <div className="care-timeline-filter-fields">
              <SearchInput
                value={filters.query}
                onChange={(value) => setFilter("query", value)}
                placeholder="Search services, contact type, people or status"
              />
              <label className="care-timeline-date">
                <span>From</span>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(event) =>
                    setFilter("startDate", event.target.value)
                  }
                />
              </label>
              <label className="care-timeline-date">
                <span>To</span>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(event) => setFilter("endDate", event.target.value)}
                />
              </label>
              <div className="care-timeline-type">
                <span>Status</span>
                <Select
                  label="Contact status"
                  value={filters.attendance}
                  onChange={(event) =>
                    setFilter("attendance", event.target.value)
                  }
                >
                  <option value="all">All statuses</option>
                  {APPOINTMENT_ATTENDANCE.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </div>
              {hasFilters && (
                <Button
                  variant="secondary"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </div>
        </details>
      )}

      {overdue.length > 0 && (
        <Notice tone="amber">
          <strong>
            {overdue.length} planned{" "}
            {overdue.length === 1 ? "contact is" : "contacts are"} overdue.
          </strong>{" "}
          Record an outcome or update the care team’s follow-up plan.
        </Notice>
      )}

      {appointments.length === 0 ? (
        <Empty title="No service contacts recorded">
          Add a planned, attended, cancelled or did-not-attend contact. It will
          also appear in this care period’s History and change log.
        </Empty>
      ) : visibleAppointments.length === 0 ? (
        <Empty title="No contacts match these filters">
          Try a different search, status or date range.
          <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
            Clear filters
          </Button>
        </Empty>
      ) : (
        <div className="appointment-sections">
          <AppointmentSection
            title="Overdue planned contacts"
            description="These planned contacts are now in the past and need an outcome or follow-up plan."
            appointments={overdue}
            episode={episode}
            openModal={openModal}
          />
          <AppointmentSection
            title="Upcoming planned contacts"
            description="Planned contacts are ordered by date and time."
            appointments={upcoming}
            episode={episode}
            openModal={openModal}
          />
          <AppointmentSection
            title="Recorded contacts"
            description="Attended, cancelled and did-not-attend contacts."
            appointments={recorded}
            episode={episode}
            openModal={openModal}
          />
        </div>
      )}
    </div>
  );
}
