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
import { REPORT_FIELDS } from "../report";
import {
  isCompletedScore,
  outcomeMeasureCards,
  scoreChangeLabel,
} from "../outcomeMeasures";

const months = [0, 3, 6, 9, 12, 15, 18];
const axis = ({ fullWidth = false } = {}) => (
  <div
    className={`record-two-axis${fullWidth ? " record-two-axis-full" : ""}`}
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

function ChartCard({
  title,
  description,
  children,
  className = "",
  isVisible = true,
  onToggle,
  reportingType = "context",
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
          <ReportingIndicator type={reportingType} />
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
                  key={`${month}-${value}`}
                  aria-label={`${label}, month ${month}, severity ${value}`}
                  className="record-two-dot"
                  style={{
                    left: `${(month / 18) * 100}%`,
                    bottom: `${value}%`,
                  }}
                  onClick={() =>
                    setSelected(`${label} · month ${month} · severity ${value}`)
                  }
                />
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
    >
      <div className="record-two-periods">
        {rows.map(([label, start, end], index) => (
          <div className="record-two-period-row" key={label}>
            <strong>{label}</strong>
            <div className="record-two-period-track">
              <span
                className={medication ? "medication" : ""}
                style={{
                  left: `${(start / 18) * 100}%`,
                  width: `${((end - start) / 18) * 100}%`,
                }}
              />
              {medication && index > 0 && (
                <span
                  className="record-two-period-marker"
                  style={{ left: `${((start + 1) / 18) * 100}%` }}
                  role="img"
                  aria-label={`Dose change, month ${start + 1}`}
                  title="Dose change"
                />
              )}
            </div>
          </div>
        ))}
      </div>
      {axis()}
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
    >
      <ol className="record-two-goals">
        {goals.map(([label, value, state]) => (
          <li key={label}>
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
    "var(--teal)",
    [[0, 22], [3, 31], [6, 39], [9, 55], [12, 70], [15, 74], [18, 78]],
  ]];
  return (
    <ChartCard
      title="Activity rating over time"
      description="The line shows the trajectory between recorded activity assessments."
    >
      <div className="record-two-line-wrap">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label="Activity rating trajectory"
        >
          {[25, 50, 75].map((y) => (
            <line key={y} x1="0" x2="100" y1={y} y2={y} />
          ))}
          {lines.map(([label, colour, values]) => (
            <g key={label}>
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
            <span
              key={`${label}-${month}`}
              className="record-two-line-point"
              style={{
                left: `${(month / 18) * 100}%`,
                bottom: `${value}%`,
                "--record-two-line-colour": colour,
              }}
              role="img"
              aria-label={`${label}, month ${month}, value ${value}`}
            />
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
          <polyline points={pointList} />
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
            <dd>
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
      {record.sourceCollectionId && (
        <button
          type="button"
          className="outcome-source-link"
          onClick={() => onOpenAssessment(record)}
        >
          Open assessment record
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
          <div className="outcome-card-change">
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

function OutcomeComparison({ measures, inModal = false }) {
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
    <details
      className={`outcome-comparison${inModal ? " outcome-comparison-modal" : ""}`}
      open={inModal}
    >
      <summary>
        <span>
          <strong>Compare measures</strong>
          <small>Across this care episode</small>
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <div>
        <p>
          Compare up to three measures by date. Native scales stay separate, so
          this table does not imply that values can be combined or ranked.
        </p>
        <fieldset>
          <legend>Measures to compare</legend>
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
                {measure.displayName}
              </label>
            );
          })}
        </fieldset>
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
                    <th scope="row">
                      <time dateTime={date}>{formatDate(date)}</time>
                    </th>
                    {selectedMeasures.map((measure) => {
                      const record = measure.records.find((item) => item.date === date);
                      return (
                        <td key={measure.key}>
                          {record
                            ? isCompletedScore(record)
                              ? `Score ${record.value} · ${statusLabel(record.status)}`
                              : statusLabel(record.status)
                            : "Not recorded"}
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
    </details>
  );
}

function OutcomeMeasurePanel({ measure, onShowResponses }) {
  const completed = measure.records.filter(isCompletedScore);
  const [minimum, maximum] = measure.scoreRange || [0, 100];
  const span = Math.max(maximum - minimum, 1);
  const valuePosition = (value) =>
    Math.max(0, Math.min(100, ((Number(value) - minimum) / span) * 100));
  const points = completed.map((record) => [
    (trendPosition(record, completed) * 18) / 100,
    valuePosition(record.value),
    record,
  ]);
  const description = completed.length
    ? `${measure.displayName} scores from ${formatDate(completed[0].date)} to ${formatDate(completed.at(-1).date)}.`
    : `No completed ${measure.displayName} scores are recorded.`;

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
      {points.length ? (
        <>
          <div className="record-two-line-wrap">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              role="img"
              aria-label={description}
            >
              {[25, 50, 75].map((y) => (
                <line key={y} x1="0" x2="100" y1={y} y2={y} />
              ))}
              <polyline
                points={points
                  .map(([month, value]) => point(month, value))
                  .join(" ")}
                stroke="var(--teal)"
              />
            </svg>
            {points.map(([month, value, record]) => (
              <span
                key={record.id}
                className="record-two-line-point"
                style={{
                  left: `${(month / 18) * 100}%`,
                  bottom: `${value}%`,
                  "--record-two-line-colour": "var(--teal)",
                }}
                role="img"
                aria-label={`${measure.displayName}, ${formatDate(record.date)}, score ${record.value}`}
              />
            ))}
          </div>
          <div className="record-two-axis record-two-axis-full" aria-hidden="true">
            {completed.filter((_, index) => index === 0 || index === completed.length - 1).map((record) => (
              <span key={record.id} style={{ left: `${trendPosition(record, completed)}%` }}>
                {formatDate(record.date)}
              </span>
            ))}
          </div>
          <p className="record-two-line-summary">
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
      {measure.recordable && measure.records.some((record) => record.sourceCollectionId) && (
        <button
          type="button"
          className="outcome-source-link"
          onClick={() => onShowResponses(measure.key)}
        >
          Response list
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      )}
    </ChartCard>
  );
}

function outcomeMeasuresFor(episode) {
  const cards = outcomeMeasureCards(
    GOVERNED_MEASURES,
    episode.reportOutcomeMeasures,
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
    OUTCOME_CARD_KEYS.includes(measure.key),
  );
  if (!cardMeasures.length) return null;

  return (
    <>
      {cardMeasures.map((measure) => (
        <OutcomeMeasurePanel
            key={measure.key}
            measure={measure}
            onShowResponses={onShowResponses}
          />
      ))}
    </>
  );
}

function OutcomeScoreSummary({ episode, onShowResponses }) {
  const measures = outcomeMeasuresFor(episode).filter((measure) =>
    ["k10-plus", "k5"].includes(measure.key),
  );
  if (!measures.length) return null;
  return (
    <ChartCard
      title="K10+ and K5 scores"
      description="Dated raw scores from the linked sample responses. Each measure keeps its own scale."
      className="record-two-measure-panel"
      reportingType="outcome"
    >
      {measures.map((measure) => (
        <div key={measure.key} className="record-two-measure-sources">
          <strong>{measure.displayName} · {measure.scoreRange?.join("–")}</strong>
          <span className="record-two-line-summary">
            {measure.records.filter(isCompletedScore).map((record) =>
              `${formatDate(record.date)} · ${record.value}`,
            ).join(" · ")}
          </span>
          <button
            type="button"
            className="outcome-source-link"
            onClick={() => onShowResponses(measure.key)}
          >
            Response list
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      ))}
    </ChartCard>
  );
}

function ResponseListModal({ measure, onClose, onOpenAssessment }) {
  return (
    <Modal
      title={`${measure.displayName} responses`}
      subtitle="Select a dated response to open its assessment record."
      onClose={onClose}
    >
      <ol className="outcome-response-list">
        {measure.records.map((record) => (
          <li key={record.id}>
            <span>
              <strong>{formatDate(record.date)}</strong>
              <small>{isCompletedScore(record) ? `Score ${record.value}` : record.status}</small>
            </span>
            {record.sourceCollectionId ? (
              <button
                type="button"
                className="outcome-source-link"
                onClick={() => onOpenAssessment(record)}
              >
                Open response
                <ExternalLink size={15} aria-hidden="true" />
              </button>
            ) : (
              <span className="muted">No linked response</span>
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
      <OutcomeComparison measures={measures} inModal />
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
    >
      <div className="record-two-risk">
        {rows.map(([label, states]) => (
          <div className="record-two-risk-row" key={label}>
            <strong>{label}</strong>
            <div>
              {states.map((state, index) => (
                <span
                  key={`${state}-${index}`}
                  className={state.toLowerCase()}
                  style={{
                    left: `${(index / 2) * 100}%`,
                  }}
                  title={`${label}: ${state}`}
                >
                  {state}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {axis()}
    </ChartCard>
  );
}

export default function RecordTwo({ person, episode, navigate }) {
  const isFixture = Boolean(person.fixtureLabel) &&
    person.fixtureLabel !== "Fictional closed episode with patient follow-up";
  const hasOutcomeMeasures = episode.reportOutcomeMeasures?.some(
    (measure) => measure.records?.length,
  );
  const isEmptyReport = !isFixture && !hasOutcomeMeasures && !hasCareTimelineEntries(episode);
  const nextAssessment = currentCollection(episode);
  const nextAssessmentStatus = nextAssessment ? collectionStatus(nextAssessment) : null;
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
    if (!record.sourceCollectionId) return;
    setResponseListKey(null);
    const params = new URLSearchParams({
      tab: "assessment",
      episode: episode.id,
      collection: record.sourceCollectionId,
    });
    navigate(`/people/${person.id}?${params}`, { scroll: false });
  };
  return (
    <div className="stack record-two">
      <div className="section-toolbar">
        <div>
          <h2>Report</h2>
          <p>Longitudinal care record</p>
        </div>
        {hasOutcomeMeasures && (
          <Button variant="secondary" onClick={() => setCompareMeasuresOpen(true)}>
            Compare measures
          </Button>
        )}
      </div>
      {episode.progressReport && (
        <Panel title="Saved episode report">
          <div className="panel-body stack">
            <p className="muted">
              Recorded {formatDate(episode.progressReport.timestamp?.slice(0, 10))} by {episode.progressReport.actor || "Not recorded"} · {episode.progressReport.sources?.length || 0} submitted assessment sources. This saved version is view only.
            </p>
            <dl className="metadata">
              {REPORT_FIELDS.map(({ key, label }) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{episode.progressReport.content?.[key] || "Not recorded"}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Panel>
      )}
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
              {nextAssessment?.due && <p>Due {formatDate(nextAssessment.due)}</p>}
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
      ) : <div className="record-two-grid">
        {isFixture ? (
          <>
            <CareTimeline
              person={person}
              episode={episode}
              navigate={navigate}
              isVisible={careTimelineVisible}
              onToggle={() => setCareTimelineVisible((visible) => !visible)}
            />
            <Symptoms />
            <Periods />
            <Goals />
            <LineChart />
            <OutcomeScoreSummary episode={episode} onShowResponses={setResponseListKey} />
            <OutcomeMeasureCards episode={episode} onShowResponses={setResponseListKey} />
            <Risk />
            <Periods medication />
          </>
        ) : (
          <>
            <CareTimeline
              person={person}
              episode={episode}
              navigate={navigate}
              isVisible={careTimelineVisible}
              onToggle={() => setCareTimelineVisible((visible) => !visible)}
            />
            <OutcomeScoreSummary episode={episode} onShowResponses={setResponseListKey} />
            <OutcomeMeasureCards episode={episode} onShowResponses={setResponseListKey} />
            {!hasOutcomeMeasures && (
              <div className="record-two-empty record-two-empty-wide">
                <strong>Outcome measures are not available yet</strong>
                <p>Completed, dated scores will appear when they are recorded for this care episode.</p>
                <Button variant="secondary" onClick={openAssessment}>View assessment</Button>
              </div>
            )}
          </>
        )}
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
