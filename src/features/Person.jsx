import IntakeWorkspace, { IntakePanel } from "./Intake";
import Referrals from "./Referrals";
import { intakeFor, canAssess } from "../intake";
import { overviewNextStep } from "../overview";
import { latestCareEventsByType } from "../careEvents";
import {
  currentCollection,
  compareCollections,
  safeReturnTo,
} from "../workflow";
import { useSearchParams } from "next/navigation";
import { Fragment, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Plus,
  X,
  ChevronDown,
  CheckCircle2,
  FileCheck2,
  CalendarClock,
} from "lucide-react";
import { useStore } from "../store";
import RecordTwo from "./RecordTwo";
import CareEvents from "./CareEvents";
import Appointments from "./Appointments";
import RecordItem from "../components/RecordItem";
import AssessmentCollectionCard from "../components/AssessmentCollectionCard";
import IntakeDetailsModal from "../components/IntakeDetailsModal";
import CareLevelSection from "../components/CareLevelSection";
import ListFilterBar from "../components/ListFilterBar";
import TimelineExpandAll from "../components/TimelineExpandAll";
import { currentCarePeriod, nextDate } from "../carePeriods";
import Timeline, {
  ChangeLog,
  ClinicalHistory,
} from "../components/ActivityTimeline";
import { assessmentTypeGroups, linkedAssessmentScore } from "../assessmentGroups";
import { responseDate } from "../progress";
import { daysAgoLabel } from "../relativeDate";
import {
  age,
  formatDate,
  collectionStatus,
  clinicalReviewStatus,
  formatTimestamp,
  currentStaff,
  noClinicalReviewRequired,
  TODAY,
  PERSON_TAG_OPTIONS,
} from "../model";
import { getQualityIssues, recordCompleteness } from "../dataQuality";
import {
  Button,
  Badge,
  Field,
  FormErrorSummary,
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
  ValidatedForm,
} from "../components/UI";

const hiddenRecordTabs = ["Appointments", "History", "Change log"];

function PersonRecordNavigation({ tabs, value, onChange }) {
  return (
    <div className="person-record-navigation">
      <RecordTabs
        id="person"
        label="Person record"
        items={tabs.filter((item) =>
          !hiddenRecordTabs.includes(typeof item === "string" ? item : item.value)
        )}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

export default function Person({ id, navigate, openModal }) {
  const { state, commit } = useStore();
  const p = state.people.find((p) => p.id === id);
  const searchParams = useSearchParams();
  const [intakeDetailsOpen, setIntakeDetailsOpen] = useState(false);
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState("");
  const [tagError, setTagError] = useState("");
  const [assessmentFilter, setAssessmentFilter] = useState("all");
  const [assessmentQuery, setAssessmentQuery] = useState("");
  const [assessmentMethod, setAssessmentMethod] = useState("all");
  const [groupAssessmentsByType, setGroupAssessmentsByType] = useState(true);
  const [expandedAssessmentTypes, setExpandedAssessmentTypes] = useState([]);
  const assessmentListRef = useRef(null);
  const [consentFilter, setConsentFilter] = useState("all");
  const [consentQuery, setConsentQuery] = useState("");
  const [consentChannel, setConsentChannel] = useState("all");
  const allTabs = [
    "Overview",
    "Assessment",
    { value: "Events", label: "Care events" },
    "Report",
    { value: "Consent & respondents", label: "Consent" },
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
    params.delete("attention");
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
    (searchParams.get("tab") === "appointments" ? "Appointments" : null) ||
    (tabs.map((item) => typeof item === "string" ? item : item.value)
      .find((value) => value.toLowerCase() === searchParams.get("tab"))) ||
    "Overview";
  const tab =
    requestedTab === "Assessment" && !assessmentAvailable
      ? "Overview"
      : requestedTab;
  const hiddenRecordTab = hiddenRecordTabs.includes(tab);
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
  const assessmentStatuses = [...new Set(orderedCollections.map(collectionStatus))];
  const assessmentItems = ["all", ...assessmentStatuses].map((value) => ({
    value,
    label: value === "all" ? "All" : value,
    count: value === "all" ? orderedCollections.length : orderedCollections.filter((col) => collectionStatus(col) === value).length,
  }));
  const visibleCollections = orderedCollections.filter((col) =>
    (assessmentFilter === "all" || collectionStatus(col) === assessmentFilter) &&
    (assessmentMethod === "all" || (col.channel || "Not set up") === assessmentMethod) &&
    `${col.label} ${col.version} ${col.assignment} ${col.response} ${collectionStatus(col)}`
      .toLowerCase().includes(assessmentQuery.trim().toLowerCase()),
  );
  const chronologicalCollections = [...visibleCollections].sort((a, b) =>
    (responseDate(b) || b.due || "").localeCompare(responseDate(a) || a.due || "") ||
    a.id.localeCompare(b.id),
  );
  const firstPastAssessmentIndex = chronologicalCollections.findIndex((col) =>
    (responseDate(col) || col.due || "") <= TODAY,
  );
  const groupedAssessments = assessmentTypeGroups(e, visibleCollections);
  const renderAssessmentCard = (collection, inTimeline = false, headingLevel = 4, initiallyExpanded = inTimeline) => (
    <AssessmentCollectionCard
      key={collection.id}
      collection={collection}
      person={p}
      score={linkedAssessmentScore(e, collection)}
      selectedId={searchParams.get("collection")}
      inTimeline={inTimeline}
      initiallyExpanded={initiallyExpanded}
      headingLevel={inTimeline ? headingLevel : 3}
      onViewDetails={(item) => openModal({
        type: "collection-details",
        personId: p.id,
        episodeId: e.id,
        collectionId: item.id,
      })}
      onReview={openReview}
      onCollect={(item) => openModal({
        type: "collection",
        personId: p.id,
        episodeId: e.id,
        collectionId: item.id,
        channel: item.closureKind ? "SMS link" : "Clinic tablet",
        collectResponse: true,
      })}
    />
  );
  const consentStatuses = [...new Set(consentRequests.map((request) => request.status))];
  const consentItems = ["all", ...consentStatuses].map((value) => ({
    value,
    label: value === "all" ? "All" : value,
    count: value === "all" ? consentRequests.length : consentRequests.filter((request) => request.status === value).length,
  }));
  const visibleConsentRequests = consentRequests.filter((request) =>
    (consentFilter === "all" || request.status === consentFilter) &&
    (consentChannel === "all" || request.channel === consentChannel) &&
    `${request.title} ${request.version} ${request.scope} ${request.status} ${request.channel}`
      .toLowerCase().includes(consentQuery.trim().toLowerCase()),
  );
  const eventSummary = latestCareEventsByType(e);
  const reviewed =
    c.response === "Submitted" &&
    (noClinicalReviewRequired(c) ||
      (c.review === "Reviewed" && !c.needsReview));
  const completeness = recordCompleteness(p, TODAY);
  const requiredDataIssues = getQualityIssues(state, TODAY).filter((issue) =>
    issue.personId === p.id && !["Resolved", "Closed"].includes(issue.status));
  const attentionItems = e.status === "Active" ? [
    ...(e.appointments || [])
      .filter((appointment) => appointment.attendance === "Planned" && appointment.plannedDate && appointment.plannedDate <= TODAY)
      .map((appointment) => ({ id: `appointment-${appointment.id}`, type: "appointment", date: appointment.plannedDate })),
    ...(e.collections || [])
      .filter((collection) => collection.due && collection.due <= TODAY && collection.response !== "Submitted" && !["Cancelled", "Paused"].includes(collection.assignment))
      .map((collection) => ({ id: `assessment-${collection.id}`, type: "assessment", date: collection.due })),
  ] : [];
  const attentionSummary = [
    ["appointment", true, "planned contact", "overdue"],
    ["appointment", false, "planned contact", "today"],
    ["assessment", true, "assessment", "overdue"],
    ["assessment", false, "assessment", "due today"],
  ].map(([type, overdue, label, when]) => {
    const count = attentionItems.filter((item) => item.type === type && (item.date < TODAY) === overdue).length;
    return count ? `${count} ${label}${count === 1 ? "" : "s"} ${when}` : null;
  }).filter(Boolean).join(" · ");
  const attentionOnly = tab === "Events" && searchParams.get("attention") === "1";
  const clearAttention = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("attention");
    navigate(`/people/${p.id}${params.size ? `?${params}` : ""}`, { scroll: false });
  };
  const toggleAttention = () => {
    if (attentionOnly) return clearAttention();
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "events");
    params.set("attention", "1");
    navigate(`/people/${p.id}?${params}`, { scroll: false });
  };
  const currentLevelPeriod = currentCarePeriod(e);
  const canChangeLevel = e.status === "Active" && currentStaff(state)?.role === "Clinician" &&
    (!currentLevelPeriod || nextDate(currentLevelPeriod.startDate) <= TODAY);
  const canEditCareProfile = e.status === "Active" && currentStaff(state)?.role === "Clinician";
  return (
    <>
      <button className="back-link" onClick={() => navigate(returnTo)}>
        <ArrowLeft size={17} />
        Back to {returnLabel}
      </button>
      <div className="person-heading">
        <div>
          <div className="person-heading-title-row">
            <h1 className="person-name-heading"><span>{p.name}</span></h1>
            <div className="person-heading-tags" aria-label="Person tags">
              {(p.tags || []).map((tag) => (
                <span className="person-tag" key={tag}>
                  {tag}
                  {!p.archivedAt && (
                    <button
                      className="person-tag-remove"
                      type="button"
                      aria-label={`Remove ${tag} tag`}
                      onClick={() => {
                        const result = commit({ type: "REMOVE_PERSON_TAG", personId: p.id, tag });
                        if (result.error) {
                          setTagError(result.error);
                          setTagEditorOpen(true);
                        }
                      }}
                    >
                      <X size={11} aria-hidden="true" />
                    </button>
                  )}
                </span>
              ))}
              {!p.archivedAt && (
                <button className="person-tag-add" type="button" aria-label="Add person tag" aria-haspopup="dialog" onClick={() => { setTagError(""); setTagEditorOpen(true); }}>
                  <Plus size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
          <p className="person-heading-details">
            <small className="person-heading-role">Patient</small>
            <span>·</span>
            {p.id}
            <span>·</span>
            {p.dob ? `${age(p.dob)} years` : "Date of birth unknown"}
            <span>·</span>
            {p.pronouns}
            {p.archivedAt && <Badge>Archived</Badge>}
            <TextLink aria-haspopup="dialog" onClick={() => setIntakeDetailsOpen(true)}>
              More info
            </TextLink>
          </p>
        </div>
        <div className="actions">
          <Button
            disabled={e.status !== "Active"}
            onClick={() => modal("episode")}
          >
            Care episode actions
            <ChevronDown size={16} />
          </Button>
        </div>
      </div>
      {e.status !== "Active" && (
        <div className="care-period-status-notice" role="status">
          <Notice tone="amber">
            {e.status === "Completed"
              ? `This period of care ended${e.end ? ` on ${formatDate(e.end)}` : ""}. The closure assessment and care experience feedback are complete.`
              : e.status === "Closed"
              ? `This period of care is closed${e.end ? ` as of ${formatDate(e.end)}` : ""}. Closure assessment and feedback assignments can still be completed here.`
              : "This care episode is paused. Outstanding collections are paused and their links are revoked. Submitted responses remain in the record."}
          </Notice>
        </div>
      )}
      {attentionItems.length > 0 && (
        <button type="button" className="care-event-attention" onClick={toggleAttention}>
          <CalendarClock size={18} aria-hidden="true" />
          <span className="care-event-attention-summary"><strong>Needs attention</strong><span>{attentionSummary}</span></span>
          <span className="care-event-attention-action">
            {attentionOnly ? "Show all records" : `Show ${attentionItems.length} ${attentionItems.length === 1 ? "item" : "items"}`}
          </span>
        </button>
      )}
      {intakeDetailsOpen && (
        <IntakeDetailsModal
          person={p}
          intake={intakeFor(p, e)}
          onClose={() => setIntakeDetailsOpen(false)}
        />
      )}
      {tagEditorOpen && (
        <Modal title="Person tags" subtitle="Add short labels to help identify this record." onClose={() => setTagEditorOpen(false)}>
          <ValidatedForm onSubmit={(event) => {
            event.preventDefault();
            const tag = selectedTag;
            if (!tag) return setTagError("Choose a tag.");
            if ((p.tags || []).some((item) => item.toLowerCase() === tag.toLowerCase())) return setTagError("This tag is already on the record.");
            if ((p.tags || []).length >= 8) return setTagError("A person can have up to eight tags.");
            const result = commit({ type: "ADD_PERSON_TAG", personId: p.id, tag });
            if (result.error) return setTagError(result.error);
            setSelectedTag("");
            setTagError("");
          }}>
            <div className="form-body">
              <Field label="Tag" error={tagError}>
                <select id="person-tag-choice" value={selectedTag} onChange={(event) => { setSelectedTag(event.target.value); setTagError(""); }} autoFocus>
                  <option value="">Choose a tag</option>
                  {PERSON_TAG_OPTIONS.filter((tag) => !(p.tags || []).includes(tag)).map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                </select>
              </Field>
              <div className="person-tag-editor-list">
                {(p.tags || []).map((tag) => (
                  <div className="person-tag-editor-item" key={tag}>
                    <span className="person-tag">{tag}</span>
                    <button type="button" className="text-link" aria-label={`Remove ${tag} tag`} onClick={() => {
                      const result = commit({ type: "REMOVE_PERSON_TAG", personId: p.id, tag });
                      if (result.error) setTagError(result.error);
                    }}>Remove</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer person-tag-editor-actions"><Button type="button" onClick={() => setTagEditorOpen(false)}>Close</Button><Button type="submit" variant="primary">Add tag</Button></div>
            {tagError && <FormErrorSummary title="Tag not added · 1 item to check" description="Correct the tag selection, then try again." items={[{ id: "person-tag-choice", label: "Tag", message: tagError }]} />}
          </ValidatedForm>
        </Modal>
      )}
      <div className="episode-bar">
        <div className="episode-context episode-period">
          {p.episodes.length > 1 ? (
            <>
              <label htmlFor="care-episode">Care episode</label>
              <Select
                id="care-episode"
                label="Care episode"
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
                      : ["Closed", "Completed"].includes(ep.status)
                        ? "end not recorded"
                        : "present"}{" "}
                    · {ep.status}
                  </option>
                ))}
              </Select>
              <small>
                Overview, Report, assessments and history for this episode.
              </small>
            </>
          ) : (
            <>
              <small>
                {e.status === "Active" ? "Current care episode" : `${e.status} care episode`}
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
        <div className="episode-fact episode-care-level">
          <small>{e.programStream ? `${e.programStream} stream` : "Program stream"}</small>
          <div className="episode-care-level-value">
            <span>{(currentLevelPeriod || e.carePeriods?.at(-1))?.careLevel || "Not recorded"}</span>
            {canChangeLevel && (
              <button
                type="button"
                className="episode-care-level-change"
                onClick={() => modal("care-level")}
                aria-label={currentLevelPeriod ? "Edit stream and care level" : "Record starting care level"}
              >
                {currentLevelPeriod ? "Edit stream & care level" : "Record"}
              </button>
            )}
          </div>
        </div>
        <div className="episode-fact episode-completeness">
          <small>Required data</small>
          <button
            type="button"
            className="episode-bar-completeness-link"
            onClick={() => navigate("/quality")}
            aria-label={`Open data quality. ${completeness.requiredPercentage}% of required fields complete. ${requiredDataIssues.length} unresolved data ${requiredDataIssues.length === 1 ? "issue" : "issues"}.`}
          >
            {completeness.requiredPercentage === 100 && requiredDataIssues.length === 0 && (
              <CheckCircle2
                size={15}
                aria-hidden="true"
                className="record-completeness-icon"
              />
            )}
            <span>{completeness.requiredPercentage}%</span>
          </button>
          {requiredDataIssues.length > 0 && (
            <div className="episode-required-issues">
              <button
                type="button"
                className="episode-required-issue-link"
                onClick={() => requiredDataIssues.length === 1
                  ? openModal({ type: "quality-issue", personId: p.id, issueId: requiredDataIssues[0].id })
                  : navigate(`/quality?q=${encodeURIComponent(p.name)}`)}
              >
                {requiredDataIssues.length} data {requiredDataIssues.length === 1 ? "issue" : "issues"}
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="person-content-surface">
      {contextualView === "Referrals" ? (
        <div className="section-toolbar">
          <h2 id="person-context-heading">{contextualView}</h2>
        </div>
      ) : !contextualView ? (
        <PersonRecordNavigation
          tabs={tabs}
          value={tab}
          onChange={setTab}
        />
      ) : null}
      <div
        role={contextualView || hiddenRecordTab ? "region" : "tabpanel"}
        id="person-panel"
        aria-labelledby={
          contextualView === "Referrals"
            ? "person-context-heading"
            : hiddenRecordTab
              ? undefined
              : `person-tab-${tabs.filter((item) => !hiddenRecordTabs.includes(typeof item === "string" ? item : item.value)).findIndex((item) => (typeof item === "string" ? item : item.value) === tab)}`
        }
        aria-label={contextualView === "Intake" ? "Intake information" : hiddenRecordTab ? (tab === "Appointments" ? "Service contacts" : tab) : undefined}
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
            key={`${intakeFor(p, e)?.id}:${intakeFor(p, e)?.revision}:${p.intakeResetToken || "original"}`}
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
        {tab === "Overview" && (
          <>
            <div className="overview-top-row">
            <Panel className="overview-assessment">
              <header className="overview-assessment-heading">
                <div className="overview-assessment-topline">
                  <p className="overview-assessment-label">
                    {["Closed", "Completed"].includes(e.status)
                      ? (c.closureKind ? "Post-closure patient check-in" : "Latest assessment in this period")
                      : "Current assessment"}
                  </p>
                  <Badge>{nextStep.badge}</Badge>
                </div>
                <div className="overview-assessment-title">
                  <h2>{c.label}</h2>
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
                    {c.response === "Submitted" && (!reviewed || noClinicalReviewRequired(c)) && (
                      <Notice>
                        {noClinicalReviewRequired(c)
                          ? "The response is complete; no separate clinical review is required."
                          : "A submitted response still needs clinical review."}
                      </Notice>
                    )}
                    <div className="assessment-preview-action">
                      <TextLink
                        aria-haspopup="dialog"
                        onClick={() => modal("questionnaire-preview")}
                      >
                        Preview questionnaire
                      </TextLink>
                    </div>
                  </section>
                </div>
              </div>
            </Panel>
            <CareLevelSection
              episode={e}
              canEdit={canEditCareProfile}
              openModal={(request) => modal(request.type)}
            />
            </div>
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
                  Separate collection points within care episode {e.number}. Closure assessment and feedback remain linked to this episode after it closes.
                </p>
              </div>
              <Button
                variant="primary"
                disabled={e.status !== "Active" || !canAssess(p, e) || !c.due}
                onClick={() => modal("plan")}
              >
                Plan follow-up
              </Button>
            </div>
            {!c.due && (
              <div>
                <Button onClick={() => setTab("Intake")}>
                  <ArrowLeft size={16} aria-hidden="true" /> Back to Intake
                </Button>
              </div>
            )}
            <ListFilterBar
              id="assessment-status"
              className="assessment-filter-bar"
              label="Assessment status"
              items={assessmentItems}
              value={assessmentFilter}
              onChange={setAssessmentFilter}
              query={assessmentQuery}
              onQueryChange={setAssessmentQuery}
              placeholder="Search assessments"
              shown={visibleCollections.length}
              total={orderedCollections.length}
              noun="assessments"
              activeAdvancedCount={Number(assessmentMethod !== "all")}
              onClear={() => { setAssessmentFilter("all"); setAssessmentQuery(""); setAssessmentMethod("all"); }}
              resultAction={
                <span className="assessment-result-actions">
                  <label className="assessment-group-toggle">
                    <input
                      type="checkbox"
                      role="switch"
                      checked={groupAssessmentsByType}
                      onChange={(event) => {
                        const grouped = event.target.checked;
                        setGroupAssessmentsByType(grouped);
                        setExpandedAssessmentTypes([]);
                      }}
                    />
                    <span className="assessment-group-toggle-track" aria-hidden="true" />
                    <span className="assessment-group-toggle-copy">Group by assessment type</span>
                  </label>
                  <TimelineExpandAll
                    containerRef={assessmentListRef}
                    containerId="assessment-list"
                    itemCount={visibleCollections.length}
                    groupsExpanded={!groupAssessmentsByType || groupedAssessments.every((group) =>
                      expandedAssessmentTypes === null || expandedAssessmentTypes.includes(group.key))}
                    onToggleAll={groupAssessmentsByType ? (expand) => setExpandedAssessmentTypes(expand ? null : []) : undefined}
                  />
                </span>
              }
              advanced={
                <Select label="Collection method" value={assessmentMethod} onChange={(event) => setAssessmentMethod(event.target.value)}>
                  <option value="all">All methods</option>
                  {[...new Set(orderedCollections.map((col) => col.channel || "Not set up"))].map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </Select>
              }
            />
            <div className="assessment-list" id="assessment-list" ref={assessmentListRef}>
              {groupAssessmentsByType
                ? groupedAssessments.map((group, index) => {
                    const expanded = expandedAssessmentTypes === null || expandedAssessmentTypes.includes(group.key);
                    const historyId = `assessment-type-history-${index}`;
                    const submittedDate = responseDate(group.lastDone);
                    return (
                      <article className="assessment-type-card" key={group.key}>
                        <header className="assessment-type-card-heading">
                          <div>
                            <span className="assessment-type-kicker">Assessment type</span>
                            <h3>{group.name}</h3>
                            <p>{group.collections.length} assessment{group.collections.length === 1 ? "" : "s"} in this episode</p>
                          </div>
                          <Badge>{group.lastDone ? collectionStatus(group.lastDone) : "No response yet"}</Badge>
                        </header>
                        <div className="assessment-type-card-summary">
                          <div>
                            <small>Last submitted</small>
                            <strong>{submittedDate ? <time dateTime={submittedDate}>{daysAgoLabel(submittedDate)}</time> : "No dated response"}</strong>
                            <span>{submittedDate ? `${formatDate(submittedDate)} · ${group.lastDone.label}` : "No submitted response with a recorded date"}</span>
                          </div>
                          <div>
                            <small>Raw score</small>
                            <strong>
                              {group.score !== null
                                ? `${group.score}${group.scoreRange ? ` / ${group.scoreRange[1]}` : ""}`
                                : group.measureKey
                                  ? group.lastDone ? "Unavailable" : "Awaiting response"
                                  : "Not scored"}
                            </strong>
                            {group.scoreChange !== null ? (
                              <span
                                className={`assessment-score-change ${group.scoreChange > 0 ? "up" : group.scoreChange < 0 ? "down" : "same"}`}
                                title="Numerical score change only; no clinical interpretation"
                              >
                                {group.scoreChange > 0 ? <ArrowUp size={15} aria-hidden="true" />
                                  : group.scoreChange < 0 ? <ArrowDown size={15} aria-hidden="true" /> : null}
                                {group.scoreChange > 0 ? `+${group.scoreChange}` : group.scoreChange} vs previous raw score
                              </span>
                            ) : (
                              <span>{group.measureKey ? "Linked sample measure result" : "This questionnaire has no clinical score"}</span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="assessment-type-history-toggle"
                          aria-expanded={expanded}
                          aria-controls={historyId}
                          onClick={() => setExpandedAssessmentTypes((current) => {
                            const active = current ?? groupedAssessments.map((item) => item.key);
                            return expanded ? active.filter((key) => key !== group.key) : [...active, group.key];
                          })}
                        >
                          <span>{expanded ? "Hide full timeline" : "Show full timeline"} · {group.collections.length} assessment{group.collections.length === 1 ? "" : "s"}</span>
                          <ChevronDown size={18} aria-hidden="true" />
                        </button>
                        <div id={historyId} className="assessment-type-history" hidden={!expanded}>
                          <p>All assessments of this type in care episode {e.number}, including records outside the current filters.</p>
                          <ol className="assessment-type-timeline">
                            {group.collections.map((col) => {
                              const date = responseDate(col) || col.due;
                              const score = linkedAssessmentScore(e, col);
                              return (
                                <li key={col.id}>
                                  <div className="assessment-type-timeline-meta">
                                    <span>{col.response === "Submitted" ? "Submitted" : "Due"} {formatDate(date)}</span>
                                    {score && <span>Raw score {score.value}{score.range ? ` / ${score.range[1]}` : ""}</span>}
                                  </div>
                                  {renderAssessmentCard(col, true, 4, false)}
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                      </article>
                    );
                  })
                : (
                  <ol className="record-timeline assessment-chronology" aria-label="Assessments in date order">
                    {chronologicalCollections.map((col, index) => {
                      const submittedDate = responseDate(col);
                      const date = submittedDate || col.due;
                      return (
                        <Fragment key={col.id}>
                          {index === firstPastAssessmentIndex && firstPastAssessmentIndex > 0 && (
                            <li className="care-timeline-divider" aria-label="Past and today's assessments begin below">
                              <span>Past &amp; today</span><span className="care-timeline-divider-line" aria-hidden="true" />
                            </li>
                          )}
                          <li className="record-timeline-entry">
                            <time className="record-timeline-date" dateTime={date || undefined}>
                              <span className="record-timeline-date-label">{submittedDate ? "Submitted" : date ? "Due" : "Date not set"}</span>
                              {date && <strong className="record-timeline-when">{formatDate(date)}</strong>}
                            </time>
                            <span className="record-timeline-icon" aria-hidden="true">
                              {submittedDate ? <FileCheck2 size={22} /> : <CalendarClock size={22} />}
                            </span>
                            {renderAssessmentCard(col, true, 3)}
                          </li>
                        </Fragment>
                      );
                    })}
                  </ol>
                )}
            </div>
            {!visibleCollections.length && <Empty title="No assessments match these filters">Try another search or filter.</Empty>}
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
            person={p}
            audit={state.audit}
            attentionIds={attentionItems.map((item) => item.id)}
            attentionOnly={attentionOnly}
            onClearAttention={clearAttention}
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
            <ListFilterBar
              id="consent-status"
              label="Consent request status"
              items={consentItems}
              value={consentFilter}
              onChange={setConsentFilter}
              query={consentQuery}
              onQueryChange={setConsentQuery}
              placeholder="Search consent requests"
              shown={visibleConsentRequests.length}
              total={consentRequests.length}
              noun="requests"
              activeAdvancedCount={Number(consentChannel !== "all")}
              onClear={() => { setConsentFilter("all"); setConsentQuery(""); setConsentChannel("all"); }}
              advanced={
                <Select label="Delivery channel" value={consentChannel} onChange={(event) => setConsentChannel(event.target.value)}>
                  <option value="all">All channels</option>
                  {[...new Set(consentRequests.map((request) => request.channel))].map((channel) => (
                    <option key={channel} value={channel}>{channel}</option>
                  ))}
                </Select>
              }
            />
            {visibleConsentRequests.map((request) => (
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
            {!visibleConsentRequests.length && consentRequests.length > 0 && <Empty title="No consent requests match these filters">Try another search or filter.</Empty>}
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
