import { Badge, Button, Panel, PersonIdentity, TextLink } from "../components/UI";
import { createSeed, formatDate } from "../model";

const person = createSeed().people.find((item) => item.id === "YS-1024");
const episode = person.episodes[0];
const collection = episode.collections.find((item) => item.id === "A-0-current");

function PersonSurfaceFrame({ children }) {
  return (
    <div className="ds-surface-story">
      <main className="main main-internal ds-person-main">
        <div className="person-heading"><h1>{person.name}</h1></div>
        <div className="person-content-surface person-open-surface">{children}</div>
      </main>
    </div>
  );
}

export default {
  title: "05 Compositions/Person surfaces",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Current person-record surfaces. Current assessment and Contact and participant context use the same light border, radius, and surface as Additional alerts. Current care episode remains borderless and transparent.",
      },
    },
  },
};

export const OverviewSummary = {
  render: () => (
    <PersonSurfaceFrame>
      <div className="overview-top-row">
        <Panel className="overview-assessment">
          <header className="overview-assessment-heading">
            <div className="overview-assessment-topline">
              <p className="overview-assessment-label">Current assessment</p>
              <Badge>Overdue</Badge>
            </div>
            <div className="overview-assessment-title"><h2>{collection.label}</h2></div>
            <p className="overview-assessment-context">Due {formatDate(collection.due)} · <span className="status-overdue-text">14 days overdue</span></p>
          </header>
          <div className="panel-body">
            <div className="overview-assessment-layout">
              <section className="next-step" aria-label="Next step">
                <p className="next-step-label">Next step</p>
                <h3>Replace the expired questionnaire link</h3>
                <p>The previous link has expired and no response has been submitted. Saved answers can continue in a new session.</p>
                <div className="actions"><Button variant="primary">Replace expired link</Button></div>
              </section>
              <section className="overview-assessment-details" aria-label="Assessment details">
                <dl className="metadata">
                  <div><dt>Assessment</dt><dd><Badge>In progress</Badge></dd></div>
                  <div><dt>Response</dt><dd><Badge>Draft</Badge></dd></div>
                  <div><dt>Clinical review</dt><dd><Badge>Awaiting response</Badge></dd></div>
                  <div><dt>Instrument</dt><dd>{collection.version}</dd></div>
                </dl>
                <div className="assessment-preview-action"><TextLink type="button">Preview questionnaire</TextLink></div>
              </section>
            </div>
          </div>
        </Panel>
        <aside className="overview-side-container" aria-label="Care episode details">
          <div className="overview-info-panel">
            <div className="episode-bar">
              <div className="episode-context episode-period"><h2 className="episode-summary-title">Current care episode</h2></div>
              <div className="episode-status"><Badge>{episode.status}</Badge></div>
              <div className="episode-fact episode-started"><small>Started</small><span>{formatDate(episode.start)}</span></div>
              <div className="episode-fact episode-program-stream"><small>Program stream</small><span>{episode.programStream}</span></div>
              <div className="episode-fact episode-care-level"><small>Care level</small><div className="episode-care-level-value"><span>Mid</span><button type="button" className="episode-care-level-change">Edit</button><button type="button" className="episode-care-level-change">History</button></div></div>
              <div className="episode-fact episode-next-review"><small>Proposed next review</small><div className="episode-next-review-value"><span>15 Dec 2026</span><small>In 80 days</small></div></div>
              <div className="episode-fact episode-completeness"><small>Required data</small><div className="episode-completeness-value"><span>100%</span><button type="button" className="episode-bar-completeness-link">1 data issue</button></div></div>
            </div>
          </div>
        </aside>
      </div>
    </PersonSurfaceFrame>
  ),
};

export const ContactParticipantContext = {
  render: () => (
    <PersonSurfaceFrame>
      <section className="consent-context-panel" aria-labelledby="story-consent-context-title">
        <h3 id="story-consent-context-title">Contact and participant context</h3>
        <dl className="consent-summary-row">
          <div><dt>Source</dt><dd>{person.consentReference || "No source recorded"}</dd></div>
          <div><dt>Assessment respondent</dt><dd>{person.respondentPreference || "Not recorded"}</dd></div>
          <div><dt>Participant</dt><dd><PersonIdentity name={person.name} descriptor="Patient" /></dd></div>
          <div><dt>Contact suitability</dt><dd>{person.contact}</dd></div>
          <div><dt>Guardian authority</dt><dd>Not established</dd></div>
          <div><dt>Research participation</dt><dd>Not recorded · separate purpose</dd></div>
          {person.family && <div><dt>Family respondent</dt><dd><PersonIdentity name={person.family} descriptor="Family carer" /><span className="identity-suffix">own contribution only</span></dd></div>}
        </dl>
      </section>
    </PersonSurfaceFrame>
  ),
};
