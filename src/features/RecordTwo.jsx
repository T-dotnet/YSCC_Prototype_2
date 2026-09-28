import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  ExternalLink,
} from "lucide-react";
import { CareTimeline, hasCareTimelineEntries } from "./LongitudinalReport";
import { Badge, Button, Modal, Panel, TextLink } from "../components/UI";
import ReportingIndicator from "../components/ReportingIndicator";
import { GOVERNED_MEASURES } from "../measureGovernance";
import { collectionStatus, formatDate } from "../model";
import { currentCollection } from "../workflow";
import { useStore } from "../store";
import { assessmentSchedulingEnabled, assessmentContactLinkingEnabled, assessmentSmsEnabled } from "../assessmentFeatures";
import {
  episodeOutcomeRecords,
  isCompletedScore,
  outcomeMeasureCards,
  scoreChangeLabel,
} from "../outcomeMeasures";

const months = [0, 3, 6, 9, 12, 15, 18];
const axis = ({ fullWidth = false, className = "" } = {}) => (
  <div
    className={`record-two-axis${fullWidth ? " record-two-axis-full" : ""}${className ? ` ${className}` : ""}`}
    aria-hidden="true"
  >
    {months.map((month) => (
      <span key={month} style={{ left: `${(month / 18) * 100}%` }}>
        {month}m
      </span>
    ))}
  </div>
);

const point = (month, value) => `${(month / 18) * 100},${100 - value}`;
const pointEdge = (position) => position < 28 ? "start" : position > 72 ? "end" : undefined;

function ChartCard({
  title,
  description,
  children,
  className = "",
  isVisible = true,
  onToggle,
  reportingType = "context",
  showReportingIndicator = true,
}) {
  return (
    <section
      className={`record-two-card ${className}${isVisible ? "" : " report-section-collapsed"}`}
    >
      <header>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <div className="record-two-header-actions">
          {showReportingIndicator && <ReportingIndicator type={reportingType} />}
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
      {isVisible && children}
    </section>
  );
}

function Symptoms() {
  const [selected, setSelected] = useState(null);
  const values = [
    [
      "Anxiety",
      [
        [1, 76],
        [3, 70],
        [6, 61],
        [9, 50],
        [13, 44],
        [17, 35],
      ],
    ],
    [
      "Sleep",
      [
        [0, 70],
        [4, 61],
        [8, 48],
        [12, 38],
        [16, 34],
      ],
    ],
    [
      "Concentration",
      [
        [2, 66],
        [5, 56],
        [10, 49],
        [14, 43],
        [18, 38],
      ],
    ],
  ];
  return (
    <ChartCard
      title="Symptoms / measures"
      description="Recorded observations only; points are not interpolated."
      showReportingIndicator={false}
    >
      <div
        className="record-two-scatter"
        role="group"
        aria-label="Symptom observations over the shared 18-month period"
      >
        {values.map(([label, entries]) => (
          <div className="record-two-series" key={label}>
            <strong>{label}</strong>
            <div className="record-two-plot">
              {entries.map(([month, value]) => (
                <button
                  type="button"
                  key={`${month}-${value}`}
                  aria-label={`${label}, month ${month}, severity ${value}`}
                  className="record-two-dot"
                  data-edge={pointEdge((month / 18) * 100)}
                  style={{
                    left: `${(month / 18) * 100}%`,
                    bottom: `${value}%`,
                  }}
                  onClick={() =>
                    setSelected(`${label} · month ${month} · severity ${value}`)
                  }
                >
                  <span className="report-chart-tooltip" aria-hidden="true">Month {month} · severity {value}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {axis()}
      <p className="record-two-selection" aria-live="polite">
        {selected || "Select an observation for its recorded detail."}
      </p>
    </ChartCard>
  );
}

function Periods({ medication = false }) {
  const rows = medication
    ? [
        ["Medication A", 0, 7],
        ["Medication B", 5, 14],
        ["Medication C", 10, 18],
      ]
    : [
        ["Group therapy", 0, 6],
        ["School support", 2, 9],
        ["Parent programme", 4, 12],
        ["Individual support", 11, 16],
      ];
  return (
    <ChartCard
      title={
        medication ? "Medication periods" : "Treatment / programme periods"
      }
      description={
        medication
          ? "Medication events are attached to the active course."
          : "Active periods are positioned at their recorded start and end."
      }
      showReportingIndicator={false}
    >
      <div className="record-two-periods">
        {rows.map(([label, start, end], index) => (
          <div className="record-two-period-row" key={label}>
            <strong>{label}</strong>
            <div className="record-two-period-track">
              <button
                type="button"
                className={`record-two-period-bar${medication ? " medication" : ""}`}
                style={{
                  left: `${(start / 18) * 100}%`,
                  width: `${((end - start) / 18) * 100}%`,
                }}
                aria-label={`${label}, month ${start} to month ${end}`}
              >
                <span className="report-chart-tooltip" aria-hidden="true">Month {start}–{end}</span>
              </button>
              {medication && index > 0 && (
                <button
                  type="button"
                  className="record-two-period-marker"
                  style={{ left: `${((start + 1) / 18) * 100}%` }}
                  aria-label={`Dose change, month ${start + 1}`}
                ><span className="report-chart-tooltip" aria-hidden="true">Dose change · month {start + 1}</span></button>
              )}
            </div>
          </div>
        ))}
      </div>
      {axis({ className: "record-two-period-axis" })}
      {medication && <p className="record-two-period-note">Dose changes at 6m and 11m.</p>}
    </ChartCard>
  );
}

function Goals() {
  const goals = [
    ["Improve sleep routine", 70, "Progressing"],
    ["Increase school attendance", 55, "Progressing"],
    ["Build social confidence", null, "In progress"],
    ["Reduce screen time", 100, "Achieved"],
  ];
  return (
    <ChartCard
      title="Goals and progress"
      description="Progress is shown as a percentage only where the record supports one."
      showReportingIndicator={false}
    >
      <ol className="record-two-goals">
        {goals.map(([label, value, state]) => (
          <li key={label} className={state === "Achieved" ? "goal-achieved" : ""}>
            <div>
              <strong>{label}</strong>
              <span>{state}</span>
            </div>
            {value === null ? (
              <em>Not scored</em>
            ) : (
              <>
                <div className="record-two-progress">
                  <i style={{ width: `${value}%` }} />
                </div>
                <b>{value}%</b>
              </>
            )}
          </li>
        ))}
      </ol>
    </ChartCard>
  );
}

function LineChart() {
  const lines = [[
    "Activity",
    "var(--action-coral)",
    [[0, 22], [3, 31], [6, 39], [9, 55], [12, 70], [15, 74], [18, 78]],
  ]];
  return (
    <ChartCard
      title="Activity rating over time"
      description="The line shows the trajectory between recorded activity assessments."
      showReportingIndicator={false}
    >
      <div className="record-two-line-wrap">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label="Activity rating trajectory"
        >
          <line x1="0" x2="100" y1="100" y2="100" />
          {lines.map(([label, colour, values]) => (
            <g key={label}>
              <polygon points={`0,100 ${values.map(([month, value]) => point(month, value)).join(" ")} 100,100`} />
              <polyline
                points={values
                  .map(([month, value]) => point(month, value))
                  .join(" ")}
                stroke={colour}
              />
            </g>
          ))}
        </svg>
        {lines.flatMap(([label, colour, values]) =>
          values.map(([month, value]) => (
            <button
              type="button"
              key={`${label}-${month}`}
              className="record-two-line-point"
              data-edge={pointEdge((month / 18) * 100)}
              style={{
                left: `${(month / 18) * 100}%`,
                bottom: `${value}%`,
                "--record-two-line-colour": colour,
              }}
              aria-label={`${label}, month ${month}, value ${value}`}
            >
              <span className="report-chart-tooltip" aria-hidden="true">Month {month} · value {value}</span>
            </button>
          )),
        )}
      </div>
      {axis({ fullWidth: true })}
    </ChartCard>
  );
}

const REPORT_OUTCOME_KEYS = [
  "k10-plus",
  "k5",
  "sdq",
  "iar-dst",
  "who-5",
  "sidas",
];
const OUTCOME_CARD_KEYS = ["sdq", "iar-dst", "who-5", "sidas"];

const directionIcon = (direction) => {
  if (direction === "improved") return ArrowUp;
  if (direction === "deteriorated") return ArrowDown;
  return ArrowRight;
};

const statusLabel = (status) =>
  status === "Complete" ? "Completed" : status || "Not recorded";

function trendPosition(record, records) {
  const first = Date.parse(`${records[0]?.date}T12:00:00Z`);
  const last = Date.parse(`${records.at(-1)?.date}T12:00:00Z`);
  const current = Date.parse(`${record.date}T12:00:00Z`);
  if (Number.isFinite(first) && Number.isFinite(last) && Number.isFinite(current) && last > first)
    return ((current - first) / (last - first)) * 100;
  const index = records.findIndex((item) => item.id === record.id);
  return records.length < 2 ? 50 : (index / (records.length - 1)) * 100;
}

function OutcomeTrend({ measure, selectedRecord, onSelect }) {
  const completed = measure.records.filter(isCompletedScore);
  const numericValues = completed.map((record) => Number(record.value));
  if (!numericValues.length)
    return (
      <section className="outcome-trend-empty" aria-label="Score trend unavailable">
        <strong>No completed scores to plot</strong>
        <p>
          The completion history is retained below. A score trend will appear
          only when a completed, configured score is available.
        </p>
      </section>
    );

  const [minimum, maximum] = measure.scoreRange || [
    Math.min(...numericValues),
    Math.max(...numericValues),
  ];
  const span = Math.max(maximum - minimum, 1);
  const verticalPosition = (value) =>
    Math.max(0, Math.min(100, ((Number(value) - minimum) / span) * 100));
  const pointList = completed
    .map(
      (record) =>
        `${trendPosition(record, measure.records)},${100 - verticalPosition(record.value)}`,
    )
    .join(" ");
  const firstCompletedX = trendPosition(completed[0], measure.records);
  const lastCompletedX = trendPosition(completed.at(-1), measure.records);
  const textSummary = completed
    .map((record) => `${formatDate(record.date)}: ${record.value}`)
    .join("; ");

  return (
    <section className="outcome-trend" aria-label={`${measure.displayName} score trend`}>
      <div className="outcome-trend-heading">
        <div>
          <h4>Score trend</h4>
          <p>Assessment dates and recorded scores</p>
        </div>
        <span>
          Scale {minimum}–{maximum}
        </span>
      </div>
      <div className="outcome-trend-plot">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {measure.severityBands?.map((band) => {
            const start = verticalPosition(band.from);
            const end = verticalPosition(band.to);
            return (
              <rect
                className={`outcome-band outcome-band-${band.tone}`}
                key={band.label}
                x="0"
                width="100"
                y={100 - Math.max(start, end)}
                height={Math.abs(end - start)}
              />
            );
          })}
          {[25, 50, 75].map((line) => (
            <line key={line} x1="0" x2="100" y1={line} y2={line} />
          ))}
          {completed.length > 1 && <polygon className="outcome-trend-area" points={`${firstCompletedX},100 ${pointList} ${lastCompletedX},100`} />}
          {completed.length > 1 && <polyline points={pointList} />}
        </svg>
        {measure.records.map((record) => {
          const completedScore = isCompletedScore(record);
          const isSelected = selectedRecord?.id === record.id;
          return (
            <button
              type="button"
              key={record.id}
              className={`outcome-trend-point${completedScore ? "" : " incomplete"}${isSelected ? " selected" : ""}`}
              style={
                completedScore
                  ? {
                      left: `${trendPosition(record, measure.records)}%`,
                      bottom: `${verticalPosition(record.value)}%`,
                    }
                  : {
                      left: `${trendPosition(record, measure.records)}%`,
                      top: "8px",
                    }
              }
              aria-label={`${formatDate(record.date)}. ${
                completedScore
                  ? `Score ${record.value}. ${statusLabel(record.status)}`
                  : statusLabel(record.status)
              }. Show record details.`}
              aria-pressed={isSelected}
              title={`${formatDate(record.date)} · ${
                completedScore ? `score ${record.value}` : statusLabel(record.status)
              }`}
              onFocus={() => onSelect(record)}
              onClick={() => onSelect(record)}
            >
              {completedScore ? <span aria-hidden="true" /> : "!"}
            </button>
          );
        })}
      </div>
      <div className="outcome-trend-axis" aria-hidden="true">
        {measure.records.map((record) => (
          <time
            key={record.id}
            dateTime={record.date}
            style={{ left: `${trendPosition(record, measure.records)}%` }}
          >
            {formatDate(record.date)}
          </time>
        ))}
      </div>
      <p className="outcome-trend-text">Recorded scores: {textSummary}.</p>
      {measure.severityBands?.length ? (
        <ul className="outcome-band-key" aria-label="Illustrative score bands">
          {measure.severityBands.map((band) => (
            <li key={band.label}>
              <i className={`outcome-band-${band.tone}`} aria-hidden="true" />
              {band.label} ({band.from}–{band.to})
            </li>
          ))}
        </ul>
      ) : (
        <p className="outcome-band-unavailable">
          Severity bands are not configured for this measure.
        </p>
      )}
    </section>
  );
}

function OutcomeRecordDetail({ measure, record, onOpenAssessment }) {
  if (!record) return null;
  const completedScore = isCompletedScore(record);
  return (
    <section className="outcome-record-detail" aria-live="polite">
      <div className="outcome-record-detail-heading">
        <div>
          <span>Selected assessment</span>
          <h4>{formatDate(record.date)}</h4>
        </div>
        <strong>{completedScore ? `Score ${record.value}` : "Score unavailable"}</strong>
      </div>
      <dl>
        <div>
          <dt>Completion</dt>
          <dd>{statusLabel(record.status)}</dd>
        </div>
        <div>
          <dt>Category</dt>
          <dd>{record.category || "Not configured"}</dd>
        </div>
        <div>
          <dt>Context</dt>
          <dd>{record.context || "Not recorded"}</dd>
        </div>
        <div>
          <dt>Recorded by</dt>
          <dd>{record.recordedBy || "Not recorded"}</dd>
        </div>
        {record.dueState && (
          <div>
            <dt>Follow-up</dt>
            <dd className={record.dueState === "Overdue" ? "status-overdue-text" : undefined}>
              {record.dueState}
              {record.dueDate ? ` · due ${formatDate(record.dueDate)}` : ""}
            </dd>
          </div>
        )}
        <div className="outcome-record-note">
          <dt>Associated note</dt>
          <dd>{record.notes || "No associated note recorded."}</dd>
        </div>
      </dl>
      {(record.sourceCollectionId || record.sourceClinicalRecordId) && (
        <button
          type="button"
          className="outcome-source-link"
          onClick={() => onOpenAssessment(record)}
        >
          {record.sourceClinicalRecordId ? "Open care record" : "Open assessment record"}
          <ExternalLink size={15} aria-hidden="true" />
        </button>
      )}
      {!measure.recordable && (
        <p className="outcome-governance-status">
          {measure.status}. Its version, scoring method and interpretation are
          not configured in this prototype.
        </p>
      )}
    </section>
  );
}

function OutcomeMeasureCard({
  measure,
  expanded,
  selectedRecord,
  onToggle,
  onSelectRecord,
  onOpenAssessment,
  showHeading = true,
}) {
  const completed = isCompletedScore(measure.latest);
  const ChangeIcon = directionIcon(measure.change?.direction);
  const scoreChange = scoreChangeLabel(measure.scoreChange);

  return (
    <li>
      <details
        className={`outcome-measure-card${expanded ? " open" : ""}${
          measure.needsFollowUp ? " needs-follow-up" : ""
        }`}
        open={expanded}
        onToggle={(event) => onToggle(event.currentTarget.open)}
      >
        <summary>
          {showHeading && (
            <div className="outcome-card-heading">
              <strong>{measure.displayName}</strong>
              <span>{measure.version}</span>
            </div>
          )}
          <div className="outcome-card-score">
            <span>{completed ? measure.latestScore : "—"}</span>
            <small>{completed ? "Latest score" : "No completed score"}</small>
          </div>
          <div className="outcome-card-category">
            <span>{measure.latest.category || "Category not configured"}</span>
            <time dateTime={measure.latest.date}>{formatDate(measure.latest.date)}</time>
          </div>
          <div className="outcome-card-footer">
            <span className={`outcome-status${completed ? " complete" : " incomplete"}`}>
              {completed ? (
                <CheckCircle2 size={15} aria-hidden="true" />
              ) : (
                <CircleAlert size={15} aria-hidden="true" />
              )}
              {statusLabel(measure.latest.status)}
            </span>
            <ChevronDown className="outcome-card-chevron" size={18} aria-hidden="true" />
          </div>
          <div className={`outcome-card-change${measure.needsFollowUp && measure.latest.dueState === "Overdue" ? " status-overdue-text" : ""}`}>
            {measure.needsFollowUp ? (
              <>
                <Clock3 size={15} aria-hidden="true" />
                <span>
                  {measure.latest.dueState === "Overdue"
                    ? "Overdue · follow-up required"
                    : "Follow-up required"}
                </span>
              </>
            ) : (
              <>
                <ChangeIcon size={15} aria-hidden="true" />
                <span>{measure.change?.label || "No change interpretation recorded"}</span>
                {scoreChange && <small>{scoreChange} since previous assessment</small>}
              </>
            )}
          </div>
          {measure.change?.clinicallySignificant && (
            <span className="outcome-significant-change">
              Clinically significant change recorded
            </span>
          )}
        </summary>
        <div className="outcome-card-detail" id={`outcome-detail-${measure.key}`}>
          <OutcomeTrend
            measure={measure}
            selectedRecord={selectedRecord}
            onSelect={onSelectRecord}
          />
          <section className="outcome-history" aria-labelledby={`outcome-history-${measure.key}`}>
            <h4 id={`outcome-history-${measure.key}`}>Assessment history</h4>
            <ol>
              {measure.records.map((record) => {
                const selected = selectedRecord?.id === record.id;
                return (
                  <li key={record.id}>
                    <button
                      type="button"
                      className={selected ? "selected" : ""}
                      aria-pressed={selected}
                      onClick={() => onSelectRecord(record)}
                    >
                      <time dateTime={record.date}>{formatDate(record.date)}</time>
                      <strong>
                        {isCompletedScore(record)
                          ? `Score ${record.value}`
                          : "Score unavailable"}
                      </strong>
                      <span>{statusLabel(record.status)}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
          <OutcomeRecordDetail
            measure={measure}
            record={selectedRecord}
            onOpenAssessment={onOpenAssessment}
          />
        </div>
      </details>
    </li>
  );
}

function OutcomeComparison({ measures }) {
  const [selectedKeys, setSelectedKeys] = useState(
    measures.slice(0, 2).map((measure) => measure.key),
  );
  const selectedMeasures = measures.filter((measure) =>
    selectedKeys.includes(measure.key),
  );
  const dates = [...new Set(selectedMeasures.flatMap((measure) =>
    measure.records.map((record) => record.date),
  ))].sort();
  const updateSelection = (key, checked) => {
    setSelectedKeys((current) => {
      if (!checked) return current.filter((item) => item !== key);
      return current.length < 3 ? [...current, key] : current;
    });
  };

  return (
    <div className="outcome-comparison-modal">
      <div className="outcome-comparison-selection">
        <fieldset>
          <legend>Measures to compare</legend>
          <p className="outcome-comparison-count" aria-live="polite">
            {selectedKeys.length} of 3 selected
          </p>
          <div className="outcome-comparison-options">
            {measures.map((measure) => {
              const checked = selectedKeys.includes(measure.key);
              return (
                <label key={measure.key}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && selectedKeys.length >= 3}
                    onChange={(event) => updateSelection(measure.key, event.target.checked)}
                  />
                  <span>{measure.displayName}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>
      <div className="outcome-comparison-results">
        <p>
          Native scales stay separate, so this table does not imply that values
          can be combined or ranked.
        </p>
        {selectedMeasures.length ? (
          <div className="outcome-comparison-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Assessment date</th>
                  {selectedMeasures.map((measure) => (
                    <th key={measure.key} scope="col">{measure.displayName}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dates.map((date) => (
                  <tr key={date}>
                    <th scope="row"><time dateTime={date}>{formatDate(date)}</time></th>
                    {selectedMeasures.map((measure) => {
                      const record = measure.records.find((item) => item.date === date);
                      return (
                        <td key={measure.key} data-label={measure.displayName}>
                          {record ? (
                            isCompletedScore(record) ? (
                              <span className="outcome-comparison-score">
                                <strong>{record.value}</strong>
                              </span>
                            ) : statusLabel(record.status)
                          ) : <span className="outcome-comparison-unrecorded">Not recorded</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="outcome-comparison-empty">Select a measure to compare.</p>
        )}
      </div>
    </div>
  );
}

function ReportDatedScorePlot({ measure, completed, minimum, maximum, compact = false }) {
  const firstDate = Date.parse(completed[0].date);
  const lastDate = Date.parse(completed.at(-1).date);
  const plotted = completed.map((record) => ({
    x: lastDate === firstDate ? 300 : 28 + ((Date.parse(record.date) - firstDate) / (lastDate - firstDate)) * 544,
    y: 132 - Math.max(0, Math.min(1, (Number(record.value) - minimum) / Math.max(maximum - minimum, 1))) * 104,
  }));
  return <>
    <div className={`report-featured-chart${compact ? " report-featured-chart-compact" : ""}`}>
      <svg className="report-featured-sparkline" viewBox="0 0 600 150" preserveAspectRatio="none" role="img"
        aria-label={`${measure.displayName} recorded scores: ${completed.map((record) => `${formatDate(record.date)} ${record.value}`).join(", ")}`}>
        <line x1="28" x2="572" y1="132" y2="132" />
        {lastDate > firstDate && plotted.length > 1 && <>
          <polygon points={`28,132 ${plotted.map(({ x, y }) => `${x},${y}`).join(" ")} 572,132`} />
          <polyline points={plotted.map(({ x, y }) => `${x},${y}`).join(" ")} />
        </>}
      </svg>
      {plotted.map(({ x, y }, index) => (
        <button key={completed[index].id} type="button" className="report-featured-point"
          data-edge={pointEdge((x / 600) * 100)}
          style={{ left: `${(x / 600) * 100}%`, top: `${(y / 150) * 100}%` }}
          aria-label={`${measure.displayName}, ${formatDate(completed[index].date)}, score ${completed[index].value}`}>
          <span className="report-chart-tooltip" aria-hidden="true">{formatDate(completed[index].date)} · score {completed[index].value}</span>
        </button>
      ))}
    </div>
    <div className="report-featured-axis" aria-hidden="true">
      <span>{formatDate(completed[0].date)}</span>
      {completed.length > 1 && <span>{formatDate(completed.at(-1).date)}</span>}
    </div>
  </>;
}

function OutcomeMeasurePanel({ measure, onShowResponses }) {
  const completed = measure.records.filter(isCompletedScore)
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = completed.at(-1);
  const [minimum, maximum] = measure.scoreRange || [0, 100];
  const hasSourceRecords = measure.recordable && measure.records.some((record) => record.sourceCollectionId || record.sourceClinicalRecordId);

  return (
    <ChartCard
      title={measure.displayName}
      description={
        completed.length
          ? `Recorded scores on a ${minimum}–${maximum} scale.`
          : "No completed scores are available to plot."
      }
      className="record-two-measure-panel"
      reportingType={measure.key === "iar-dst" ? "unconfigured" : ["sidas", "who-5"].includes(measure.key) ? "aftercare" : "outcome"}
    >
      {latest ? (
        <>
          <div className="report-measure-latest">
            <strong>{latest.value}<small> / {maximum}</small></strong>
            <span>Latest · {formatDate(latest.date)}</span>
          </div>
          <ReportDatedScorePlot measure={measure} completed={completed} minimum={minimum} maximum={maximum} compact />
          <p className="record-two-line-summary sr-only">
            {completed
              .map((record) => `${formatDate(record.date)} · ${record.value}`)
              .join(" · ")}
          </p>
        </>
      ) : (
        <p className="record-two-line-empty">
          No completed score is recorded for this measure.
        </p>
      )}
      <div className="report-featured-footer">
        <span>{completed.length} dated {completed.length === 1 ? "score" : "scores"}</span>
        {hasSourceRecords && <button type="button" className="outcome-source-link" onClick={() => onShowResponses(measure.key)}>
          Source records <ArrowRight size={15} aria-hidden="true" />
        </button>}
      </div>
    </ChartCard>
  );
}

function outcomeMeasuresFor(episode) {
  const cards = outcomeMeasureCards(
    GOVERNED_MEASURES,
    episodeOutcomeRecords(episode),
  );
  const measures = REPORT_OUTCOME_KEYS.flatMap((key) => {
    const measure = cards.find((item) => item.key === key);
    return measure ? [measure] : [];
  });
  return measures;
}

function OutcomeMeasureCards({ episode, onShowResponses }) {
  const measures = outcomeMeasuresFor(episode);
  const cardMeasures = measures.filter((measure) =>
    OUTCOME_CARD_KEYS.includes(measure.key) && measure.records.some(isCompletedScore),
  );
  const unscoredMeasures = measures.filter((measure) =>
    OUTCOME_CARD_KEYS.includes(measure.key) && !measure.records.some(isCompletedScore),
  );
  if (!cardMeasures.length && !unscoredMeasures.length) return null;

  return (
    <>
      {cardMeasures.map((measure) => (
        <OutcomeMeasurePanel
            key={measure.key}
            measure={measure}
            onShowResponses={onShowResponses}
          />
      ))}
      {unscoredMeasures.length > 0 && (
        <p className="report-unscored-measures">
          <strong>Awaiting completed scores</strong>
          <span>{unscoredMeasures.map((measure) => measure.displayName).join(" · ")}</span>
        </p>
      )}
    </>
  );
}

function OutcomeScoreSummary({ episode, onShowResponses }) {
  const measures = outcomeMeasuresFor(episode).filter((measure) =>
    ["k10-plus", "k5"].includes(measure.key),
  );
  const [selectedKey, setSelectedKey] = useState(() =>
    measures.find((measure) => measure.records.some(isCompletedScore))?.key || measures[0]?.key,
  );
  if (!measures.length) return null;
  const selected = measures.find((measure) => measure.key === selectedKey) || measures[0];
  const completed = selected.records.filter(isCompletedScore)
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = completed.at(-1);
  const [minimum, maximum] = selected.scoreRange || [0, 100];
  const hasSourceRecords = selected.records.some((record) => record.sourceCollectionId || record.sourceClinicalRecordId);
  return (
    <ChartCard
      title="Recorded scores"
      description="Select a measure to inspect its dated results."
      className="record-two-measure-panel report-featured-measures"
      reportingType="outcome"
    >
      <div className="report-score-picker" role="group" aria-label="Choose an outcome measure">
        {measures.map((measure) => {
          const measureLatest = measure.records.filter(isCompletedScore)
            .sort((a, b) => a.date.localeCompare(b.date)).at(-1);
          return <button key={measure.key} type="button" aria-pressed={selected.key === measure.key}
            onClick={() => setSelectedKey(measure.key)}>
            <span>{measure.displayName}</span>
            <strong>{measureLatest ? `${measureLatest.value} / ${measure.scoreRange?.[1] ?? 100}` : "No score"}</strong>
          </button>;
        })}
      </div>
      {latest ? <>
        <div className="report-featured-chart-heading">
          <div><span>Latest recorded</span><strong>{latest.value}<small> / {maximum}</small></strong></div>
          <span>{formatDate(latest.date)}<small>Scale {minimum}–{maximum}</small></span>
        </div>
        <ReportDatedScorePlot measure={selected} completed={completed} minimum={minimum} maximum={maximum} />
      </> : <p className="report-featured-no-score">No completed {selected.displayName} score is recorded for this episode.</p>}
      <div className="report-featured-footer">
        <span>{completed.length} dated {completed.length === 1 ? "score" : "scores"}</span>
        {hasSourceRecords && <button type="button" className="outcome-source-link" onClick={() => onShowResponses(selected.key)}>
          Source records <ArrowRight size={15} aria-hidden="true" />
        </button>}
      </div>
    </ChartCard>
  );
}

function ReportSectionHeading({ id, title, description }) {
  return <div className="report-section-heading">
    <div><h3 id={id}>{title}</h3><p>{description}</p></div>
  </div>;
}

function ResponseListModal({ measure, onClose, onOpenAssessment }) {
  return (
    <Modal
      title={`${measure.displayName} source records`}
      subtitle="Select a dated result to open its source record."
      onClose={onClose}
    >
      <ol className="outcome-response-list">
        {measure.records.map((record) => (
          <li key={record.id}>
            <span>
              <strong>{formatDate(record.date)}</strong>
              <small>{isCompletedScore(record) ? `Score ${record.value}` : record.status}</small>
            </span>
            {record.sourceCollectionId || record.sourceClinicalRecordId ? (
              <button
                type="button"
                className="outcome-source-link"
                onClick={() => onOpenAssessment(record)}
              >
                {record.sourceClinicalRecordId ? "Open care record" : "Open response"}
                <ExternalLink size={15} aria-hidden="true" />
              </button>
            ) : (
              <span className="muted">No linked source</span>
            )}
          </li>
        ))}
      </ol>
    </Modal>
  );
}

function CompareMeasuresModal({ episode, onClose }) {
  const measures = outcomeMeasuresFor(episode);
  return (
    <Modal
      title="Compare measures"
      subtitle="Compare up to three outcome measures by recorded assessment date."
      onClose={onClose}
      wide
      className="compare-measures-dialog"
    >
      <OutcomeComparison measures={measures} />
      <p className="outcome-measures-caveat">
        Fictional prototype fixture only. Score categories, severity bands and
        clinically significant-change flags are illustrative display data, not
        approved thresholds, clinical interpretation or treatment-effect claims.
      </p>
    </Modal>
  );
}

function Risk() {
  const rows = [
    ["Self-harm", ["Moderate", "Low", "Low"]],
    ["Housing", ["Low", "Moderate", "Low"]],
    ["Safeguarding", ["Low", "Low", "None"]],
  ];
  return (
    <ChartCard
      title="Risk history"
      description="Ordered risk states show direction of change, not mathematical precision."
      showReportingIndicator={false}
    >
      <div className="record-two-risk">
        <div className="record-two-risk-months" aria-hidden="true">
          <span />
          <span>0m</span>
          <span>9m</span>
          <span>18m</span>
        </div>
        {rows.map(([label, states]) => (
          <div className="record-two-risk-row" key={label}>
            <strong>{label}</strong>
            {states.map((state, index) => (
              <span
                key={`${state}-${index}`}
                className={state.toLowerCase()}
                role="img"
                aria-label={`Month ${index * 9}: ${state}`}
              >
                {state}
              </span>
            ))}
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

export default function RecordTwo({ person, episode, navigate }) {
  const { state } = useStore();
  const simpleAssessments = !!state.settings?.simpleAssessments;
  const scheduleAssessments = assessmentSchedulingEnabled(state.settings);
  const linkAssessmentAppointments = assessmentContactLinkingEnabled(state.settings);
  const assessmentSms = assessmentSmsEnabled(state.settings);
  const isFixture = Boolean(person.fixtureLabel) &&
    person.fixtureLabel !== "Fictional closed episode with patient follow-up";
  const hasOutcomeMeasures = episodeOutcomeRecords(episode).some(
    (measure) => measure.records?.length,
  );
  const isEmptyReport = !isFixture && !hasOutcomeMeasures && !hasCareTimelineEntries(episode, { simpleAssessments, scheduleAssessments, assessmentSms });
  const scoredMeasures = outcomeMeasuresFor(episode).filter((measure) => measure.records.some(isCompletedScore));
  const latestScoredRecord = scoredMeasures.flatMap((measure) => measure.records.filter(isCompletedScore))
    .sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  const nextAssessment = currentCollection(episode);
  const nextAssessmentStatus = nextAssessment
    ? !scheduleAssessments
      ? nextAssessment.response === "Submitted" ? "Completed" : nextAssessment.response === "Draft" ? "Draft" : "Created"
      : collectionStatus(nextAssessment)
    : null;
  const openAssessment = () => {
    const params = new URLSearchParams({ tab: "assessment", episode: episode.id });
    if (nextAssessment?.id) params.set("collection", nextAssessment.id);
    navigate(`/people/${person.id}?${params}`, { scroll: false });
  };
  const [careTimelineVisible, setCareTimelineVisible] = useState(true);
  const [compareMeasuresOpen, setCompareMeasuresOpen] = useState(false);
  const [responseListKey, setResponseListKey] = useState(null);
  const responseListMeasure = outcomeMeasuresFor(episode).find(
    (measure) => measure.key === responseListKey,
  );
  const openMeasureSource = (record) => {
    if (!record.sourceCollectionId && !record.sourceClinicalRecordId) return;
    setResponseListKey(null);
    const params = new URLSearchParams({
      tab: record.sourceClinicalRecordId ? "events" : "assessment",
      episode: episode.id,
    });
    if (record.sourceClinicalRecordId) params.set("event", record.sourceClinicalRecordId);
    else params.set("collection", record.sourceCollectionId);
    navigate(`/people/${person.id}?${params}`, { scroll: false });
  };
  return (
    <div className="stack record-two">
      <div className="section-toolbar">
        <div>
          <h2>Report</h2>
          <p>Dated measures and care activity from this care episode.</p>
        </div>
        {hasOutcomeMeasures && (
          <Button variant="secondary" onClick={() => setCompareMeasuresOpen(true)}>
            Compare measures
          </Button>
        )}
      </div>
      {isEmptyReport ? (
        <section className="report-empty-state" aria-labelledby="report-empty-title">
          <div className="report-empty-main">
            <span className="report-empty-icon" aria-hidden="true"><ChartNoAxesCombined size={28} /></span>
            <span className="report-empty-kicker">Report status</span>
            <h3 id="report-empty-title">Waiting for recorded evidence</h3>
            <p>
              This care episode has no completed evidence to display in the report yet.
              Dated care activity and supported outcome measures will appear here when
              those records are available.
            </p>
            <div className="report-empty-sections" aria-label="Report sections awaiting evidence">
              <span>Care timeline <strong>No reportable activity yet</strong></span>
              <span>Outcome measures <strong>Awaiting completed scores</strong></span>
            </div>
          </div>
          <Panel
            title="Next step"
            className="report-empty-next"
            action={nextAssessmentStatus && (
              <Badge tone={nextAssessmentStatus === "Overdue" ? "coral" : "neutral"}>
                {nextAssessmentStatus}
              </Badge>
            )}
          >
            <div className="panel-body">
              <h3>{nextAssessment?.label || "Initial assessment"}</h3>
              {scheduleAssessments && nextAssessment?.due && <p>Due {formatDate(nextAssessment.due)}</p>}
              <div className="actions">
                <Button variant="primary" onClick={openAssessment}>Open assessment</Button>
                <TextLink
                  onClick={() => navigate(`/people/${person.id}?tab=events&episode=${encodeURIComponent(episode.id)}`, { scroll: false })}
                >
                  View care events
                </TextLink>
              </div>
            </div>
          </Panel>
        </section>
      ) : <div className="report-dashboard">
        <nav className="report-overview-links" aria-label="Report sections">
          <a href="#report-outcomes">Outcome measures</a>
          <a href="#report-activity">Care activity</a>
          {isFixture && <a href="#report-sample-charts">Illustrative charts</a>}
        </nav>
        <section className="report-dashboard-section" id="report-outcomes" aria-labelledby="report-outcomes-heading">
          <ReportSectionHeading id="report-outcomes-heading"
            title="Outcome measures" description="Completed, dated scores retain each measure's own scale." />
          {!hasOutcomeMeasures ? (
            <div className="record-two-empty record-two-empty-wide">
              <strong>Outcome measures are not available yet</strong>
              <p>Completed, dated scores will appear when they are recorded for this care episode.</p>
              <Button variant="secondary" onClick={openAssessment}>View assessment</Button>
            </div>
          ) : (
            <>
              <div className="report-primary-grid">
                <OutcomeScoreSummary episode={episode} onShowResponses={setResponseListKey} />
                <div className="report-scope-card">
                  <h4>About this report</h4>
                  <dl>
                    <div><dt>Care episode</dt><dd>{formatDate(episode.start)} – {episode.end ? formatDate(episode.end) : "present"}</dd></div>
                    <div><dt>Evidence</dt><dd>Recorded assessments and care records</dd></div>
                    <div><dt>Scored measures</dt><dd>{scoredMeasures.length}</dd></div>
                    {latestScoredRecord && <div><dt>Latest result</dt><dd>{formatDate(latestScoredRecord.date)}</dd></div>}
                  </dl>
                  <p>Charts show dated records. They do not establish the cause of a change or provide a clinical interpretation.</p>
                </div>
              </div>
              <div className="record-two-grid report-measure-grid">
                <OutcomeMeasureCards episode={episode} onShowResponses={setResponseListKey} />
              </div>
            </>
          )}
        </section>
        <section className="report-dashboard-section" id="report-activity" aria-labelledby="report-activity-heading">
          <ReportSectionHeading id="report-activity-heading"
            title="Care activity" description="Contacts, care context and dated events across this episode." />
          <div className="record-two-grid">
            <CareTimeline
              person={person}
              episode={episode}
              navigate={navigate}
              simpleAssessments={simpleAssessments}
              scheduleAssessments={scheduleAssessments}
              linkAssessmentAppointments={linkAssessmentAppointments}
              assessmentSms={assessmentSms}
              isVisible={careTimelineVisible}
              onToggle={() => setCareTimelineVisible((visible) => !visible)}
            />
          </div>
        </section>
        {isFixture && <section className="report-dashboard-section" id="report-sample-charts" aria-labelledby="report-sample-heading">
          <ReportSectionHeading id="report-sample-heading"
            title="Illustrative charts" description="Sample patterns for exploring report layouts; values are not linked to source records." />
          <details className="report-sample-details">
            <summary>Show sample charts <ChevronDown size={18} aria-hidden="true" /></summary>
            <div className="record-two-grid">
              <Symptoms />
              <Periods />
              <Goals />
              <LineChart />
              <Risk />
              <Periods medication />
            </div>
          </details>
        </section>}
      </div>}
      {compareMeasuresOpen && (
        <CompareMeasuresModal
          episode={episode}
          onClose={() => setCompareMeasuresOpen(false)}
        />
      )}
      {responseListMeasure && (
        <ResponseListModal
          measure={responseListMeasure}
          onClose={() => setResponseListKey(null)}
          onOpenAssessment={openMeasureSource}
        />
      )}
    </div>
  );
}
