import { useId } from "react";
import { ArrowRight } from "lucide-react";
import { formatDate } from "../model";
import { Badge } from "./UI";

const CHART_WIDTH = 520;
const CHART_HEIGHT = 180;
const CHART_INSET = 18;

function chartX(index, count) {
  if (count <= 1) return CHART_WIDTH / 2;
  return CHART_INSET + (index * (CHART_WIDTH - CHART_INSET * 2)) / (count - 1);
}

function chartY(value, count) {
  if (count <= 1) return CHART_HEIGHT / 2;
  return (
    CHART_INSET +
    ((count - value) * (CHART_HEIGHT - CHART_INSET * 2)) / (count - 1)
  );
}

function dateValue(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T12:00:00Z`);
  return Number.isNaN(time) ? null : time;
}

function eventX(eventDate, points) {
  const first = dateValue(points[0]?.date);
  const last = dateValue(points.at(-1)?.date);
  const event = dateValue(eventDate);
  if (first === null || last === null || event === null) return null;
  if (first === last) return chartX(0, points.length);
  const ratio = Math.max(0, Math.min(1, (event - first) / (last - first)));
  return CHART_INSET + ratio * (CHART_WIDTH - CHART_INSET * 2);
}

function lineSegments(points, scaleLength) {
  const segments = [];
  let segment = [];
  points.forEach((point, index) => {
    if (point.value === null) {
      if (segment.length) segments.push(segment);
      segment = [];
      return;
    }
    segment.push(
      `${chartX(index, points.length)},${chartY(point.value, scaleLength)}`,
    );
  });
  if (segment.length) segments.push(segment);
  return segments;
}

export default function LikertTrendCard({
  trend,
  events = [],
  comparisonPointId,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const options = trend.scale.options;
  const latest = trend.points.at(-1);
  const comparisonPoint = comparisonPointId
    ? trend.points.find((point) => point.id === comparisonPointId)
    : null;
  const change = trend.comparison?.change;
  const changeLabel =
    change === "Changed"
      ? "Changed"
      : change === "Unchanged"
        ? "Unchanged"
        : null;
  const eventMarkers = events
    .map((event) => ({
      ...event,
      date: event.eventDate || event.date,
      x: eventX(event.eventDate || event.date, trend.points),
    }))
    .filter((event) => event.x !== null);

  return (
    <article className="likert-trend-card">
      <header className="likert-card-header">
        <div>
          <span>{trend.section?.title || "Question"}</span>
          <h5 id={titleId}>{trend.question}</h5>
        </div>
        <div className="likert-card-status">
          {changeLabel && <Badge>{changeLabel}</Badge>}
          <span className="likert-response-count">
            {trend.points.length} responses
          </span>
        </div>
      </header>
      <div
        className={`likert-change-summary${
          comparisonPoint ? " has-comparison" : " selected-only"
        }`}
        aria-label="Selected answers"
      >
        {comparisonPoint && (
          <>
            <div className="likert-summary-comparison">
              <span>
                Compared response · {formatDate(comparisonPoint.date)}
              </span>
              <strong>{comparisonPoint.answer}</strong>
            </div>
            <ArrowRight size={18} aria-hidden="true" />
          </>
        )}
        <div className="likert-summary-selected">
          <span>Selected assessment · {formatDate(latest.date)}</span>
          <strong>{latest.answer}</strong>
        </div>
      </div>

      <figure aria-labelledby={titleId} aria-describedby={descriptionId}>
        <figcaption id={descriptionId}>
          {trend.scale.label}. Each point is one submitted response; positions
          show the authored ordinal choices, not a clinical score.
        </figcaption>
        <div className="likert-chart-shell">
          <div
            className="likert-axis"
            style={{ "--likert-scale-count": options.length }}
            aria-hidden="true"
          >
            {[...options].reverse().map((option, index) => (
              <span key={option} style={{ gridRow: index + 1 }}>
                {option}
              </span>
            ))}
          </div>
          <svg
            className="likert-line-chart"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {options.map((option, index) => {
              const value = options.length - index;
              return (
                <line
                  key={option}
                  className="likert-grid-line"
                  x1="0"
                  x2={CHART_WIDTH}
                  y1={chartY(value, options.length)}
                  y2={chartY(value, options.length)}
                />
              );
            })}
            {lineSegments(trend.points, options.length).map(
              (segment, index) => (
                <polyline
                  key={index}
                  className="likert-series-line"
                  points={segment.join(" ")}
                />
              ),
            )}
            {trend.points.map((point, index) =>
              point.value === null ? null : (
                <circle
                  key={point.id}
                  className={`likert-series-point${
                    point.id === latest.id
                      ? " selected-assessment"
                      : point.id === comparisonPoint?.id
                        ? " compared-assessment"
                        : ""
                  }`}
                  cx={chartX(index, trend.points.length)}
                  cy={chartY(point.value, options.length)}
                  r={
                    point.id === latest.id || point.id === comparisonPoint?.id
                      ? "7"
                      : "5"
                  }
                />
              ),
            )}
            {eventMarkers.map((event) => (
              <g key={event.id} className="likert-event-marker">
                <line
                  className="likert-event-guide"
                  x1={event.x}
                  x2={event.x}
                  y1={CHART_INSET}
                  y2={CHART_HEIGHT - CHART_INSET}
                />
                <circle
                  className="likert-event-point"
                  cx={event.x}
                  cy={CHART_INSET}
                  r="6"
                  aria-label={`${event.title || "Care event"} · ${formatDate(event.date)}`}
                >
                  <title>
                    {event.title || "Care event"} · {formatDate(event.date)}
                  </title>
                </circle>
              </g>
            ))}
          </svg>
        </div>
        <ol
          className="likert-point-values"
          style={{ "--likert-point-count": trend.points.length }}
        >
          {trend.points.map((point) => {
            const pointRole =
              point.id === latest.id
                ? "selected"
                : point.id === comparisonPoint?.id
                  ? "comparison"
                  : "";
            return (
              <li className={pointRole} key={point.id}>
                {pointRole && (
                  <small>
                    {pointRole === "selected" ? "Selected" : "Compared"}
                  </small>
                )}
                <time dateTime={point.date}>{formatDate(point.date)}</time>
                <strong>{point.answer}</strong>
              </li>
            );
          })}
        </ol>
      </figure>
    </article>
  );
}
