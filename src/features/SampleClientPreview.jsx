import { Fragment, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge, Button, Empty, PageHeading, Panel } from "../components/UI";
import sample from "../data/ysccSampleClient.json";
import "./SampleClientPreview.css";

const dateFromCsv = (value) => {
  if (!/^\d{8}$/.test(value || "")) return "Not supplied";
  const day = value.slice(0, 2);
  const month = value.slice(2, 4);
  const year = value.slice(4);
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${year}-${month}-${day}T12:00:00Z`));
};

const eventType = {
  "1": "Service contact",
  "3": "Secondary consultation",
  "5": "Service experience",
};

function SourceFields({ record }) {
  return (
    <dl className="sample-source-fields">
      {Object.entries(record).map(([field, value]) => (
        <div key={field}>
          <dt>{field.replaceAll("_", " ")}</dt>
          <dd>{value || "Not supplied"}</dd>
        </div>
      ))}
    </dl>
  );
}

function EventEvidence({ event }) {
  const items = event.measureItems;
  const scores = event.measureScores;
  if (!items.length && !scores.length) return <span className="muted">No measure attached</span>;
  return (
    <div className="sample-event-evidence">
      {scores.map((score) => (
        <span key={`${score.care_event_key}-${score.instrument}`}>
          {score.instrument} score: <strong>{score.score || "Unavailable"}</strong>
        </span>
      ))}
      {items.length > 0 && (
        <details>
          <summary>{items.length} recorded item values</summary>
          <ul>
            {items.map((item) => (
              <li key={`${item.instrument}-${item.item}`}>
                {item.instrument} · {item.item}: {item.value}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export default function SampleClientPreview({ id, navigate }) {
  const [expandedEventKey, setExpandedEventKey] = useState(null);
  const client = sample.client;
  if (id !== client.client_key) {
    return (
      <Empty title="Sample client unavailable">
        <Button onClick={() => navigate("/administration")}>Back to Administration</Button>
      </Empty>
    );
  }
  const centre = sample.organisations.find((row) =>
    row.organisation_path === client.organisation_path);
  const journey = sample.journeys[0];
  const missingScores = sample.events.flatMap((event) => event.measureScores)
    .filter((score) => !score.score).length;

  return (
    <div className="sample-client-preview">
      <PageHeading
        title={`Sample client ${client.client_key}`}
        subtitle="One client imported from the supplied CSVs for review."
        meta="Read-only preview · proposed Stage 2 format · separate from the prototype's editable people"
      >
        <Button variant="secondary" onClick={() => navigate("/administration")}>
          <ArrowLeft size={18} aria-hidden="true" /> Back to Administration
        </Button>
      </PageHeading>

      <div className="sample-preview-grid">
        <Panel title="What the files record" action={<Badge>Read-only</Badge>}>
          <div className="panel-body">
            <dl className="sample-facts">
              <div><dt>Client reference</dt><dd>{client.client_key}</dd></div>
              <div><dt>Date of birth</dt><dd>{dateFromCsv(client.date_of_birth)}</dd></div>
              <div><dt>Reporting organisation</dt><dd>{centre?.organisation_name || client.organisation_path}</dd></div>
              <div><dt>Care journey</dt><dd>{journey?.care_journey_key || "Not supplied"}</dd></div>
              <div><dt>Linked episodes</dt><dd>{sample.episodes.length}</dd></div>
              <div><dt>Recorded care events</dt><dd>{sample.events.length}</dd></div>
            </dl>
            <details className="sample-source-disclosure">
              <summary>View all client source fields</summary>
              <SourceFields record={client} />
            </details>
          </div>
        </Panel>
        <Panel title="What remains unknown">
          <div className="panel-body">
            <ul className="sample-missing-list">
              <li>No client name is present in the CSVs.</li>
              <li>The proposed dated client attributes file was not supplied.</li>
              <li>Future bookings, draft assessments and assigned tasks are not in these reporting files.</li>
              <li>{missingScores} recorded score {missingScores === 1 ? "value is" : "values are"} blank for this client.</li>
            </ul>
            <p className="muted">Numeric source codes are shown as codes until their definitions are approved. A blank score is never shown as zero.</p>
          </div>
        </Panel>
      </div>

      {sample.episodes.map((episode, index) => {
        const events = sample.events.filter((event) => event.episode_key === episode.episode_key);
        return (
          <Panel
            key={episode.episode_key}
            className="sample-episode-panel"
            title={`Episode ${index + 1} of ${sample.episodes.length}`}
            action={<span className="muted">{episode.episode_key}</span>}
          >
            <div className="panel-body">
              <dl className="sample-facts sample-episode-facts">
                <div><dt>Dates</dt><dd>{dateFromCsv(episode.episode_start_date)} – {dateFromCsv(episode.episode_end_date)}</dd></div>
                <div><dt>Stream</dt><dd>Code {episode.stream}</dd></div>
                <div><dt>Care level</dt><dd>Code {episode.care_level}</dd></div>
                <div><dt>Previous episode</dt><dd>{episode.previous_episode_key || "None recorded"}</dd></div>
                <div><dt>Link reason</dt><dd>Code {episode.link_reason}</dd></div>
                <div><dt>Referral date</dt><dd>{dateFromCsv(episode.referral_date)}</dd></div>
              </dl>
              <details className="sample-source-disclosure">
                <summary>View all episode source fields</summary>
                <SourceFields record={episode} />
              </details>
              <h3>Recorded care events <span className="muted">({events.length})</span></h3>
              <div className="table-scroll sample-events-scroll">
                <table className="people-table sample-events-table">
                  <caption className="sr-only">Recorded care events for {episode.episode_key}</caption>
                  <thead><tr><th>Date</th><th>Event</th><th>Recorded measures</th><th>Source details</th></tr></thead>
                  <tbody>
                    {events.map((event) => {
                      const { measureItems, measureScores, ...raw } = event;
                      const isExpanded = expandedEventKey === event.care_event_key;
                      const sourceId = `sample-source-${event.care_event_key}`;
                      return (
                        <Fragment key={event.care_event_key}>
                          <tr>
                            <td>{dateFromCsv(event.care_event_date)}</td>
                            <td>
                              <strong>{eventType[event.care_event_type] || `Care event · code ${event.care_event_type}`}</strong>
                              <small>{event.care_event_key}</small>
                            </td>
                            <td><EventEvidence event={event} /></td>
                            <td>
                              <button
                                type="button"
                                className="sample-source-toggle"
                                aria-expanded={isExpanded}
                                aria-controls={sourceId}
                                onClick={() => setExpandedEventKey(isExpanded ? null : event.care_event_key)}
                              >
                                <span aria-hidden="true">{isExpanded ? "▾" : "▸"}</span>
                                {isExpanded ? "Hide source fields" : "View source fields"}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="sample-event-source-row">
                              <td colSpan={4}>
                                <div id={sourceId}>
                                  <strong>Source fields · {event.care_event_key}</strong>
                                  <SourceFields record={raw} />
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
