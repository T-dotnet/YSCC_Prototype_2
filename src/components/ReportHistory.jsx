import { reportChangeLog, REPORT_FIELDS } from "../report";
import { formatTimestamp } from "../model";

export default function ReportHistory({ episode }) {
  const entries = reportChangeLog(episode);
  return (
    <details className="report-disclosure" open>
      <summary>
        Report change log · {entries.length} saved{" "}
        {entries.length === 1 ? "version" : "versions"}
      </summary>
      <div className="report-history" aria-label="Report change log">
        {!entries.length && (
          <p className="muted">
            No saved changes yet. Saving records the report wording, editor and
            time.
          </p>
        )}
        {entries.map((entry, index) => (
          <details key={entry.revision}>
            <summary>
              Version {entry.revision}
              {index === 0 ? " · Current" : ""} · {entry.actor}
              {entry.role ? ` · ${entry.role}` : ""} ·{" "}
              {formatTimestamp(entry.timestamp)}
              <span className="report-change-summary">
                {entry.initial
                  ? "Initial report saved"
                  : entry.changes === null
                    ? "Previous wording unavailable"
                    : entry.changes.length
                      ? `Changed: ${entry.changes.map(({ label }) => label).join(", ")}`
                      : "Narrative unchanged"}
              </span>
            </summary>
            {entry.changes?.map((change) => (
              <section key={change.key} aria-label={`${change.label} change`}>
                <h3>{change.label}</h3>
                <dl className="history-answer-comparison report-wording-comparison">
                  <div>
                    <dt>Before</dt>
                    <dd>
                      {entry.initial
                        ? "Not previously saved."
                        : change.before || "Not added."}
                    </dd>
                  </div>
                  <div>
                    <dt>After</dt>
                    <dd>{change.after || "Removed — no text saved."}</dd>
                  </div>
                </dl>
              </section>
            ))}
            <details className="report-version-content">
              <summary>View full saved report</summary>
              {REPORT_FIELDS.filter(({ key }) => key !== "changes").map(
                ({ key, label }) => (
                  <section key={key}>
                    <h3>{label}</h3>
                    <p>{entry.content[key] || "Not added."}</p>
                  </section>
                ),
              )}
            </details>
            <p className="muted report-version-source">
              Based on {entry.sources.length} submitted{" "}
              {entry.sources.length === 1 ? "response" : "responses"} at the
              time of saving.
            </p>
          </details>
        ))}
      </div>
    </details>
  );
}
