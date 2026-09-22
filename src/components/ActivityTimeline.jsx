import { useState, useMemo } from "react";
import { Filter, ChevronDown } from "lucide-react";
import {
  activityEntries,
  activityChangeDetails,
  changeLogEntries,
  clinicalHistoryEntries,
} from "../activity";
import { formatDate, personEventText } from "../model";
import { SearchInput, Select, Button, Empty } from "./UI";

const displayValue = (value) =>
  value === true
    ? "Yes"
    : value === false
      ? "No"
      : value == null || value === ""
        ? "Not recorded."
        : String(value);

const timelineTimestamp = (timestamp) => {
  const value = new Date(timestamp);
  const timeParts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).formatToParts(value);
  return {
    date: value
      .toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
      .replace("Sept", "Sep"),
    time: timeParts
      .filter(({ type }) =>
        ["hour", "minute", "second", "literal"].includes(type),
      )
      .map(({ value: part }) => part)
      .join("")
      .trim(),
    zone: timeParts.find(({ type }) => type === "timeZoneName")?.value || "",
  };
};

const recordedDate = (entry) => entry.timestamp || entry.date || null;

const displayDate = (value) =>
  value ? formatDate(value.slice(0, 10)) : "Not recorded";

const actorLabel = (entry) =>
  `${entry.actor || "Editor not recorded"}${entry.role ? ` · ${entry.role}` : ""}`;

function EventList({ entries, person, label }) {
  if (!entries.length)
    return <p className="history-empty">No events recorded.</p>;
  return (
    <ol className="assignment-events" aria-label={label}>
      {entries.map((entry) => {
        const date = recordedDate(entry);
        return (
          <li key={entry.id}>
            <time dateTime={date || undefined}>{displayDate(date)}</time>
            <div>
              <strong>{entry.title || "Recorded event"}</strong>
              {entry.detail && <p>{personEventText(person, entry.detail)}</p>}
              {entry.actor && <small>{actorLabel(entry)}</small>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function ActivityTimeline({ episode, person, audit = [] }) {
  const entries = activityEntries(person, episode, audit);
  return (
    <ol className="timeline" aria-label="Recent care activity">
      {entries.slice(0, 4).map((entry) => {
        const changes = activityChangeDetails(entry);
        return (
          <li key={entry.id}>
            <span className="timeline-dot" />
            <time dateTime={recordedDate(entry) || undefined}>
              <strong>{displayDate(recordedDate(entry))}</strong>
            </time>
            <div>
              <strong>{entry.title}</strong>
              {changes.length === 0 ? (
                <p>{personEventText(person, entry.detail)}</p>
              ) : null}
              {entry.actor && (
                <small>
                  {entry.actor}
                  {entry.role ? ` · ${entry.role}` : ""}
                  {entry.scope ? ` · ${entry.scope}` : ""}
                </small>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ContinuousHistory({ entries, episode, person }) {
  const collections = new Map(
    episode.collections.map((collection) => [collection.id, collection.label]),
  );
  if (!entries.length)
    return <p className="history-empty">No clinical activity has been recorded.</p>;
  return (
    <ol className="timeline activity-history clinical-continuous-timeline" aria-label="Continuous clinical history">
      {entries.map((entry) => {
        const entryTimestamp =
          entry.timestamp || (entry.date?.includes("T") ? entry.date : null);
        const timestampParts = entryTimestamp
          ? timelineTimestamp(entryTimestamp)
          : null;
        const details = [
          ...(entry.collectionId && collections.get(entry.collectionId)
            ? [["Assessment", collections.get(entry.collectionId)]]
            : []),
          ...(entry.detail
            ? [["Details", personEventText(person, entry.detail)]]
            : []),
          ...(entry.actor ? [["Recorded by", actorLabel(entry)]] : []),
          ...(entry.scope ? [["Scope", entry.scope]] : []),
          ...(entry.eventDate ? [["Event date", formatDate(entry.eventDate)]] : []),
          ...(!entryTimestamp ? [["Time", "Exact time not recorded"]] : []),
        ];
        return (
          <li key={entry.id}>
            <span className="timeline-dot" />
            <time dateTime={entryTimestamp || entry.date || undefined}>
              {timestampParts ? (
                <>
                  <strong>{timestampParts.date}</strong>
                  <span>{timestampParts.time}</span>
                  {timestampParts.zone && <small>{timestampParts.zone}</small>}
                </>
              ) : (
                <strong>{displayDate(entry.date)}</strong>
              )}
            </time>
            <div>
              <strong>{entry.title || "Recorded event"}</strong>
              {details.length > 0 && (
                <dl className="activity-entry-details">
                  {details.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ClinicalHistory({
  episode,
  person,
  audit = [],
}) {
  const entries = clinicalHistoryEntries(person, episode, audit);

  const [filters, setFilters] = useState({
    type: "all",
    startDate: "",
    endDate: "",
    query: "",
  });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const visibleEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (filters.query) {
        const q = filters.query.trim().toLowerCase();
        const text = [
          entry.title,
          entry.detail,
          personEventText(person, entry.detail),
          entry.actor,
          entry.role,
          entry.scope
        ].filter(Boolean).join(" ").toLowerCase();
        if (!text.includes(q)) return false;
      }
      const entryDate = entry.timestamp || entry.date || entry.eventDate;
      if (filters.startDate && entryDate) {
        const d = entryDate.slice(0, 10);
        if (d < filters.startDate) return false;
      }
      if (filters.endDate && entryDate) {
        const d = entryDate.slice(0, 10);
        if (d > filters.endDate) return false;
      }
      if (filters.type !== "all" && entry.type !== filters.type) {
        return false;
      }
      return true;
    });
  }, [entries, filters, person]);

  const hasFilters = Object.entries(filters).some(
    ([key, value]) => value !== "all" && value !== "",
  );

  const setFilter = (key, value) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const types = useMemo(() => {
    const uniqueTypes = [...new Set(entries.map((e) => e.type).filter(Boolean))];
    return uniqueTypes.map((t) => ({
      value: t,
      label: t === "appointment" ? "Appointment" : t === "clinical-record" ? "Clinical Record" : t,
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [entries]);

  return (
    <div className="clinical-history">
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
              placeholder="Search records, events or notes"
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
              <Button variant="secondary" onClick={() => setFilters({ type: "all", startDate: "", endDate: "", query: "" })}>
                Clear filters
              </Button>
            )}
          </div>
        </div>
      </details>

      {visibleEntries.length === 0 ? (
        <Empty title="No timeline records match these filters">
          Try a different search, type or date range.
          <div style={{ marginTop: "12px" }}>
            <Button variant="secondary" onClick={() => setFilters({ type: "all", startDate: "", endDate: "", query: "" })}>
              Clear filters
            </Button>
          </div>
        </Empty>
      ) : (
        <ContinuousHistory entries={visibleEntries} episode={episode} person={person} />
      )}
    </div>
  );
}

export function ChangeLog({ episode, person, audit = [] }) {
  const entries = changeLogEntries(person, episode, audit);

  const [filters, setFilters] = useState({
    scope: "all",
    startDate: "",
    endDate: "",
    query: "",
  });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const visibleEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (filters.query) {
        const q = filters.query.trim().toLowerCase();
        const changes = activityChangeDetails(entry);
        const changesText = changes.map(c => `${c.label} ${displayValue(c.before)} ${displayValue(c.after)}`).join(" ");

        const text = [
          entry.title,
          entry.detail,
          personEventText(person, entry.detail),
          entry.actor,
          entry.role,
          entry.scope,
          changesText
        ].filter(Boolean).join(" ").toLowerCase();

        if (!text.includes(q)) return false;
      }
      const entryDate = entry.timestamp || entry.date;
      if (filters.startDate && entryDate) {
        const d = entryDate.slice(0, 10);
        if (d < filters.startDate) return false;
      }
      if (filters.endDate && entryDate) {
        const d = entryDate.slice(0, 10);
        if (d > filters.endDate) return false;
      }
      if (filters.scope !== "all" && entry.scope !== filters.scope) {
        return false;
      }
      return true;
    });
  }, [entries, filters, person]);

  const hasFilters = Object.entries(filters).some(
    ([key, value]) => value !== "all" && value !== "",
  );

  const setFilter = (key, value) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const scopes = useMemo(() => {
    const uniqueScopes = [...new Set(entries.map((e) => e.scope).filter(Boolean))];
    return uniqueScopes.map((s) => ({
      value: s,
      label: s,
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [entries]);

  return (
    <div className="change-log">
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
            Showing {visibleEntries.length} of {entries.length} changes
          </span>
          <ChevronDown className="care-timeline-filter-chevron" size={18} aria-hidden="true" />
        </summary>
        <div className="care-timeline-filter-body">
          <div className="care-timeline-filter-fields">
            <SearchInput
              value={filters.query}
              onChange={(value) => setFilter("query", value)}
              placeholder="Search changes, fields or actors"
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
              <span>Scope</span>
              <Select
                label="Change scope"
                value={filters.scope}
                onChange={(event) => setFilter("scope", event.target.value)}
              >
                <option value="all">All scopes</option>
                {scopes.map((scope) => (
                  <option key={scope.value} value={scope.value}>
                    {scope.label}
                  </option>
                ))}
              </Select>
            </div>
            {hasFilters && (
              <Button variant="secondary" onClick={() => setFilters({ scope: "all", startDate: "", endDate: "", query: "" })}>
                Clear filters
              </Button>
            )}
          </div>
        </div>
      </details>

      {visibleEntries.length ? (
        <ol className="timeline activity-history" aria-label="Field change log">
          {visibleEntries.map((entry) => {
            const changes = activityChangeDetails(entry);
            const entryTimestamp =
              entry.timestamp || (entry.date?.includes("T") ? entry.date : null);
            const timestampParts = entryTimestamp
              ? timelineTimestamp(entryTimestamp)
              : null;
            const details = [
              ["Changed by", actorLabel(entry)],
              ...(entry.scope ? [["Scope", entry.scope]] : []),
              ...(entry.reason ? [["Reason", entry.reason]] : []),
              ...(entry.source ? [["Source", entry.source]] : []),
              ...(!entryTimestamp ? [["Time", "Exact time not recorded"]] : []),
            ];
            return (
              <li key={entry.id}>
                <span className="timeline-dot" />
                <time dateTime={entryTimestamp || entry.date || undefined}>
                  {timestampParts ? (
                    <>
                      <strong>{timestampParts.date}</strong>
                      <span>{timestampParts.time}</span>
                      {timestampParts.zone && <small>{timestampParts.zone}</small>}
                    </>
                  ) : (
                    <strong>{displayDate(entry.date)}</strong>
                  )}
                </time>
                <div>
                  <strong>{entry.title}</strong>
                  <dl className="activity-entry-details">
                    {details.map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <details className="activity-change-details">
                    <summary>Show more · {changes.length} changes</summary>
                    {changes.map((change) => (
                      <section key={change.key}>
                        <h3>{change.label}</h3>
                        <dl className="history-answer-comparison report-wording-comparison">
                          <div>
                            <dt>Before</dt>
                            <dd>{displayValue(change.before)}</dd>
                          </div>
                          <div>
                            <dt>After</dt>
                            <dd>{displayValue(change.after)}</dd>
                          </div>
                        </dl>
                      </section>
                    ))}
                  </details>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <Empty
          title={
            hasFilters
              ? "No field changes match these filters"
              : "No field changes have been recorded"
          }
        >
          {hasFilters ? (
            <>
              Try a different search, scope or date range.
              <div style={{ marginTop: "12px" }}>
                <Button variant="secondary" onClick={() => setFilters({ scope: "all", startDate: "", endDate: "", query: "" })}>
                  Clear filters
                </Button>
              </div>
            </>
          ) : (
            "No field changes have been recorded for this care episode."
          )}
        </Empty>
      )}
    </div>
  );
}
