import { formatDate } from "../model";
import { careTimelineData, timelinePosition } from "../careTimeline";

function TimelineTrack({
  entries,
  start,
  end,
  emptyText,
  variant = "timeline",
  compact = false,
}) {
  if (!entries.length) return <p className="care-context-empty">{emptyText}</p>;

  return (
    <div className="care-context-track-wrap">
      <div className={`care-context-track care-context-track-${variant}`}>
        {entries.map((entry) => {
          const left = timelinePosition(entry.date, start, end);
          const width = entry.end
            ? Math.max(1, timelinePosition(entry.end, start, end) - left)
            : null;
          const label = `${formatDate(entry.date)} · ${entry.label}. ${entry.detail}.`;
          return entry.end ? (
            <span
              aria-label={label}
              className="care-context-duration"
              key={entry.id}
              style={{ left: `${left}%`, width: `${width}%` }}
            />
          ) : (
            <span
              aria-label={label}
              className={`care-context-marker care-context-marker-${entry.kind}`}
              key={entry.id}
              style={{ left: `${left}%` }}
            />
          );
        })}
      </div>
      {!compact && (
        <ul className="care-context-records">
          {entries.map((entry) => (
            <li key={`${entry.id}-record`}>
              <time dateTime={entry.date}>{formatDate(entry.date)}</time>
              <span>{entry.label}</span>
              <small>{entry.detail}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ContextDetails({ riskRows, goals, start, end }) {
  return (
    <div className="care-context-secondary">
      {riskRows.some((row) => row.entries.length > 0) && (
        <section className="care-context-card">
          <header>
            <div>
              <h3>Risk and status history</h3>
              <p>
                Recorded event dates by category. No recorded event is not a
                finding of no concern.
              </p>
            </div>
          </header>
          <div className="care-context-risk-rows">
            {riskRows.map((row) => (
              <section className="care-context-risk-row" key={row.id}>
                <h4>{row.label}</h4>
                <TimelineTrack
                  entries={row.entries}
                  start={start}
                  end={end}
                  emptyText="Not recorded"
                  variant="risk"
                />
              </section>
            ))}
          </div>
        </section>
      )}
      {goals.length > 0 && (
        <section className="care-context-card">
          <header>
            <div>
              <h3>Goals and functioning</h3>
              <p>
                Dated structured milestones only; this is not a continuous score.
              </p>
            </div>
          </header>
          <ol className="care-context-goals">
            {goals.map((goal) => (
              <li key={goal.id}>
                <time dateTime={goal.date}>{formatDate(goal.date)}</time>
                <div>
                  <strong>{goal.label}</strong>
                  <span>{goal.detail}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

export default function CareContextVisuals({ episode }) {
  const { start, end, riskRows, goals } = careTimelineData(episode);
  const hasContextDetails = riskRows.some((row) => row.entries.length > 0) || goals.length > 0;
  if (!hasContextDetails) return null;

  return (
    <section className="care-context-visuals" aria-label="Care coordination context">
      <ContextDetails riskRows={riskRows} goals={goals} start={start} end={end} />
    </section>
  );
}
