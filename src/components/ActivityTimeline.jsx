import { Fragment, useState, useMemo, useEffect } from "react";
import {
  ArrowRightLeft,
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  FileText,
  Filter,
  Flag,
  HeartPulse,
  House,
  Pill,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import {
  activityEntries,
  activityChangeDetails,
  changeLogEntries,
  clinicalHistoryEntries,
} from "../activity";
import { collectionStatus, formatDate, formatTimestamp, personEventText, TODAY } from "../model";
import { associatedCareItems, historyCategory, HISTORY_CATEGORIES, historyDate, historyItem } from "../historyItem";
import { SearchInput, Select, Button, Empty, FilterTabs } from "./UI";
import RecordItem from "./RecordItem";
import ListFilterBar from "./ListFilterBar";

const displayValue = (value) =>
  value === true
    ? "Yes"
    : value === false
      ? "No"
      : value == null || value === ""
        ? "Not recorded."
        : String(value);

const CARE_EVENT_QUICK_TYPES = [
  "all",
  "appointment",
  "assessment",
  "contextual-event",
  "clinical-record",
];

const EVENT_CATEGORY_DISPLAY = {
  appointment: { label: "Appointment", icon: CalendarDays },
  assessment: { label: "Assessment", icon: ClipboardCheck },
  "contextual-event": { label: "Contextual event", icon: Flag },
  "clinical-record": { label: "Care record", icon: FileText },
};

const CONTEXTUAL_EVENT_ICONS = {
  "indirect-activity": Users,
  harm: HeartPulse,
  "medication-adverse": Pill,
  housing: House,
  "care-transition": ArrowRightLeft,
  other: Flag,
  inpatient: Building2,
  medication: Pill,
  "care-service": ArrowRightLeft,
  "life-event": Flag,
};

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

function TimelineDate({ timestamp, date, time, dateLabel, emphasized = false }) {
  const parts = !time && !dateLabel && timestamp && timestamp === date
    ? timelineTimestamp(timestamp)
    : null;
  if (!emphasized) return (
    <time className="record-timeline-date" dateTime={time && date ? `${date.slice(0, 10)}T${time}` : parts ? timestamp : date || undefined}>
      {parts ? parts.date : displayDate(date)}
      {(time || dateLabel || parts) && <small>
        {time ? `${time} · ${dateLabel}` : dateLabel || (parts ? (
          <>{parts.time}{parts.zone && <><br />{parts.zone}</>}</>
        ) : null)}
      </small>}
    </time>
  );
  const clock = time || parts?.time;
  const context = dateLabel || parts?.zone;
  return (
    <time className="record-timeline-date" dateTime={time && date ? `${date.slice(0, 10)}T${time}` : parts ? timestamp : date || undefined}>
      {context && <span className="record-timeline-date-label">{context}</span>}
      <strong className="record-timeline-when">
        {parts ? parts.date : displayDate(date)}
        {clock && <> · {clock}</>}
      </strong>
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
              {entry.effectiveDate && (
                <p>Effective {formatDate(entry.effectiveDate)}</p>
              )}
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

function ContinuousHistory({ entries, episode, person, onCorrectEvent, onRecordAppointmentOutcome, onCollectAssessmentResponse, canCollectAssessment, selectedEventId, careEventsOnly, showCategories = false }) {
  if (!entries.length)
    return <p className="history-empty">{careEventsOnly ? "No care events or structured records have been recorded." : "No clinical activity has been recorded."}</p>;
  const firstPastIndex = showCategories ? entries.findIndex((entry) => (historyDate(entry) || "").slice(0, 10) <= TODAY) : -1;
  return (
    <ol className="record-timeline clinical-continuous-timeline" aria-label={careEventsOnly ? "Care events and structured records" : "Continuous clinical history"}>
      {entries.map((entry, index) => {
        const item = historyItem(entry, episode, (value) => personEventText(person, value));
        const category = historyCategory(entry);
        const categoryDisplay = showCategories ? EVENT_CATEGORY_DISPLAY[category] : null;
        const MarkerIcon = category === "contextual-event" && showCategories
          ? CONTEXTUAL_EVENT_ICONS[entry.eventType] || Flag
          : categoryDisplay?.icon || Clock3;
        const isCareEvent = entry.eventDate && ["ADD_CARE_EVENT", "CORRECT_CARE_EVENT"].includes(entry.actionType);
        const appointment = entry.type === "appointment"
          ? episode.appointments?.find((candidate) => `appointment-${candidate.id}` === entry.id)
          : null;
        const collection = entry.type === "assessment"
          ? episode.collections.find((candidate) => candidate.id === entry.collectionId)
          : null;
        const associatedItems = showCategories ? associatedCareItems(entry, episode) : [];
        const primaryFacts = showCategories && collection
          ? item.primary.filter(({ label }) => label !== "Associated appointment")
          : item.primary;
        const moreFacts = showCategories && appointment
          ? item.more.filter(({ label }) => !label.startsWith("Associated assignment"))
          : item.more;
        const datedAction = showCategories && episode.status === "Active"
          ? appointment?.attendance === "Planned" && onRecordAppointmentOutcome
            ? <Button variant="secondary" aria-haspopup="dialog" onClick={() => onRecordAppointmentOutcome(appointment.id)}>Record outcome</Button>
            : collection?.response !== "Submitted" && collection?.due &&
              !["Cancelled", "Paused"].includes(collection.assignment) &&
              canCollectAssessment && onCollectAssessmentResponse
              ? <Button variant="secondary" aria-haspopup="dialog" onClick={() => onCollectAssessmentResponse(collection.id)}>Collect response</Button>
              : null
          : null;
        const completedCollection = entry.title === "Questionnaire response received"
          ? episode.collections.find((collection) => collection.id === entry.collectionId)
          : null;
        const toFact = ({ label, value }) => ({
          label,
          value: label === "Recorded at" ? formatTimestamp(value) : label.toLowerCase().includes("date") ? formatDate(value) : value,
          wide: ["Summary", "Notes", "Outcome notes"].includes(label) ||
            label.startsWith("Associated assignment"),
        });
        return (
          <Fragment key={entry.id}>
            {index === firstPastIndex && firstPastIndex > 0 && (
              <li className="care-timeline-divider" aria-label="Past and today's events begin below">
                <span>Past &amp; today</span><span className="care-timeline-divider-line" aria-hidden="true" />
              </li>
            )}
          <li className="record-timeline-entry" data-category={categoryDisplay ? category : undefined}>
            {categoryDisplay ? (
              <div className="record-timeline-meta">
                <span className="record-timeline-category">{categoryDisplay.label}</span>
                <TimelineDate timestamp={entry.timestamp} date={item.date} time={item.time} dateLabel={item.dateLabel} emphasized />
              </div>
            ) : (
              <TimelineDate timestamp={entry.timestamp} date={item.date} time={item.time} dateLabel={item.dateLabel} />
            )}
            <span className="record-timeline-icon" aria-hidden="true">
              <MarkerIcon size={22} />
            </span>
            <RecordItem
              id={isCareEvent ? `contextual-event-${entry.id}` : undefined}
              title={completedCollection ? `${completedCollection.label} questionnaire completed` : entry.title || "Recorded event"}
              subtitle={item.subtitle}
              status={collection ? collectionStatus(collection)
                : showCategories && appointment?.attendance === "Planned" && appointment.plannedDate <= TODAY
                  ? appointment.plannedDate < TODAY ? "Overdue" : "Today"
                  : undefined}
              className={`record-item-compact${isCareEvent && entry.id === selectedEventId ? " care-event-selected" : ""}`}
              facts={primaryFacts.map(toFact)}
              secondary={(associatedItems.length > 0 || moreFacts.length > 0) && (
                <>
                  {associatedItems.length > 0 && (
                    <details className="appointment-more-detail history-associated-details">
                      <summary>Associated items · {associatedItems.length}</summary>
                      <ul className="history-associated-list">
                        {associatedItems.map((associated) => (
                          <li key={`${associated.type}-${associated.id}`}>
                            <span className="history-associated-type">{associated.type}</span>
                            <strong>{associated.title}</strong>
                            <small>{[associated.subtitle, associated.date && `${associated.dateLabel} ${formatDate(associated.date)}`].filter(Boolean).join(" · ")}</small>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {moreFacts.length > 0 && (
                    <details className="appointment-more-detail history-more-details">
                      <summary>
                        <span className="history-more-closed">Record details · {moreFacts.length}</span>
                        <span className="history-more-open">Show less</span>
                      </summary>
                      <dl className="record-item-facts">
                        {moreFacts.map((detail) => (
                          <div key={detail.label} className={toFact(detail).wide ? "record-item-fact-wide" : undefined}>
                            <dt>{detail.label}</dt>
                            <dd>{toFact(detail).value}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  )}
                </>
              )}
              note={isCareEvent && entry.correctedEventId ? "This is an append-only correction of an earlier event." : undefined}
              actions={datedAction || (onCorrectEvent && isCareEvent && (
                <Button variant="secondary" onClick={() => onCorrectEvent(entry.id)}>Correct event</Button>
              ))}
            />
          </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

export function ClinicalHistory({
  episode,
  person,
  audit = [],
  entries: providedEntries,
  careEventsOnly = false,
  quickFilters = false,
  onCorrectEvent,
  onRecordAppointmentOutcome,
  onCollectAssessmentResponse,
  canCollectAssessment = false,
  attentionIds = [],
  attentionOnly = false,
  onClearAttention,
  selectedEventId,
}) {
  const entries = providedEntries ?? clinicalHistoryEntries(person, episode, audit);

  const [filters, setFilters] = useState({
    type: "all",
    startDate: "",
    endDate: "",
    query: "",
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    if (attentionOnly) setFilters({ type: "all", startDate: "", endDate: "", query: "" });
  }, [attentionOnly]);
  const attentionActive = quickFilters && attentionOnly && attentionIds.length > 0;
  const attentionIdSet = new Set(attentionIds);

  const visibleEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (attentionActive && !attentionIdSet.has(entry.id)) return false;
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
          ...(quickFilters ? associatedCareItems(entry, episode).flatMap(({ type, title, subtitle }) => [type, title, subtitle]) : []),
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
  }, [entries, filters, episode, person, attentionActive, attentionIdSet, quickFilters]);

  const hasFilters = attentionActive || Object.entries(filters).some(
    ([key, value]) => value !== "all" && value !== "",
  );

  const setFilter = (key, value) => {
    if (attentionActive) onClearAttention?.();
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const types = useMemo(() => {
    const uniqueTypes = [...new Set(entries.map(historyCategory))];
    return uniqueTypes.map((t) => ({
      value: t,
      label: HISTORY_CATEGORIES[t],
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [entries]);

  const quickTypes = CARE_EVENT_QUICK_TYPES.includes(filters.type)
    ? CARE_EVENT_QUICK_TYPES
    : [...CARE_EVENT_QUICK_TYPES, filters.type];
  const quickItems = quickTypes
    .map((value) => ({
      value,
      label: value === "all" ? "All" : HISTORY_CATEGORIES[value] || value,
      count: value === "all" ? entries.length : entries.filter((entry) => historyCategory(entry) === value).length,
    }))
    .filter(({ value, count }) => value === "all" || value === filters.type || count > 0);
  const advancedFilterCount = Number(Boolean(filters.startDate)) +
    Number(Boolean(filters.endDate)) +
    Number(filters.type !== "all" && !CARE_EVENT_QUICK_TYPES.includes(filters.type));
  const resetFilters = () => {
    if (attentionActive) onClearAttention?.();
    setFilters({ type: "all", startDate: "", endDate: "", query: "" });
  };
  const results = visibleEntries.length === 0 ? (
    <Empty title="No timeline records match these filters">
      Try a different search, type or date range.
      <div style={{ marginTop: "12px" }}>
        <Button variant="secondary" onClick={resetFilters}>Clear filters</Button>
      </div>
    </Empty>
  ) : (
    <ContinuousHistory entries={visibleEntries} episode={episode} person={person} onCorrectEvent={onCorrectEvent} onRecordAppointmentOutcome={onRecordAppointmentOutcome} onCollectAssessmentResponse={onCollectAssessmentResponse} canCollectAssessment={canCollectAssessment} selectedEventId={selectedEventId} careEventsOnly={careEventsOnly} showCategories={quickFilters} />
  );

  return (
    <div className="clinical-history">
      {quickFilters ? (
        <div className="care-event-filter-bar">
          <FilterTabs
            id="care-event-filter"
            label="Care event type"
            panelId="care-event-results"
            className="care-event-quick-filters"
            value={filters.type}
            onChange={(value) => setFilter("type", value)}
            items={quickItems}
          />
          <div className="care-event-search-row">
            <SearchInput
              value={filters.query}
              onChange={(value) => setFilter("query", value)}
              placeholder="Search care events"
            />
            <button
              type="button"
              className={`care-event-more-filters${advancedFilterCount ? " has-active-filters" : ""}`}
              aria-expanded={filtersOpen}
              aria-controls="care-event-advanced-filters"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <SlidersHorizontal size={17} aria-hidden="true" />
              <span className="care-event-more-label">More filters</span>
              <span className="care-event-more-label-short">Filters</span>
              {advancedFilterCount > 0 && <span className="care-event-more-count">{advancedFilterCount}</span>}
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          </div>
          <div id="care-event-advanced-filters" className="care-event-advanced-filters" hidden={!filtersOpen}>
            <label className="care-timeline-date">
              <span>From</span>
              <input type="date" value={filters.startDate} onChange={(event) => setFilter("startDate", event.target.value)} />
            </label>
            <label className="care-timeline-date">
              <span>To</span>
              <input type="date" value={filters.endDate} onChange={(event) => setFilter("endDate", event.target.value)} />
            </label>
            <div className="care-timeline-type">
              <span>Category</span>
              <Select label="Care event category" value={filters.type} onChange={(event) => setFilter("type", event.target.value)}>
                <option value="all">All types</option>
                {types.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </Select>
            </div>
            </div>
          <p className="care-event-results-count" aria-live="polite">
            <span>Showing {visibleEntries.length} of {entries.length} records</span>
            {visibleEntries.length !== entries.length && (
              <button type="button" className="filter-count-clear" onClick={resetFilters}>Clear filters</button>
            )}
          </p>
        </div>
      ) : (
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
              <Button variant="secondary" onClick={resetFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </div>
      </details>
      )}
      {quickFilters ? (
        <div id="care-event-results" role="tabpanel" aria-labelledby={`care-event-filter-tab-${quickItems.findIndex((item) => item.value === filters.type)}`}>
          {results}
        </div>
      ) : results}
    </div>
  );
}

export function ChangeLog({ episode, person, audit = [], entries: suppliedEntries, navigate }) {
  const entries = suppliedEntries ?? changeLogEntries(person, episode, audit);
  const isGlobal = suppliedEntries !== undefined;
  const missingValue = "__not_recorded__";
  const clearFilters = () => setFilters({
    scope: "all",
    person: "all",
    source: "all",
    actor: "all",
    startDate: "",
    endDate: "",
    query: "",
  });

  const [filters, setFilters] = useState({
    scope: "all",
    person: "all",
    source: "all",
    actor: "all",
    startDate: "",
    endDate: "",
    query: "",
  });

  const visibleEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (filters.query) {
        const q = filters.query.trim().toLowerCase();
        const changes = activityChangeDetails(entry);
        const changesText = changes.map(c => `${c.label} ${displayValue(c.before)} ${displayValue(c.after)}`).join(" ");

        const text = [
          entry.title,
          entry.detail,
          personEventText(entry.person || person, entry.detail),
          entry.person?.name,
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
      if (isGlobal) {
        if (filters.person !== "all" && entry.person?.id !== filters.person) return false;
        if (filters.source !== "all" && (entry.source || missingValue) !== filters.source) return false;
        if (filters.actor !== "all" && (entry.actor || missingValue) !== filters.actor) return false;
      }
      return true;
    });
  }, [entries, filters, isGlobal, person]);

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
  const people = useMemo(() => [...new Map(entries
    .filter((entry) => entry.person)
    .map((entry) => [entry.person.id, entry.person])).values()]
    .sort((a, b) => a.name.localeCompare(b.name)), [entries]);
  const sources = useMemo(() => [...new Set(entries.map((entry) => entry.source || missingValue))]
    .sort((a, b) => a === missingValue ? 1 : b === missingValue ? -1 : a.localeCompare(b)), [entries]);
  const actors = useMemo(() => [...new Set(entries.map((entry) => entry.actor || missingValue))]
    .sort((a, b) => a === missingValue ? 1 : b === missingValue ? -1 : a.localeCompare(b)), [entries]);
  const quickScopes = [...scopes]
    .sort((a, b) => entries.filter((entry) => entry.scope === b.value).length - entries.filter((entry) => entry.scope === a.value).length)
    .slice(0, 3);
  if (filters.scope !== "all" && !quickScopes.some((scope) => scope.value === filters.scope)) {
    quickScopes.push(scopes.find((scope) => scope.value === filters.scope) || { value: filters.scope, label: filters.scope });
  }
  const scopeItems = [
    { value: "all", label: "All", count: entries.length },
    ...quickScopes.map((scope) => ({
      ...scope,
      count: entries.filter((entry) => entry.scope === scope.value).length,
    })),
  ];
  const advancedFilterCount = [filters.person, filters.source, filters.actor]
    .filter((value) => value !== "all").length + Number(Boolean(filters.startDate)) + Number(Boolean(filters.endDate));

  return (
    <div className={`change-log${isGlobal ? " global-change-log" : ""}`}>
      <ListFilterBar
        id={isGlobal ? "global-change-scope" : "person-change-scope"}
        label="Change scope"
        items={scopeItems}
        value={filters.scope}
        onChange={(value) => setFilter("scope", value)}
        query={filters.query}
        onQueryChange={(value) => setFilter("query", value)}
        placeholder={isGlobal ? "Search people, changes, fields or actors" : "Search changes, fields or actors"}
        shown={visibleEntries.length}
        total={entries.length}
        noun="changes"
        activeAdvancedCount={advancedFilterCount}
        onClear={clearFilters}
        advanced={<>
          {isGlobal && <>
            <div className="care-timeline-type">
              <span>Person</span>
              <Select label="Filter by person" value={filters.person} onChange={(event) => setFilter("person", event.target.value)}>
                <option value="all">All people</option>
                {people.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </div>
            <div className="care-timeline-type">
              <span>Source</span>
              <Select label="Filter by source" value={filters.source} onChange={(event) => setFilter("source", event.target.value)}>
                <option value="all">All sources</option>
                {sources.map((source) => <option key={source} value={source}>{source === missingValue ? "Not recorded" : source}</option>)}
              </Select>
            </div>
            <div className="care-timeline-type">
              <span>Changed by</span>
              <Select label="Filter by changed by" value={filters.actor} onChange={(event) => setFilter("actor", event.target.value)}>
                <option value="all">Anyone</option>
                {actors.map((actor) => <option key={actor} value={actor}>{actor === missingValue ? "Editor not recorded" : actor}</option>)}
              </Select>
            </div>
          </>}
          <label className="care-timeline-date">
            <span>From</span>
            <input type="date" value={filters.startDate} onChange={(event) => setFilter("startDate", event.target.value)} />
          </label>
          <label className="care-timeline-date">
            <span>To</span>
            <input type="date" value={filters.endDate} onChange={(event) => setFilter("endDate", event.target.value)} />
          </label>
          <div className="care-timeline-type">
            <span>Scope</span>
            <Select label="Change scope" value={filters.scope} onChange={(event) => setFilter("scope", event.target.value)}>
              <option value="all">All scopes</option>
              {scopes.map((scope) => <option key={scope.value} value={scope.value}>{scope.label}</option>)}
            </Select>
          </div>
        </>}
      />

      {visibleEntries.length ? (
        <ol className="record-timeline" aria-label="Field change log">
          {visibleEntries.map((entry) => {
            const changes = activityChangeDetails(entry);
            const entryTimestamp =
              entry.timestamp || (entry.date?.includes("T") ? entry.date : null);
            const details = [
              ...(isGlobal ? [["Person", (
                <a
                  href={`/people/${encodeURIComponent(entry.person.id)}?tab=change%20log${entry.episodeId ? `&episode=${encodeURIComponent(entry.episodeId)}` : ""}`}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(event.currentTarget.getAttribute("href"));
                  }}
                >
                  {entry.person.name}
                </a>
              )]] : []),
              ["Changed by", actorLabel(entry)],
              ...(entry.scope ? [["Scope", entry.scope]] : []),
              ...(entry.reason ? [["Reason", entry.reason]] : []),
              ...(isGlobal ? [["Source", entry.source || "Not recorded"]] : entry.source ? [["Source", entry.source]] : []),
            ];
            return (
              <li className="record-timeline-entry" key={`${entry.person?.id || person?.id}:${entry.id}`}>
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
              Try different filters or a different search.
              <div style={{ marginTop: "12px" }}>
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            </>
          ) : (
            isGlobal ? "No field changes have been recorded across this workspace." : "No field changes have been recorded for this care episode."
          )}
        </Empty>
      )}
    </div>
  );
}
