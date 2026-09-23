import { useState } from "react";
import { X } from "lucide-react";
import { careTimelineData, timelineExtent, timelinePosition } from "../careTimeline";
import { k10Series, K10_SCORING_METHOD, K10_METHOD_URL } from "../k10";
import { recordedCareEvents } from "../careEvents";
import { collectionActor, formatDate } from "../model";
import { reportEvidence } from "../progress";
import { TextLink, Badge } from "../components/UI";

const dateLabel = (date, showYear) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(showYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });

function timelineTicks(start, end) {
  if (!start || !end) return [];
  const first = Date.parse(`${start}T12:00:00Z`);
  const last = Date.parse(`${end}T12:00:00Z`);
  const showYear = start.slice(0, 4) !== end.slice(0, 4);
  if (first === last) return [{ position: 50, label: dateLabel(start, true) }];
  const positions =
    last - first < 60 * 86400000 ? [0, 50, 100] : [0, 25, 50, 75, 100];
  return positions.map((position) => ({
    position,
    label: dateLabel(
      new Date(first + ((last - first) * position) / 100)
        .toISOString()
        .slice(0, 10),
      showYear,
    ),
  }));
}

function reportLanes(timeline) {
  return [
    ...timeline.lanes.flatMap((lane) => {
      if (!lane.entries.length) return [];
      if (["k10", "responses", "reviews"].includes(lane.id)) return [];
      return [
        {
          ...lane,
          group:
            ["services", "medication"].includes(lane.id)
              ? "care"
              : "context",
        },
      ];
    }),
    ...(timeline.goals.length
      ? [
          {
            id: "goals",
            label: "Goals and functioning",
            subLabel: "Recorded milestones",
            group: "context",
            entries: timeline.goals,
          },
        ]
      : []),
    ...(timeline.riskRows.some((row) => row.entries.length)
      ? [
          {
            id: "risk-history",
            label: "Risk history",
            subLabel: "Recorded risk-related events",
            group: "context",
            entries: timeline.riskRows.flatMap((row) => row.entries),
          },
        ]
      : []),
  ];
}

function sourceRecord(episode, entry) {
  if (entry.sourceType === "collection")
    return episode.collections.find((record) => record.id === entry.sourceId);
  if (entry.sourceType === "event")
    return recordedCareEvents(episode).find(
      (record) => record.id === entry.sourceId,
    );
  if (entry.sourceType === "service")
    return episode.servicePeriods?.find(
      (record) => record.id === entry.sourceId,
    );
  if (entry.sourceType === "medication-course")
    return episode.medicationCourses?.find(
      (record) => record.id === entry.sourceId,
    );
  if (entry.sourceType === "k10")
    return episode.k10Responses?.find((record) => record.id === entry.sourceId);
  if (entry.sourceType === "goal")
    return episode.goalMilestones?.find(
      (record) => record.id === entry.sourceId,
    );
  return null;
}

function RecordDetail({ person, episode, entry, onClose, onOpenSource }) {
  if (!entry) return null;
  const source = sourceRecord(episode, entry);
  const collection = entry.sourceType === "collection" ? source : null;
  const event = entry.sourceType === "event" ? source : null;
  const k10 = entry.sourceType === "k10" ? source : null;
  const isPlanned = entry.kind === "planned";
  const sourceLabel =
    entry.sourceType === "collection"
      ? "Assessment"
      : entry.sourceType === "event"
        ? "Care event"
        : entry.sourceType === "service"
          ? "Service period"
          : entry.sourceType === "medication-course"
            ? "Medication course"
            : entry.sourceType === "k10"
              ? "K10 response"
              : "Goal milestone";

  return (
    <aside
      className={`longitudinal-detail longitudinal-detail-${entry.sourceType}`}
      id={`timeline-detail-${entry.id}`}
      aria-live="polite"
      aria-labelledby={`timeline-record-${entry.id}`}
    >
      <button
        type="button"
        className="longitudinal-detail-close"
        aria-label="Close record detail"
        onClick={onClose}
      >
        <X size={16} aria-hidden="true" />
      </button>
      <div>
        <span className="longitudinal-kicker">{sourceLabel}</span>
        <h3 id={`timeline-record-${entry.id}`}>{entry.label}</h3>
        <p>{entry.detail}</p>
      </div>
      <dl>
        <div>
          <dt>
            {isPlanned
              ? "Due"
              : entry.end
                ? "Recorded period"
                : entry.kind === "response"
                  ? "Submitted"
                  : entry.kind === "reviewed"
                    ? "Reviewed"
                    : entry.sourceType === "event"
                      ? "Event date"
                      : "Milestone date"}
          </dt>
          <dd>
            <time dateTime={entry.date}>{formatDate(entry.date)}</time>
            {entry.end ? ` – ${formatDate(entry.end)}` : ""}
          </dd>
        </div>
        {collection && (
          <>
            <div>
              <dt>Questionnaire</dt>
              <dd>{collection.version || "Not recorded"}</dd>
            </div>
            {isPlanned ? (
              <div>
                <dt>Collection state</dt>
                <dd>{collection.response || "Not recorded"}</dd>
              </div>
            ) : (
              <>
                <div>
                  <dt>Respondent</dt>
                  <dd>
                    {collectionActor(person, collection, "respondent")} ·{" "}
                    {collection.respondent || "Role not recorded"}
                  </dd>
                </div>
                <div>
                  <dt>Recorder</dt>
                  <dd>{collectionActor(person, collection, "recorder")}</dd>
                </div>
                <div>
                  <dt>Review state</dt>
                  <dd>{collection.review || "Not recorded"}</dd>
                </div>
                {entry.kind === "reviewed" && (
                  <div>
                    <dt>Reviewed by</dt>
                    <dd>{collection.reviewActor || "Not recorded"}</dd>
                  </div>
                )}
              </>
            )}
          </>
        )}
        {event && (
          <>
            <div>
              <dt>Recorded by</dt>
              <dd>
                {event.actor || "Not recorded"}
                {event.role ? ` · ${event.role}` : ""}
              </dd>
            </div>
            <div>
              <dt>Record detail</dt>
              <dd>{event.detail || "No detail recorded"}</dd>
            </div>
          </>
        )}
        {k10 && (
          <>
            <div>
              <dt>Respondent and recorder</dt>
              <dd>
                {k10.respondentName} · {k10.recorderName}
              </dd>
            </div>
            <div>
              <dt>Ten item values</dt>
              <dd>{k10.answers.join(", ")} · each 1–5</dd>
            </div>
            <div>
              <dt>Scoring method</dt>
              <dd>{k10.scoringMethod}</dd>
            </div>
          </>
        )}
        {["service", "goal", "medication-course", "k10"].includes(
          entry.sourceType,
        ) && (
          <div>
            <dt>Source status</dt>
            <dd>{source?.status || source?.review || "Not recorded"}</dd>
          </div>
        )}
        {entry.sourceType === "medication-course" && (
          <div>
            <dt>Source and recorder</dt>
            <dd>
              {source?.source} · {source?.recordedBy}
            </dd>
          </div>
        )}
        <div>
          <dt>Care episode</dt>
          <dd>{episode.id}</dd>
        </div>
      </dl>
      {(collection || event) && (
        <TextLink onClick={() => onOpenSource(entry)}>
          Open source record
        </TextLink>
      )}
      {["service", "goal", "medication-course", "k10"].includes(
        entry.sourceType,
      ) && (
        <small>
          Source detail is shown here because this prototype has no separate
          record view for this item.
        </small>
      )}
    </aside>
  );
}

function K10MeasureLane({
  person,
  episode,
  points,
  timeline,
  selected,
  onSelect,
  onClose,
  onOpenSource,
}) {
  if (!points.length) return null;
  const selectedEntry = points.some((point) => point.id === selected?.id)
    ? selected
    : null;
  const y = (total) => 100 - ((total - 10) / 40) * 76 - 12;
  const pointPairs = points.map(
    (point) =>
      `${timelinePosition(point.date, timeline.start, timeline.end)},${y(point.total)}`,
  );

  return (
    <div className="longitudinal-lane longitudinal-measure-lane">
      <div className="longitudinal-lane-label">
        <strong>K10 raw total</strong>
        <small>Complete ten-item responses · 10–50</small>
      </div>
      <div className="longitudinal-measure-track">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {[10, 30, 50].map((value) => (
            <line key={value} x1="0" x2="100" y1={y(value)} y2={y(value)} />
          ))}
          <polyline points={pointPairs.join(" ")} />
        </svg>
        {points.map((point) => {
          const entryId = point.id;
          return (
            <button
              key={point.id}
              type="button"
              className={`longitudinal-measure-point${selected?.id === entryId ? " selected" : ""}`}
              style={{
                left: `${timelinePosition(point.date, timeline.start, timeline.end)}%`,
                top: `${y(point.total)}%`,
              }}
              aria-label={`K10 raw total ${point.total} of 50 on ${formatDate(point.date)}`}
              aria-pressed={selected?.id === entryId}
              aria-expanded={selected?.id === entryId}
              onClick={() => onSelect(entryId)}
            >
              {point.total}
            </button>
          );
        })}
      </div>
      {selectedEntry && (
        <div className="longitudinal-lane-detail">
          <RecordDetail
            key={selectedEntry.id}
            person={person}
            episode={episode}
            entry={selectedEntry}
            onClose={onClose}
            onOpenSource={onOpenSource}
          />
        </div>
      )}
    </div>
  );
}

function SharedTimeline({
  person,
  episode,
  timeline,
  onOpenSource,
  undated,
  isVisible = true,
  onToggle,
}) {
  const allLanes = reportLanes(timeline);
  const k10Points = k10Series(episode).points;
  const k10Entries =
    timeline.lanes.find((lane) => lane.id === "k10")?.entries || [];
  const plottedEntries = [...allLanes.flatMap((lane) => lane.entries), ...k10Entries];
  const plotRange = timelineExtent(plottedEntries);
  const [activeGroup, setActiveGroup] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const visibleLanes = allLanes.filter(
    (lane) => activeGroup === "all" || lane.group === activeGroup,
  );
  const showMeasure = activeGroup === "all" || activeGroup === "measure";
  const visibleEntries = [
    ...visibleLanes.flatMap((lane) => lane.entries),
    ...(showMeasure ? k10Entries : []),
  ].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  const selected = selectedId
    ? visibleEntries.find((entry) => entry.id === selectedId) || null
    : null;
  const toggleSelected = (entryId) => {
    setSelectedId((currentId) => (currentId === entryId ? null : entryId));
  };
  const dismissDetail = () => setSelectedId(null);
  const ticks = timelineTicks(plotRange.start, plotRange.end);
  const filters = [
    ["all", "All", "All tracks"],
    ["care", "Care", "Care and medication"],
    ["context", "Context", "Goals, events and risk"],
    ["measure", "K10", "K10 measure"],
  ].filter(([id]) => id !== "measure" || k10Points.length > 0);

  return (
    <section
      id="report-care-timeline"
      className={`longitudinal-panel longitudinal-report-card${isVisible ? "" : " report-section-collapsed"}`}
      aria-labelledby="longitudinal-timeline-heading"
    >
      <header className="longitudinal-card-header">
        <div>
          <h2 id="longitudinal-timeline-heading">Care timeline</h2>
          <p>
            {plotRange.start && plotRange.end
              ? `${formatDate(plotRange.start)} to ${formatDate(plotRange.end)}`
              : "Care episode timeline"}
          </p>
        </div>
        <div className="longitudinal-card-actions">
          {onToggle && (
            <button
              type="button"
              className="report-section-toggle"
              aria-expanded={isVisible}
              onClick={onToggle}
            >
              {isVisible ? "Hide" : "Show"}
            </button>
          )}
        </div>
      </header>
      {isVisible && (visibleEntries.length ? (
        <>
          <div className="longitudinal-view-toolbar">
            <span>Timeline view</span>
            <div
              className="longitudinal-filter"
              role="group"
              aria-label="Show timeline tracks"
            >
              {filters.map(([id, label, accessibleLabel]) => (
                <button
                  type="button"
                  key={id}
                  className={activeGroup === id ? "selected" : ""}
                  aria-label={accessibleLabel}
                  aria-pressed={activeGroup === id}
                  onClick={() => setActiveGroup(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="longitudinal-key" aria-label="Timeline key">
            <strong>How to read this timeline</strong>
            <span>
              <i className="longitudinal-key-bar" /> Service period
            </span>
            <span>
              <i className="longitudinal-key-medication-bar" /> Medication
              course
            </span>
            <span>
              <i className="longitudinal-key-event" /> Dated event or risk
            </span>
            <span>
              <i className="longitudinal-key-goal" /> Dated goal milestone
            </span>
          </div>
          <div
            className="longitudinal-scroll"
            tabIndex={0}
            aria-label="Scrollable care timeline"
          >
            <div className="longitudinal-plot">
              <div className="longitudinal-axis">
                <span>Timeline</span>
                <div>
                  {ticks.map((tick) => (
                    <time
                      key={tick.position}
                      style={{ left: `${tick.position}%` }}
                    >
                      {tick.label}
                    </time>
                  ))}
                </div>
              </div>
              {visibleLanes.map((lane) => {
                const selectedEntry = lane.entries.find(
                  (entry) => entry.id === selected?.id,
                );

                return (
                  <div
                    className={`longitudinal-lane${selectedEntry ? " expanded" : ""}`}
                    key={lane.id}
                  >
                    <div className="longitudinal-lane-label">
                      <strong>{lane.label}</strong>
                      <small>
                        {lane.subLabel ||
                          `${lane.entries.length} recorded item${lane.entries.length === 1 ? "" : "s"}`}
                      </small>
                    </div>
                    <div className="longitudinal-track">
                      {lane.entries.map((entry) => {
                        const position = timelinePosition(
                          entry.date,
                          plotRange.start,
                          plotRange.end,
                        );
                        const width = entry.end
                          ? Math.max(
                              1,
                              timelinePosition(
                                entry.end,
                                plotRange.start,
                                plotRange.end,
                              ) - position,
                            )
                          : null;
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            className={`longitudinal-mark longitudinal-mark-${entry.kind}${entry.kind === "duration" && /^Planned/i.test(entry.detail) ? " planned-care" : ""}${selected?.id === entry.id ? " selected" : ""}`}
                            style={{
                              left: `${position}%`,
                              ...(width ? { width: `${width}%` } : {}),
                            }}
                            aria-label={`${lane.label}: ${entry.label}, ${formatDate(entry.date)}${entry.end ? ` to ${formatDate(entry.end)}` : ""}. ${entry.detail}`}
                            aria-pressed={selected?.id === entry.id}
                            aria-expanded={selected?.id === entry.id}
                            onClick={() => toggleSelected(entry.id)}
                          />
                        );
                      })}
                    </div>
                    {selectedEntry && (
                      <div className="longitudinal-lane-detail">
                        <RecordDetail
                          key={selectedEntry.id}
                          person={person}
                          episode={episode}
                          entry={selectedEntry}
                          onClose={dismissDetail}
                          onOpenSource={onOpenSource}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              {showMeasure && (
                <K10MeasureLane
                  person={person}
                  episode={episode}
                  points={k10Points}
                  timeline={plotRange}
                  selected={selected}
                  onSelect={toggleSelected}
                  onClose={dismissDetail}
                  onOpenSource={onOpenSource}
                />
              )}
            </div>
          </div>
          <p className="longitudinal-scroll-hint">
            Scroll sideways to see the full date range. Select a point, bar or
            marker for its source detail.
          </p>
          <details className="longitudinal-record-list">
            <summary>Browse visible records</summary>
            {visibleLanes.map((lane) => (
              <div key={lane.id}>
                <h4>{lane.label}</h4>
                <ul>
                  {lane.entries
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((entry) => (
                      <li key={entry.id}>
                        <button
                          type="button"
                          onClick={() => toggleSelected(entry.id)}
                        >
                          <time dateTime={entry.date}>
                            {formatDate(entry.date)}
                          </time>
                          <span>{entry.label}</span>
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </details>
        </>
      ) : (
        <p className="longitudinal-empty">
          No dated records are available for this care episode.
        </p>
      ))}
      {isVisible && <p className="longitudinal-caveat">
        Markers show when records were made or events were recorded. Their
        proximity does not show that one caused a change in an answer or
        outcome.
      </p>}
      {isVisible && undated > 0 && (
        <p className="longitudinal-caveat">
          {undated} submitted response{undated === 1 ? " has" : "s have"} no
          valid submission date and cannot appear on this timeline.
        </p>
      )}
    </section>
  );
}

function K10TrendChart({ episode }) {
  const { points, omitted } = k10Series(episode);
  if (!points.length) return null;
  const start = points[0].date;
  const end = points.at(-1).date;
  const x = (date) => 48 + (timelinePosition(date, start, end) * 548) / 100;
  const y = (total) => 190 - ((total - 10) / 40) * 160;
  const description = `Fictional K10 raw totals, range 10 to 50. ${points.map((point) => `${formatDate(point.date)}: ${point.total}`).join("; ")}. ${omitted} incomplete or incompatible responses omitted.`;
  return (
    <section
      className="longitudinal-panel longitudinal-k10"
      aria-labelledby="longitudinal-k10-heading"
    >
      <div className="longitudinal-panel-heading">
        <div>
          <span className="longitudinal-kicker">
            Complete ten-item responses · fictional example
          </span>
          <h3 id="longitudinal-k10-heading">K10 raw total over time</h3>
          <p>
            Each total sums ten answers scored 1–5 for the previous four weeks.
            The line connects recorded dates; it does not estimate values
            between responses.
          </p>
        </div>
        <Badge>{points.length} scored responses</Badge>
      </div>
      <figure>
        <svg viewBox="0 0 640 225" role="img" aria-label={description}>
          {[10, 20, 30, 40, 50].map((value) => (
            <g key={value}>
              <line
                className="longitudinal-mini-grid"
                x1="48"
                x2="596"
                y1={y(value)}
                y2={y(value)}
              />
              <text
                className="longitudinal-k10-tick"
                x="36"
                y={y(value) + 4}
                textAnchor="end"
              >
                {value}
              </text>
            </g>
          ))}
          <polyline
            className="longitudinal-k10-line"
            points={points
              .map((point) => `${x(point.date)},${y(point.total)}`)
              .join(" ")}
          />
          {points.map((point) => (
            <g key={point.id}>
              <circle
                className="longitudinal-k10-point"
                cx={x(point.date)}
                cy={y(point.total)}
                r="6"
              />
              <text
                className="longitudinal-k10-value"
                x={x(point.date)}
                y={y(point.total) - 12}
                textAnchor="middle"
              >
                {point.total}
              </text>
            </g>
          ))}
        </svg>
        <figcaption>
          {formatDate(start)} to {formatDate(end)} · raw total 10–50, higher
          values reflect more reported distress. No threshold or diagnosis is
          applied.
        </figcaption>
      </figure>
      <details className="longitudinal-k10-values">
        <summary>Read each score and source response</summary>
        <ol>
          {points.map((point) => (
            <li key={point.id}>
              <time dateTime={point.date}>{formatDate(point.date)}</time>
              <strong>{point.total} / 50</strong>
              <span>
                {point.respondentName} · {point.review} · ten values:{" "}
                {point.answers.join(", ")}
              </span>
            </li>
          ))}
        </ol>
      </details>
      {omitted > 0 && (
        <p>
          {omitted} response{omitted === 1 ? "" : "s"} omitted because the date,
          scoring method or one of ten item values is missing or invalid.
        </p>
      )}
      <p className="longitudinal-caveat">
        Scoring method:{" "}
        <a href={K10_METHOD_URL}>
          {K10_SCORING_METHOD} (Australian Bureau of Statistics)
        </a>
        . Fictional responses illustrate a raw score display; this prototype has
        no approved clinical interpretation or treatment-effect claim.
      </p>
    </section>
  );
}

function CareAndMedicationChart({ timeline }) {
  const care =
    timeline.lanes.find((lane) => lane.id === "services")?.entries || [];
  const medication =
    timeline.lanes.find((lane) => lane.id === "medication")?.entries || [];
  const rows = [...care, ...medication];
  const plotRange = timelineExtent(rows);
  const hasCourses = medication.some(
    (entry) => entry.kind === "medication-duration",
  );
  const ticks = timelineTicks(plotRange.start, plotRange.end);
  return (
    <section
      className="longitudinal-panel"
      aria-labelledby="longitudinal-care-heading"
    >
      <div className="longitudinal-panel-heading">
        <div>
          <span className="longitudinal-kicker">
            Duration and dated changes
          </span>
          <h3 id="longitudinal-care-heading">Care and medication context</h3>
          <p>
            {hasCourses
              ? "Recorded service periods and medication courses are bars. Medication reviews and adverse events are dated markers; no other duration is inferred."
              : "Recorded service periods are bars. Medication records are dated events; no prescription duration is inferred."}
          </p>
        </div>
      </div>
      {rows.length ? (
        <div className="longitudinal-care-chart">
          <div className="longitudinal-care-axis">
            <span>Record</span>
            <div>
              {ticks.map((tick) => (
                <time key={tick.position} style={{ left: `${tick.position}%` }}>
                  {tick.label}
                </time>
              ))}
            </div>
          </div>
          {rows.map((entry) => {
            const position = timelinePosition(
              entry.date,
              plotRange.start,
              plotRange.end,
            );
            const width = entry.end
              ? Math.max(
                  1,
                  timelinePosition(entry.end, plotRange.start, plotRange.end) -
                    position,
                )
              : null;
            return (
              <div className="longitudinal-care-row" key={entry.id}>
                <div>
                  <strong>{entry.label}</strong>
                  <small>
                    {formatDate(entry.date)}
                    {entry.end
                      ? ` – ${formatDate(entry.end)}`
                      : " · dated event"}
                  </small>
                </div>
                <div className="longitudinal-care-track">
                  {width ? (
                    <span
                      className={`longitudinal-care-bar ${entry.kind === "medication-duration" ? "medication" : ""}`}
                      style={{ left: `${position}%`, width: `${width}%` }}
                    />
                  ) : (
                    <span
                      className={`longitudinal-care-dot ${entry.kind === "medication" ? "medication" : ""}`}
                      style={{ left: `${position}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="longitudinal-empty">
          No dated service periods or medication events are recorded for this
          episode.
        </p>
      )}
      <p className="longitudinal-caveat">
        Select the matching item in the care episode timeline above to inspect
        its source. Timing alone does not establish treatment effect.
      </p>
    </section>
  );
}

export function CareTimeline({ person, episode, navigate, isVisible, onToggle }) {
  const timeline = careTimelineData(episode);
  const evidence = reportEvidence(person, episode);

  const openSource = (entry) => {
    const params = new URLSearchParams({ episode: episode.id });
    if (entry.sourceType === "collection") {
      params.set("tab", "assessment");
      params.set("collection", entry.sourceId);
    } else {
      params.set("tab", "events");
      params.set("event", entry.sourceId);
    }
    navigate(`/people/${person.id}?${params}`, { scroll: false });
  };

  return (
    <SharedTimeline
      person={person}
      episode={episode}
      timeline={timeline}
      onOpenSource={openSource}
      undated={evidence.undated.length}
      isVisible={isVisible}
      onToggle={onToggle}
    />
  );
}
