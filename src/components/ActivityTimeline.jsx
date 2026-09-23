import { useState, useMemo } from "react";
import { Filter, ChevronDown, Clock3 } from "lucide-react";
import {
  activityEntries,
  activityChangeDetails,
  changeLogEntries,
  clinicalHistoryEntries,
} from "../activity";
import { formatDate, formatTimestamp, personEventText } from "../model";
import { historyCategory, HISTORY_CATEGORIES, historyDate, historyItem } from "../historyItem";
import { SearchInput, Select, Button, Empty } from "./UI";
import RecordItem from "./RecordItem";

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

function TimelineDate({ timestamp, date, time, dateLabel }) {
  const parts = !time && !dateLabel && timestamp && timestamp === date
    ? timelineTimestamp(timestamp)
    : null;
  return (
    <time className="record-timeline-date" dateTime={time && date ? `${date.slice(0, 10)}T${time}` : parts ? timestamp : date || undefined}>
      {parts ? parts.date : displayDate(date)}
      {(time || dateLabel || parts) && <small>
        {time ? `${time} · ${dateLabel}` : dateLabel || (parts ? (
          <>{parts.time}{parts.zone && <><br />{parts.zone}</>}</>
        ) : null)}
      </small>}
    </time>
  );
}

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
  if (!entries.length)
    return <p className="history-empty">No clinical activity has been recorded.</p>;
  return (
    <ol className="record-timeline clinical-continuous-timeline" aria-label="Continuous clinical history">
      {entries.map((entry) => {
        const item = historyItem(entry, episode, (value) => personEventText(person, value));
        const toFact = ({ label, value }) => ({
          label,
          value: label === "Recorded at" ? formatTimestamp(value) : label.toLowerCase().includes("date") ? formatDate(value) : value,
          wide: ["Summary", "Notes", "Outcome notes"].includes(label) ||
            label.startsWith("Associated assignment"),
        });
        return (
          <li className="record-timeline-entry" key={entry.id}>
            <TimelineDate timestamp={entry.timestamp} date={item.date} time={item.time} dateLabel={item.dateLabel} />
            <span className="record-timeline-icon" aria-hidden="true">
              <Clock3 size={22} />
            </span>
            <RecordItem
              title={entry.title || "Recorded event"}
              subtitle={item.subtitle}
              className="record-item-compact"
              facts={item.primary.map(toFact)}
              secondary={item.more.length > 0 && (
                <details className="appointment-more-detail history-more-details">
                  <summary>
                    <span className="history-more-closed">Record details · {item.more.length}</span>
                    <span className="history-more-open">Show less</span>
                  </summary>
                  <dl className="record-item-facts">
                    {item.more.map((detail) => (
                      <div key={detail.label} className={toFact(detail).wide ? "record-item-fact-wide" : undefined}>
                        <dt>{detail.label}</dt>
                        <dd>{toFact(detail).value}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
            />
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
        const item = historyItem(entry, episode, (value) => personEventText(person, value));
        const text = [
          entry.title,
          entry.detail,
          personEventText(person, entry.detail),
          entry.actor,
          entry.role,
          entry.scope,
          item.subtitle,
          ...[...item.primary, ...item.more].flatMap(({ label, value }) => [label, value]),
        ].filter(Boolean).join(" ").toLowerCase();
        if (!text.includes(q)) return false;
      }
      const entryDate = historyDate(entry);
      if (filters.startDate && (!entryDate || entryDate.slice(0, 10) < filters.startDate)) return false;
      if (filters.endDate && (!entryDate || entryDate.slice(0, 10) > filters.endDate)) return false;
      if (filters.type !== "all" && historyCategory(entry) !== filters.type) {
        return false;
      }
      return true;
    });
  }, [entries, filters, episode, person]);

  const hasFilters = Object.entries(filters).some(
    ([key, value]) => value !== "all" && value !== "",
  );

  const setFilter = (key, value) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const types = useMemo(() => {
    const uniqueTypes = [...new Set(entries.map(historyCategory))];
    return uniqueTypes.map((t) => ({
      value: t,
      label: HISTORY_CATEGORIES[t],
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
              <span>Category</span>
              <Select
                label="History category"
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
        <ol className="record-timeline" aria-label="Field change log">
          {visibleEntries.map((entry) => {
            const changes = activityChangeDetails(entry);
            const entryTimestamp =
              entry.timestamp || (entry.date?.includes("T") ? entry.date : null);
            const details = [
              ["Changed by", actorLabel(entry)],
              ...(entry.scope ? [["Scope", entry.scope]] : []),
              ...(entry.reason ? [["Reason", entry.reason]] : []),
              ...(entry.source ? [["Source", entry.source]] : []),
            ];
            return (
              <li className="record-timeline-entry" key={entry.id}>
                <TimelineDate timestamp={entryTimestamp} date={entry.date} />
                <span className="record-timeline-icon" aria-hidden="true">
                  <Clock3 size={22} />
                </span>
                <RecordItem
                  title={entry.title}
                  subtitle={`${changes.length} ${changes.length === 1 ? "change" : "changes"}`}
                  className="record-item-compact"
                  facts={details.map(([label, value]) => ({
                    label,
                    value,
                    wide: label === "Reason" || label === "Source",
                  }))}
                  secondary={<details className="activity-change-details">
                    <summary>Show more · {changes.length} {changes.length === 1 ? "change" : "changes"}</summary>
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
                  }
                />
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
