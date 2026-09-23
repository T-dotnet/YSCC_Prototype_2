import { useMemo, useState } from "react";
import {
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
import RecordItem from "../components/RecordItem";

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

function TimelineIcon({ entry }) {
  const Icon =
    entry.scope === "contextual"
      ? CONTEXTUAL_EVENT_ICONS[entry.type] || ClipboardList
      : STRUCTURED_RECORD_ICONS[entry.type] || Stethoscope;
  return <Icon size={22} aria-hidden="true" />;
}

export default function CareEvents({ episode, openModal, eventId }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const entries = useMemo(
    () => careRecordTimelineEntries(episode).filter((entry) => entry.sourceType !== "appointment"),
    [episode],
  );
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
          <p>Structured records and contextual events for this care period.</p>
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
              placeholder="Search events, records or notes"
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
              ? "No events or records match these filters"
              : "No events or records in this care period"
          }
        >
          {hasFilters
            ? "Try a different search, type or date range."
            : "Add an event or structured record to this care period."}
          {hasFilters && (
            <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
              Clear filters
            </Button>
          )}
        </Empty>
      ) : (
        <ol className="record-timeline" aria-label="Events and structured records">
          {visibleEntries.map((entry) => {
            const isSelected =
              entry.sourceType === "contextual-event" && entry.sourceId === eventId;
            return (
              <li className="record-timeline-entry" key={entry.id}>
                <time className="record-timeline-date" dateTime={entry.date || undefined}>
                  {formatDate(entry.date)}
                  <small>{entry.dateLabel}</small>
                </time>
                <span className="record-timeline-icon" aria-hidden="true">
                  <TimelineIcon entry={entry} />
                </span>
                <RecordItem
                  id={`${entry.sourceType}-${entry.sourceId}`}
                  title={entry.title}
                  subtitle={entry.typeLabel}
                  status={entry.scope === "structured" ? "Structured record" : undefined}
                  className={`record-item-compact${isSelected ? " care-event-selected" : ""}`}
                  facts={[
                    ...entry.details.map(([label, value]) => ({
                      label,
                      value: label.toLowerCase().includes("date") ? formatDate(value) : value,
                      wide: /detail|description|note|reason/i.test(label),
                    })),
                    ...(entry.detail ? [{ label: "Details", value: entry.detail, wide: true }] : []),
                  ]}
                  secondary={entry.item.correctedEventId && (
                    <p className="care-event-correction">
                      This is an append-only correction of an earlier event.
                    </p>
                  )}
                  note={
                    <>
                      Recorded by {entry.actor || "Staff member"}
                      {entry.role ? ` · ${entry.role}` : ""}
                      {entry.timestamp ? ` · ${formatTimestamp(entry.timestamp)}` : ""}
                    </>
                  }
                  actions={entry.sourceType === "contextual-event" && (
                    <Button
                      variant="secondary"
                      onClick={() => openModal({
                        type: "correct-care-event",
                        episodeId: episode.id,
                        eventId: entry.sourceId,
                      })}
                    >
                      Correct event
                    </Button>
                  )}
                />
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
