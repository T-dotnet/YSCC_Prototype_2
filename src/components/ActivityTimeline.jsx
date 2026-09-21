import {
  activityEntries,
  activityChangeDetails,
  changeLogEntries,
  clinicalHistoryEntries,
} from "../activity";
import { formatDate, personEventText } from "../model";
import { Badge, Tabs } from "./UI";

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
  view = "grouped",
  onViewChange,
}) {
  const entries = clinicalHistoryEntries(person, episode, audit);
  const entriesForCollection = (collectionId) =>
    entries.filter((entry) => entry.collectionId === collectionId);
  const careEvents = entries.filter((entry) => !entry.collectionId);

  return (
    <div className="clinical-history">
      <p className="history-intro">
        All assessment assignments in this care episode, including their stage,
        delivery method, start, completion, appointments and recorded clinical
        events and structured care records.
      </p>
      <div className="history-view-switcher">
        <Tabs
          id="history-view"
          label="History view"
          items={[
            { value: "grouped", label: "By assessment" },
            { value: "timeline", label: "Continuous timeline" },
          ]}
          value={view}
          onChange={onViewChange}
        />
      </div>
      <div
        id="history-view-panel"
        role="tabpanel"
        aria-labelledby={`history-view-tab-${view === "grouped" ? 0 : 1}`}
      >
        {view === "timeline" ? (
          <ContinuousHistory entries={entries} episode={episode} person={person} />
        ) : (
          <>
            <ol className="assignment-history" aria-label="Assessment assignment history">
              {episode.collections.map((collection) => {
          const attempts = [...(collection.attempts || [])].toSorted((a, b) =>
            (a.timestamp || a.date || "").localeCompare(
              b.timestamp || b.date || "",
            ),
          );
          const events = entriesForCollection(collection.id);
          const startedAt =
            attempts[0]?.timestamp ||
            attempts[0]?.date ||
            events.find((entry) => entry.actionType === "DELIVER")?.timestamp ||
            events.find((entry) => entry.actionType === "DELIVER")?.date;
          const completedAt =
            collection.submittedTimestamp ||
            collection.submittedAt ||
            events.find((entry) => entry.actionType === "SUBMIT")?.timestamp ||
            events.find((entry) => entry.actionType === "SUBMIT")?.date;
                return (
                  <li key={collection.id}>
                    <header>
                      <div>
                        <h3>{collection.label}</h3>
                        <p>{collection.version}</p>
                      </div>
                      <Badge>{collection.assignment || "Not recorded"}</Badge>
                    </header>
                    <dl className="assignment-history-details">
                      <div>
                        <dt>Stage</dt>
                        <dd>{collection.assignment || "Not recorded"}</dd>
                      </div>
                      <div>
                        <dt>Delivery</dt>
                        <dd>{collection.channel || "Not set"}</dd>
                      </div>
                      <div>
                        <dt>Started</dt>
                        <dd>{displayDate(startedAt)}</dd>
                      </div>
                      <div>
                        <dt>Completed</dt>
                        <dd>{displayDate(completedAt)}</dd>
                      </div>
                    </dl>
                    <h4>Events</h4>
                    <EventList
                      entries={events}
                      person={person}
                      label={`${collection.label} events`}
                    />
                  </li>
                );
              })}
            </ol>
            <section className="episode-history-events" aria-labelledby="episode-events-heading">
              <h3 id="episode-events-heading">Care-period activity</h3>
              <EventList
                entries={careEvents}
                person={person}
                label="Care-period activity"
              />
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export function ChangeLog({ episode, person, audit = [] }) {
  const entries = changeLogEntries(person, episode, audit);
  return (
    <div className="change-log">
      <p className="history-intro">
        Field-level record of who changed what in this care episode. Expand an
        entry to view the before and after values.
      </p>
      {entries.length ? (
        <ol className="timeline activity-history" aria-label="Field change log">
          {entries.map((entry) => {
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
        <p className="history-empty">No field changes have been recorded for this care episode.</p>
      )}
    </div>
  );
}
