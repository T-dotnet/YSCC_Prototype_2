import IntakeWorkspace, { IntakePanel } from "./Intake";
import Referrals from "./Referrals";
import { intakeFor, canAssess } from "../intake";
import { overviewNextStep } from "../overview";
import { latestCareEventsByType } from "../careEvents";
import {
  currentCollection,
  compareCollections,
  isOutstanding,
  safeReturnTo,
} from "../workflow";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  ChevronDown,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { useStore } from "../store";
import RecordTwo from "./RecordTwo";
import CareEvents from "./CareEvents";
import Appointments from "./Appointments";
import ReviewPack from "../components/ReviewPack";
import Timeline, {
  ChangeLog,
  ClinicalHistory,
} from "../components/ActivityTimeline";
import { getInstrument } from "../instruments";
import {
  age,
  formatDate,
  collectionStatus,
  clinicalReviewStatus,
  collectionActorIdentity,
  formatTimestamp,
  currentStaff,
  noClinicalReviewRequired,
  TODAY,
} from "../model";
import { recordCompleteness } from "../dataQuality";
import {
  Button,
  Badge,
  Panel,
  Select,
  Notice,
  Continuity,
  TextLink,
  Empty,
  Modal,
  Tabs,
  PersonIdentity,
  Avatar,
} from "../components/UI";

export default function Person({ id, navigate, openModal }) {
  const { state } = useStore();
  const p = state.people.find((p) => p.id === id);
  const searchParams = useSearchParams();
  const [reviewPackOpen, setReviewPackOpen] = useState(false);
  const allTabs = [
    "Overview",
    "Assessment",
    "Appointments",
    "Events",
    "Report",
    "Consent & respondents",
    "History",
    "Change log",
  ];
  // Existing worklist links open these workflows outside the record tab bar.
  const contextualView = ["Intake", "Referrals"].find(
    (view) => view.toLowerCase() === searchParams.get("tab"),
  );
  const setTab = (value) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "Overview") params.delete("tab");
    else params.set("tab", value.toLowerCase());
    if (value !== "History") params.delete("historyView");
    navigate(`/people/${p.id}${params.size ? `?${params}` : ""}`, {
      scroll: false,
    });
  };
  const historyView =
    searchParams.get("historyView") === "timeline" ? "timeline" : "grouped";
  const setHistoryView = (value) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "history");
    if (value === "timeline") params.set("historyView", "timeline");
    else params.delete("historyView");
    navigate(`/people/${p.id}?${params}`, { scroll: false });
  };
  const episodeId = searchParams.get("episode");
  if (!p)
    return (
      <Empty title="Person record unavailable">
        <Button onClick={() => navigate("/people")}>Back to people</Button>
      </Empty>
    );
  const selectedEpisode =
    p.episodes.find((e) => e.id === episodeId) || p.episodes[0];
  if (!selectedEpisode?.collections.length)
    return (
      <IntakeWorkspace person={p} navigate={navigate} openModal={openModal} />
    );
  const e = selectedEpisode,
    c =
      e.collections.find((col) => col.id === searchParams.get("collection")) ||
      currentCollection(e),
    nextStep = overviewNextStep(p, e, c, currentStaff(state));
  const assessmentAvailable = canAssess(p, e);
  const tabs = assessmentAvailable
    ? allTabs
    : allTabs.filter((item) => item !== "Assessment");
  const requestedTab =
    contextualView ||
    (["progress", "analysis", "record 2"].includes(searchParams.get("tab"))
      ? "Report"
      : null) ||
    tabs.find((t) => t.toLowerCase() === searchParams.get("tab")) ||
    "Overview";
  const tab =
    requestedTab === "Assessment" && !assessmentAvailable
      ? "Overview"
      : requestedTab;
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const returnLabel =
    returnTo.split("?")[0] === "/"
      ? "My work"
      : returnTo.split("?")[0] === "/quality"
        ? "Data quality"
        : "people";
  const orderedCollections = [...e.collections].sort(
    (a, b) =>
      (a.id === searchParams.get("collection")
        ? -1
        : b.id === searchParams.get("collection")
          ? 1
          : 0) || compareCollections(a, b),
  );
  const context = { personId: p.id, episodeId: e.id, collectionId: c.id };
  const openReview = (collection) =>
    navigate(`/people/${p.id}/assessment-review/${collection.id}`, {
      scroll: false,
    });
  const modal = (type) =>
    type === "review" ? openReview(c) : openModal({ type, ...context });
  const consentRequests = p.consentRequests || [];
  const eventSummary = latestCareEventsByType(e);
  const reviewed =
    c.response === "Submitted" &&
    (noClinicalReviewRequired(c) ||
      (c.review === "Reviewed" && !c.needsReview));
  const completeness = recordCompleteness(p, TODAY);
  return (
    <>
      <button className="back-link" onClick={() => navigate(returnTo)}>
        <ArrowLeft size={17} />
        Back to {returnLabel}
      </button>
      <div className="person-heading">
        <div>
          <h1 className="person-name-heading">
            <span>{p.name}</span>
            <small>Patient</small>
          </h1>
          <p>
            {p.id}
            <span>·</span>
            {p.dob ? `${age(p.dob)} years` : "Date of birth unknown"}
            <span>·</span>
            {p.pronouns}
          </p>
        </div>
        <div className="actions">
          <Button
            disabled={e.status === "Closed"}
            onClick={() => modal("episode")}
          >
            Care period actions
            <ChevronDown size={16} />
          </Button>
        </div>
      </div>
      <div className="episode-bar">
        <div className="episode-context episode-period">
          {p.episodes.length > 1 ? (
            <>
              <label htmlFor="care-period">Care period</label>
              <Select
                id="care-period"
                label="Care period"
                value={e.id}
                onChange={(ev) => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("episode", ev.target.value);
                  params.delete("collection");
                  navigate(`/people/${p.id}?${params}`, { scroll: false });
                }}
              >
                {p.episodes.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {formatDate(ep.start)} –{" "}
                    {ep.end
                      ? formatDate(ep.end)
                      : ep.status === "Closed"
                        ? "end not recorded"
                        : "present"}{" "}
                    · {ep.status}
                  </option>
                ))}
              </Select>
              <small>
                Overview, Report, assessments and history for this period.
              </small>
            </>
          ) : (
            <>
              <small>
                {e.status === "Active" ? "Current care" : `${e.status} care`}
              </small>
              <span>
                Started {formatDate(e.start)}
                {e.end ? ` · Ended ${formatDate(e.end)}` : ""}
              </span>
            </>
          )}
        </div>
        <div className="episode-status">
          <Badge>{e.status}</Badge>
        </div>
        <div className="episode-fact episode-owner">
          <small>Key clinician</small>
          <span>{p.owner}</span>
        </div>
        <div className="episode-fact episode-location">
          <small>Location</small>
          <span>Northside Centre</span>
        </div>
        <div className="episode-fact episode-completeness">
          <small>Required data</small>
          <button
            type="button"
            className="episode-bar-completeness-link"
            onClick={() => navigate("/quality")}
            aria-label={`Open data quality. ${completeness.requiredPercentage}% of required fields complete.`}
          >
            {completeness.requiredPercentage === 100 && (
              <CheckCircle2
                size={15}
                aria-hidden="true"
                className="record-completeness-icon"
              />
            )}
            <span>{completeness.requiredPercentage}%</span>
          </button>
        </div>
      </div>
      {contextualView ? (
        <div className="section-toolbar">
          <h2 id="person-context-heading">{contextualView}</h2>
          <Button onClick={() => setTab("Overview")}>
            <ArrowLeft size={16} aria-hidden="true" /> Back to overview
          </Button>
        </div>
      ) : (
        <Tabs
          id="person"
          label="Person record"
          className="person-tabs"
          items={tabs}
          value={tab}
          onChange={setTab}
        />
      )}
      <div
        role={contextualView ? "region" : "tabpanel"}
        id="person-panel"
        aria-labelledby={
          contextualView
            ? "person-context-heading"
            : `person-tab-${tabs.indexOf(tab)}`
        }
      >
        {!canAssess(p, e) && (
          <Notice tone="amber">
            Intake must be reviewed before further assessment work.{" "}
            <button className="inline-link" onClick={() => setTab("Intake")}>
              Open intake
            </button>
          </Notice>
        )}
        {tab === "Intake" && (
          <IntakePanel
            key={`${intakeFor(p, e)?.id}:${intakeFor(p, e)?.revision}`}
            person={p}
            intake={intakeFor(p, e) || p.intakes[0]}
            navigate={navigate}
          />
        )}
        {tab === "Referrals" && (
          <Referrals
            person={p}
            episode={e}
            intake={intakeFor(p, e)}
            openModal={openModal}
          />
        )}
        {e.status !== "Active" && (
          <Notice tone="amber">
            {e.status === "Closed"
              ? `This period of care is closed${e.end ? ` as of ${formatDate(e.end)}` : ""}. Submitted responses and reviews remain available.`
              : "This care episode is paused. Outstanding collections are paused and their links are revoked. Submitted responses remain in the record."}
          </Notice>
        )}
        {tab === "Overview" && (
          <>
            <Panel className="overview-assessment">
              <header className="overview-assessment-heading">
                <p className="overview-assessment-label">
                  {e.status === "Closed"
                    ? "Latest assessment in this period"
                    : "Current assessment"}
                </p>
                <div className="overview-assessment-title">
                  <h2>{c.label}</h2>
                  <Badge>{nextStep.badge}</Badge>
                </div>
                <p className="overview-assessment-context">
                  {nextStep.dueText}
                </p>
              </header>
              <div className="panel-body">
                <div className="overview-assessment-layout">
                  <section className="next-step" aria-label="Next step">
                    <p className="next-step-label">Next step</p>
                    <h3>{nextStep.title}</h3>
                    <p>{nextStep.description}</p>
                    <div className="actions">
                      <Button
                        variant="primary"
                        aria-haspopup={
                          nextStep.primary.modal ? "dialog" : undefined
                        }
                        onClick={() =>
                          nextStep.primary.modal
                            ? modal(nextStep.primary.modal)
                            : setTab(nextStep.primary.tab)
                        }
                      >
                        {nextStep.primary.label}
                      </Button>
                      <TextLink
                        aria-haspopup="dialog"
                        onClick={() => setReviewPackOpen((open) => !open)}
                      >
                        View review pack
                      </TextLink>
                    </div>
                  </section>
                  <section
                    className="overview-assessment-details"
                    aria-label="Assessment details"
                  >
                    <dl className="metadata">
                      <div>
                        <dt>Assessment</dt>
                        <dd>
                          <Badge>{c.assessmentProgress || "In progress"}</Badge>
                        </dd>
                      </div>
                      <div>
                        <dt>Response</dt>
                        <dd>
                          <Badge>{c.response}</Badge>
                        </dd>
                      </div>
                      <div>
                        <dt>Clinical review</dt>
                        <dd>
                          <Badge>{clinicalReviewStatus(c)}</Badge>
                        </dd>
                      </div>
                      <div>
                        <dt>Instrument</dt>
                        <dd>{c.version}</dd>
                      </div>
                    </dl>
                    <div className="assessment-preview-action">
                      <Button
                        aria-haspopup="dialog"
                        onClick={() => modal("questionnaire-preview")}
                      >
                        Preview questionnaire
                      </Button>
                    </div>
                    {c.response === "Submitted" && (
                      <Notice>
                        {noClinicalReviewRequired(c)
                          ? "The response is complete; no separate clinical review is required."
                          : reviewed
                            ? "The response and its clinical review are retained separately."
                            : "A submitted response still needs clinical review."}
                      </Notice>
                    )}
                  </section>
                </div>
              </div>
            </Panel>
            {reviewPackOpen && (
              <Modal
                title="90-day review pack"
                subtitle="Recorded context to prepare the next multidisciplinary review."
                onClose={() => setReviewPackOpen(false)}
                wide
                className="review-pack-dialog"
              >
                <ReviewPack
                  person={p}
                  episode={e}
                  owner={p.owner}
                  nextStep={nextStep}
                  onOpenAssessment={() => setTab("Assessment")}
                  onOpenEvents={() => setTab("Events")}
                  onPlanFollowUp={() => modal("plan")}
                  inModal
                />
              </Modal>
            )}
            <div className="person-grid">
              <Panel
                title="Care timeline"
                action={
                  <TextLink onClick={() => setTab("History")}>
                    View history
                  </TextLink>
                }
              >
                <Timeline episode={e} person={p} audit={state.audit} />
              </Panel>
              <Panel
                title="Events"
                action={
                  <TextLink onClick={() => setTab("Events")}>
                    View all events
                  </TextLink>
                }
              >
                <ul className="overview-events" aria-label="Event summary">
                  {eventSummary.map(({ value, label, event }) => (
                    <li key={value}>
                      <span>{label}</span>
                      {event ? (
                        <span className="overview-event-recorded">
                          <time dateTime={event.eventDate || event.date}>
                            {formatDate(event.eventDate || event.date)}
                          </time>
                          <button
                            className="icon-button overview-event-details"
                            aria-label={`View details for ${label}`}
                            onClick={() =>
                              navigate(
                                `/people/${p.id}?tab=events&event=${event.id}`,
                                { scroll: false },
                              )
                            }
                          >
                            <ArrowRight size={18} aria-hidden="true" />
                          </button>
                        </span>
                      ) : (
                        <span className="muted">Not present</span>
                      )}
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel title="People involved">
                <div className="panel-body">
                  <div className="involved">
                    <Avatar name={p.owner} />
                    <PersonIdentity name={p.owner} descriptor="Care owner" />
                  </div>
                  <div className="involved">
                    <Avatar name={p.name} />
                    <PersonIdentity name={p.name} descriptor="Patient" />
                  </div>
                  {p.family && (
                    <div className="involved">
                      <Avatar name={p.family} />
                      <PersonIdentity
                        name={p.family}
                        descriptor="Family carer"
                      />
                    </div>
                  )}
                  <p className="footnote">
                    Family participation is separate from guardian authority.
                  </p>
                </div>
              </Panel>
            </div>
            <Continuity person />
          </>
        )}
        {tab === "Assessment" && (
          <div className="stack">
            <div className="section-toolbar">
              <div>
                <h2>Assessment & collection plan</h2>
                <p>
                  Separate collection points within care episode {e.number}.
                </p>
              </div>
              <Button
                variant="primary"
                disabled={e.status !== "Active" || !canAssess(p, e)}
                onClick={() => modal("plan")}
              >
                Plan follow-up
              </Button>
            </div>
            {orderedCollections.map((col) => {
              const isPrior =
                !isOutstanding(col) &&
                col.id !== searchParams.get("collection");
              const respondent = collectionActorIdentity(p, col, "respondent");
              const card = (
                <Panel
                  key={col.id}
                  className={
                    col.id === searchParams.get("collection")
                      ? "selected-collection"
                      : ""
                  }
                  title={isPrior ? undefined : col.label}
                  action={
                    isPrior ? undefined : <Badge>{collectionStatus(col)}</Badge>
                  }
                >
                  <div className="panel-body">
                    <div className="assignment-grid">
                      <div className="measure-title">
                        <span className="measure-icon">
                          <FileText size={24} />
                        </span>
                        <div>
                          <h3>{col.version}</h3>
                          <p>
                            {getInstrument(col.version)?.questions.length ||
                              "Version-specific"}{" "}
                            sample questions · no clinical score
                          </p>
                        </div>
                      </div>
                      <div>
                        <small>Respondent</small>
                        <PersonIdentity
                          name={respondent.name}
                          descriptor={respondent.role}
                        />
                      </div>
                      <div>
                        <small>Due date</small>
                        <strong>{formatDate(col.due)}</strong>
                      </div>
                      <div>
                        <small>Collection method</small>
                        <strong>{col.channel || "Not set up"}</strong>
                      </div>
                    </div>
                    <div className="assignment-status">
                      <span>
                        Assignment <Badge>{col.assignment}</Badge>
                      </span>
                      <span>
                        Response <Badge>{col.response}</Badge>
                      </span>
                      <span>
                        Review <Badge>{clinicalReviewStatus(col)}</Badge>
                      </span>
                    </div>
                    <div className="assignment-footer">
                      <span className="muted">
                        {col.attempts.length} delivery{" "}
                        {col.attempts.length === 1 ? "attempt" : "attempts"} ·
                        version pinned at assignment
                      </span>
                      <div className="actions">
                        <TextLink
                          aria-haspopup="dialog"
                          onClick={() =>
                            openModal({
                              type: "collection-details",
                              personId: p.id,
                              episodeId: e.id,
                              collectionId: col.id,
                            })
                          }
                        >
                          View details
                        </TextLink>
                        {col.response === "Submitted" &&
                          (!noClinicalReviewRequired(col) ||
                            collectionStatus(col) === "Completed") && (
                            <Button
                              variant="secondary"
                              onClick={() => openReview(col)}
                            >
                              {col.needsReview
                                ? "Review updated answers"
                                : col.review === "Reviewed" ||
                                    collectionStatus(col) === "Completed"
                                  ? "Review recorded"
                                  : "Review responses"}
                            </Button>
                          )}
                        {col.response !== "Submitted" && (
                          <Button
                            variant="secondary"
                            aria-haspopup="dialog"
                            onClick={() =>
                              openModal({
                                type: "questionnaire-preview",
                                personId: p.id,
                                episodeId: e.id,
                                collectionId: col.id,
                              })
                            }
                          >
                            Preview questionnaire
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Panel>
              );
              return !isPrior ? (
                card
              ) : (
                <details key={col.id} className="prior-collection">
                  <summary>
                    <span>
                      <strong>{col.label}</strong>
                      <small>
                        {formatDate(col.due)} · {col.version}
                      </small>
                    </span>
                    <Badge>{collectionStatus(col)}</Badge>
                    <ChevronDown size={18} aria-hidden="true" />
                  </summary>
                  {card}
                </details>
              );
            })}
            <Notice>
              Sample instrument and collection rules. Clinical content,
              eligibility, cadence, and completion criteria require approval
              before live use.
            </Notice>
          </div>
        )}
        {tab === "Appointments" && (
          <Appointments
            episode={e}
            openModal={(appointmentModal) =>
              openModal({ ...appointmentModal, personId: p.id })
            }
          />
        )}
        {tab === "Events" && (
          <CareEvents
            episode={e}
            eventId={searchParams.get("event")}
            openModal={(eventModal) =>
              openModal({ ...eventModal, personId: p.id })
            }
          />
        )}
        {tab === "Report" && (
          <RecordTwo person={p} episode={e} navigate={navigate} />
        )}
        {tab === "Consent & respondents" && (
          <div className="consent-board">
            <div className="section-toolbar consent-board-heading">
              <div>
                <p className="eyebrow">Permission centre</p>
                <h2>Consent & respondents</h2>
                <p>Make the decision clear, then keep the evidence close.</p>
              </div>
              <Button variant="primary" onClick={() => modal("consent-send")}>
                Send consent request
              </Button>
            </div>
            <div className="consent-board-grid">
              <section className="consent-hero-card" aria-labelledby="consent-status-title">
                <div className="consent-card-kicker"><CheckCircle2 size={17} /> Current decision</div>
                <div className="consent-hero-status" id="consent-status-title">{p.consent}</div>
                <p>Assessment participation · this care episode</p>
                <div className="consent-hero-rule" />
                <div className="consent-hero-meta"><span>Source</span><strong>{p.consentReference || "No source recorded"}</strong></div>
                <div className="consent-hero-meta"><span>Assessment respondent</span><strong>{p.respondentPreference || "Not recorded"}</strong></div>
              </section>
              <section className="consent-context-card" aria-labelledby="respondent-context-title">
                <div className="consent-card-kicker">Who can contribute</div>
                <h3 id="respondent-context-title">Respondent context</h3>
                <dl className="consent-context-list">
                  <div>
                    <dt>Name</dt>
                    <dd>
                      <PersonIdentity name={p.name} descriptor="Patient" />
                    </dd>
                  </div>
                  <div>
                    <dt>Contact suitability</dt>
                    <dd>{p.contact}</dd>
                  </div>
                  <div>
                    <dt>Guardian authority</dt>
                    <dd>Not established</dd>
                  </div>
                  <div>
                    <dt>Research participation</dt>
                    <dd>Not recorded · separate purpose</dd>
                  </div>
                  {p.family && (
                    <div>
                      <dt>Family respondent</dt>
                      <dd>
                        <PersonIdentity
                          name={p.family}
                          descriptor="Family carer"
                        />
                        <span className="identity-suffix">
                          own contribution only
                        </span>
                      </dd>
                    </div>
                  )}
                </dl>
              </section>
            </div>
            <section className="consent-history" aria-labelledby="consent-history-title">
              <div className="consent-history-heading"><div><p className="eyebrow">Audit trail</p><h3 id="consent-history-title">Request history</h3></div><span>{consentRequests.length} {consentRequests.length === 1 ? "request" : "requests"}</span></div>
              <div className="consent-history-list">
                {consentRequests.map((request) => (
                  <details key={request.id} className="consent-history-item">
                    <summary><span className="consent-history-marker" /><span className="consent-history-main"><strong>{request.title}</strong><small>{request.version} · {request.scope}</small></span><span className="consent-history-date">{request.sentAt ? formatDate(request.sentAt) : "Not sent"}</span><Badge>{request.status}</Badge><ChevronDown size={17} aria-hidden="true" /></summary>
                    <div className="consent-history-detail"><span>{request.channel} · {request.decisionMaker || "Decision maker not recorded"}</span><Button variant="secondary" onClick={() => openModal({ ...context, type: "consent-detail", consentRequestId: request.id })}>View request</Button></div>
                  </details>
                ))}
              </div>
            </section>
          </div>
        )}
        {tab === "History" && (
          <Panel
            title="History"
            action={
              <span className="muted">
                Clinician view · Care episode {e.number}
              </span>
            }
          >
            <ClinicalHistory
              episode={e}
              person={p}
              audit={state.audit}
              view={historyView}
              onViewChange={setHistoryView}
            />
          </Panel>
        )}
        {tab === "Change log" && (
          <Panel
            title="Change log"
            action={
              <span className="muted">
                Compliance view · Care episode {e.number}
              </span>
            }
          >
            <ChangeLog episode={e} person={p} audit={state.audit} />
          </Panel>
        )}
      </div>
    </>
  );
}
