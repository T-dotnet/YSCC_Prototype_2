import { useMemo, useState } from "react";
import {
  CalendarClock,
  ClipboardList,
  ChevronDown,
  Filter,
  House,
  HeartHandshake,
  Hospital,
  LineChart,
  Pill,
  Plus,
  ShieldAlert,
  Stethoscope,
} from "lucide-react";
import {
  careRecordTimelineEntries,
  careRecordTimelineTypes,
  filterCareRecordTimelineEntries,
} from "../careRecordTimeline";
import { formatDate, formatTimestamp } from "../model";
import { Button, Empty, SearchInput, Select } from "../components/UI";

const CONTEXTUAL_EVENT_ICONS = {
  harm: ShieldAlert,
  inpatient: Hospital,
  "medication-adverse": Pill,
  housing: House,
  "care-transition": HeartHandshake,
  medication: Pill,
  "care-service": HeartHandshake,
  other: ClipboardList,
};

const STRUCTURED_RECORD_ICONS = {
  appointment: CalendarClock,
  risk: ShieldAlert,
  diagnosis: Stethoscope,
  medication: Pill,
  outcome: LineChart,
};

const EMPTY_FILTERS = {
  type: "all",
  startDate: "",
  endDate: "",
  query: "",
};

const scopeLabel = (scope) =>
  scope === "structured" ? "Structured record or contact" : "Contextual event";

function TimelineIcon({ entry }) {
  const Icon =
    entry.scope === "contextual"
      ? CONTEXTUAL_EVENT_ICONS[entry.type] || ClipboardList
      : STRUCTURED_RECORD_ICONS[entry.type] || Stethoscope;
  return <Icon size={17} />;
}

export default function CareEvents({ episode, openModal, eventId }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const entries = useMemo(() => careRecordTimelineEntries(episode), [episode]);
  const types = useMemo(() => careRecordTimelineTypes(entries), [entries]);
  const visibleEntries = useMemo(
    () => filterCareRecordTimelineEntries(entries, filters),
    [entries, filters],
  );
  const hasFilters = Object.entries(filters).some(
    ([key, value]) => value !== EMPTY_FILTERS[key],
  );
  const setFilter = (key, value) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const openRecordModal = () =>
    openModal({ type: "care-timeline-entry", episodeId: episode.id });

  return (
    <div className="stack care-events">
      <div className="section-toolbar">
        <div>
          <h2>Events</h2>
          <p>Appointments, structured records and contextual events for this care period.</p>
        </div>
        <div className="button-row">
          <Button variant="primary" onClick={openRecordModal}>
            <Plus size={17} aria-hidden="true" /> Add event
          </Button>
        </div>
      </div>

      <details
        className={`care-timeline-filters${hasFilters ? " has-active-filters" : ""}`}
        open={filtersOpen}
        onToggle={(event) => setFiltersOpen(event.currentTarget.open)}
      >
        <summary className="care-timeline-filter-heading" aria-label="Show timeline filters">
          <div>
            <Filter size={18} aria-hidden="true" />
            <span className="sr-only">Filter timeline</span>
          </div>
          <span aria-live="polite">
            Showing {visibleEntries.length} of {entries.length} records
          </span>
          <ChevronDown className="care-timeline-filter-chevron" size={18} aria-hidden="true" />
        </summary>
        <div className="care-timeline-filter-body">
          <div className="care-timeline-filter-fields">
            <SearchInput
              value={filters.query}
              onChange={(value) => setFilter("query", value)}
              placeholder="Search records, services or notes"
            />
            <label className="care-timeline-date">
              <span>From</span>
              <input
                type="date"
                value={filters.startDate}
                onChange={(event) => setFilter("startDate", event.target.value)}
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
              <span>Type</span>
              <Select
                label="Record type"
                value={filters.type}
                onChange={(event) => setFilter("type", event.target.value)}
              >
                <option value="all">All types</option>
                {types.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </div>
            {hasFilters && (
              <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
                Clear filters
              </Button>
            )}
          </div>
        </div>
      </details>

      {visibleEntries.length === 0 ? (
        <Empty
          title={
            hasFilters
              ? "No timeline records match these filters"
              : "No records in this care timeline"
          }
        >
          {hasFilters
            ? "Try a different search, type or date range."
            : "Record an event, structured record or appointment to add it to this timeline."}
          {hasFilters && (
            <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
              Clear filters
            </Button>
          )}
        </Empty>
      ) : (
        <ol className="care-event-timeline" aria-label="Care timeline records">
          {visibleEntries.map((entry) => {
            const isSelected =
              entry.sourceType === "contextual-event" && entry.sourceId === eventId;
            return (
              <li key={entry.id}>
                <time dateTime={entry.date || undefined}>
                  {formatDate(entry.date)}
                  <small>{entry.dateLabel}</small>
                </time>
                <span className="care-event-marker" aria-hidden="true">
                  <TimelineIcon entry={entry} />
                </span>
                <details
                  className={`care-event-accordion ${isSelected ? "care-event-selected" : ""}`}
                  id={`${entry.sourceType}-${entry.sourceId}`}
                  open={isSelected || undefined}
                >
                  <summary className="care-event-summary">
                    <div className="care-event-summary-text">
                      <span className="care-event-type">
                        {scopeLabel(entry.scope)} · {entry.typeLabel}
                      </span>
                      <h3>{entry.title}</h3>
                    </div>
                    <ChevronDown size={18} className="care-event-chevron" aria-hidden="true" />
                  </summary>
                  <article className="care-event-card-body">
                    {entry.detail && (
                      <p className="care-timeline-detail">{entry.detail}</p>
                    )}
                    {entry.details.length > 0 && (
                      <dl>
                        {entry.details.map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>
                              {label.toLowerCase().includes("date")
                                ? formatDate(value)
                                : value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {entry.item.correctedEventId && (
                      <p className="care-event-correction">
                        This is an append-only correction of an earlier event.
                      </p>
                    )}
                    <footer>
                      <span>
                        Recorded by {entry.actor || "Staff member"}
                        {entry.role ? ` · ${entry.role}` : ""}
                        {entry.timestamp ? ` · ${formatTimestamp(entry.timestamp)}` : ""}
                      </span>
                      {entry.sourceType === "contextual-event" && (
                        <Button
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal({
                              type: "correct-care-event",
                              episodeId: episode.id,
                              eventId: entry.sourceId,
                            });
                          }}
                        >
                          Correct event
                        </Button>
                      )}
                    </footer>
                  </article>
                </details>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
