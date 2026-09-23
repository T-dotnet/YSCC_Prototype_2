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
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  ChevronDown,
  FileText,
  CheckCircle2,
  FileCheck2,
} from "lucide-react";
import { useStore } from "../store";
import RecordTwo from "./RecordTwo";
import CareEvents from "./CareEvents";
import Appointments from "./Appointments";
import ReviewPack from "../components/ReviewPack";
import RecordItem from "../components/RecordItem";
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
  RecordTabs,
  PersonIdentity,
  Avatar,
} from "../components/UI";

const moreRecordTabs = ["Consent & respondents", "History", "Change log"];

function PersonRecordNavigation({ tabs, value, onChange }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const moreButtonRef = useRef(null);
  const primaryTabs = tabs.filter((item) => !moreRecordTabs.includes(item));
  const extraTabs = tabs.filter((item) => moreRecordTabs.includes(item));
  const extraSelected = extraTabs.includes(value);

  useEffect(() => {
    setMoreOpen(false);
  }, [value]);

  useEffect(() => {
    if (!moreOpen) return;
    const closeOnOutsideClick = (event) => {
      if (!moreRef.current?.contains(event.target)) setMoreOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setMoreOpen(false);
      moreButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [moreOpen]);

  return (
    <div className="person-record-navigation">
      <RecordTabs
        id="person"
        label="Person record"
        items={primaryTabs}
        value={value}
        onChange={onChange}
      />
      <div className="person-record-more" ref={moreRef}>
        <button
          ref={moreButtonRef}
          type="button"
          className={`person-record-more-trigger${extraSelected ? " selected" : ""}`}
          aria-label={`More record sections${extraSelected ? `, current: ${value}` : ""}`}
          aria-expanded={moreOpen}
          aria-controls={moreOpen ? "person-record-more-options" : undefined}
          onClick={() => setMoreOpen((open) => !open)}
        >
          More <ChevronDown size={15} aria-hidden="true" />
        </button>
        {moreOpen && (
          <div id="person-record-more-options" className="person-record-more-options">
            {extraTabs.map((item) => (
              <button
                key={item}
                type="button"
                aria-current={value === item ? "page" : undefined}
                onClick={() => {
                  setMoreOpen(false);
                  moreButtonRef.current?.focus();
                  onChange(item);
                }}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Person({ id, navigate, openModal }) {
  const { state } = useStore();
  const p = state.people.find((p) => p.id === id);
  const searchParams = useSearchParams();
  const [reviewPackOpen, setReviewPackOpen] = useState(false);
  const allTabs = [
    "Overview",
    "Assessment",
    { value: "Appointments", label: "Service contacts" },
    { value: "Events", label: "Care events" },
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
    params.delete("historyView");
    navigate(`/people/${p.id}${params.size ? `?${params}` : ""}`, {
      scroll: false,
    });
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
    (tabs.map((item) => typeof item === "string" ? item : item.value)
      .find((value) => value.toLowerCase() === searchParams.get("tab"))) ||
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
      <div className="person-content-surface">
      {contextualView ? (
        <div className="section-toolbar">
          <h2 id="person-context-heading">{contextualView}</h2>
          <Button onClick={() => setTab("Overview")}>
            <ArrowLeft size={16} aria-hidden="true" /> Back to overview
          </Button>
        </div>
      ) : (
        <PersonRecordNavigation
          tabs={tabs}
          value={tab}
          onChange={setTab}
        />
      )}
      <div
        role={contextualView || moreRecordTabs.includes(tab) ? "region" : "tabpanel"}
        id="person-panel"
        aria-labelledby={
          contextualView
            ? "person-context-heading"
            : moreRecordTabs.includes(tab)
              ? undefined
              : `person-tab-${tabs.filter((item) => !moreRecordTabs.includes(item)).findIndex((item) => (typeof item === "string" ? item : item.value) === tab)}`
        }
        aria-label={moreRecordTabs.includes(tab) ? tab : undefined}
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
                title="Care events"
                action={
                  <TextLink onClick={() => setTab("Events")}>
                    View all care events
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
              return (
                <RecordItem
                  key={col.id}
                  title={col.label}
                  subtitle={isPrior ? `${formatDate(col.due)} · ${col.version}` : undefined}
                  status={collectionStatus(col)}
                  collapsible={isPrior}
                  selected={col.id === searchParams.get("collection")}
                  lead={
                    <>
                      <span className="record-item-lead-icon"><FileText size={22} /></span>
                      <span>
                        <strong>{col.version}</strong>
                        <small>
                          {getInstrument(col.version)?.questions.length || "Version-specific"}{" "}
                          sample questions · no clinical score
                        </small>
                      </span>
                    </>
                  }
                  facts={[
                    {
                      label: "Respondent",
                      value: <PersonIdentity name={respondent.name} descriptor={respondent.role} />,
                    },
                    { label: "Due date", value: formatDate(col.due) },
                    { label: "Collection method", value: col.channel || "Not set up" },
                  ]}
                  secondary={
                    <div className="record-item-statuses">
                      <span>Assignment <Badge>{col.assignment}</Badge></span>
                      <span>Response <Badge>{col.response}</Badge></span>
                      <span>Review <Badge>{clinicalReviewStatus(col)}</Badge></span>
                    </div>
                  }
                  note={
                    <>
                      {col.attempts.length} delivery{" "}
                      {col.attempts.length === 1 ? "attempt" : "attempts"} · version pinned at assignment
                    </>
                  }
                  actions={
                    <>
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
                          <Button variant="secondary" onClick={() => openReview(col)}>
                            {col.needsReview
                              ? "Review updated answers"
                              : col.review === "Reviewed" || collectionStatus(col) === "Completed"
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
                    </>
                  }
                />
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
                <h2>Consent & respondents</h2>
                <p>Review the current decision and who can contribute.</p>
              </div>
              <Button variant="primary" onClick={() => modal("consent-send")}>
                Send consent request
              </Button>
            </div>
            {consentRequests.map((request) => (
              <RecordItem
                key={request.id}
                title={request.title}
                subtitle={`${request.version} · ${request.scope}`}
                status={request.status}
                collapsible
                lead={
                  <>
                    <span className="record-item-lead-icon"><FileCheck2 size={22} aria-hidden="true" /></span>
                    <span>
                      <strong>{request.version}</strong>
                    </span>
                  </>
                }
                facts={[
                  { label: "Scope", value: request.scope },
                  {
                    label: "Delivery",
                    value: `${request.channel} · ${request.sentAt ? formatDate(request.sentAt) : "Not sent"}`,
                  },
                  { label: "Current decision", value: request.status },
                  ...(request.decisionMaker
                    ? [{ label: "Decision maker", value: request.decisionMaker }]
                    : []),
                ]}
                note={
                  request.status === "Sent"
                    ? "Waiting for the patient’s decision."
                    : "Open request history and the permitted next action."
                }
                actions={
                  <Button
                    variant="secondary"
                    onClick={() => openModal({ ...context, type: "consent-detail", consentRequestId: request.id })}
                  >
                    View request
                  </Button>
                }
              />
            ))}
            <section className="consent-context-panel" aria-labelledby="consent-context-title">
              <h3 id="consent-context-title">Contact and participant context</h3>
              <dl className="consent-summary-row">
                <div>
                  <dt>Source</dt>
                  <dd>{p.consentReference || "No source recorded"}</dd>
                </div>
                <div>
                  <dt>Assessment respondent</dt>
                  <dd>{p.respondentPreference || "Not recorded"}</dd>
                </div>
                <div>
                  <dt>Participant</dt>
                  <dd><PersonIdentity name={p.name} descriptor="Patient" /></dd>
                </div>
                <div><dt>Contact suitability</dt><dd>{p.contact}</dd></div>
                <div><dt>Guardian authority</dt><dd>Not established</dd></div>
                <div><dt>Research participation</dt><dd>Not recorded · separate purpose</dd></div>
                {p.family && (
                  <div>
                    <dt>Family respondent</dt>
                    <dd>
                      <PersonIdentity name={p.family} descriptor="Family carer" />
                      <span className="identity-suffix">own contribution only</span>
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          </div>
        )}
        {tab === "History" && (
          <div className="stack person-record-plain">
            <div className="section-toolbar">
              <div>
                <h2>History</h2>
                <p>
                  Assessment responses and reviews, appointments, contextual events and
                  structured care records in this care episode.
                </p>
              </div>
            </div>
            <ClinicalHistory
              episode={e}
              person={p}
              audit={state.audit}
            />
          </div>
        )}
        {tab === "Change log" && (
          <div className="stack person-record-plain">
            <div className="section-toolbar">
              <div>
                <h2>Change log</h2>
                <p>
                  Field-level record of who changed what in this care episode. Use Show more
                  to view the before and after values.
                </p>
              </div>
            </div>
            <ChangeLog episode={e} person={p} audit={state.audit} />
          </div>
        )}
      </div>
      </div>
    </>
  );
}
