import { peopleBundleSummary } from "../people";
import { personWithVisibleContacts } from "../assessmentFeatures.js";
import { COLLECTION_METHOD_OPTIONS, LABELS } from "../terminology.js";
import StandardTable from "../components/StandardTable";
import AssessmentBundleDetails from "../components/AssessmentBundleDetails";
import { QueueRow, QueueCell } from "../components/QueueRow";
import { SortableHeader, useQueueSort } from "../components/QueueControls";
import { sortQueueRows } from "../queueSort";
import NewAssessmentBundle from "../components/NewAssessmentBundle";
import MvpAssessmentSummary from '../components/MvpAssessmentSummary';
import SectionActionHeader from "../components/SectionActionHeader";
import { assessmentBundleGroups } from "../assessmentBundles";
import IntakeWorkspace, { IntakePanel, IntakeAssessmentPanel } from "./Intake";
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
  Info,
  History,
  ArrowLeft,
  ArrowRight,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  FileCheck2,
  FileText,
  CalendarClock,
  CircleAlert,
} from "lucide-react";
import { useStore } from "../store";
import RecordTwo from "./RecordTwo";
import CareEvents from "./CareEvents";
import Appointments from "./Appointments";
import RecordItem from "../components/RecordItem";
import AssessmentCollectionCard from "../components/AssessmentCollectionCard";
import IntakeDetailsModal from "../components/IntakeDetailsModal";
import { CareLevelHistory } from "../components/CareLevelSection";
import ListFilterBar from "../components/ListFilterBar";
import TimelineExpandAll from "../components/TimelineExpandAll";
import { currentCarePeriod, previousDate } from "../carePeriods";
import Timeline, {
  ChangeLog,
  ClinicalHistory,
} from "../components/ActivityTimeline";
import { assessmentScoreLabel, assessmentTypeGroups, linkedAssessmentScore, prioritizeSimpleAssessmentGroups, simpleAssessmentDate } from "../assessmentGroups";
import { assessmentDueByType, assessmentDueLabel, assessmentsWithDueVisibility, earliestPendingAssessment } from "../assessmentDue";
import { responseDate } from "../progress";
import { daysAgoLabel } from "../relativeDate";
import { contactsForAssessment } from "../assessmentContacts";
import { assessmentSchedulingEnabled, assessmentDueDatesEnabled, assessmentContactLinkingEnabled, assessmentSmsEnabled, assessmentBundleGroupingEnabled, assessmentBundleAccordionsEnabled } from "../assessmentFeatures";
import { mvpAssessmentMode, mvpPathwayEnabled, mvpClinicianCreationEnabled, mvpBundleEditingEnabled } from '../mvpAssessmentPathway';
import { episodeReviewSchedule, reviewTiming } from "../episodeReviews";
import { careJourneyForEpisode } from "../ysccModel";
import {
  formatDate,
  displayPersonName,
  collectionStatus,
  clinicalReviewStatus,
  formatTimestamp,
  currentStaff,
  noClinicalReviewRequired,
  canCollectInEpisode,
  TODAY,
  PERSON_TAG_OPTIONS,
} from "../model";
import { getQualityIssues, recordCompleteness } from "../dataQuality";
import { getInstrument, questionnaireState, answerLabel } from "../instruments";
import { patientIdentifier, patientSecondaryDetail } from "../patientIdentity";
import {
  ActionGroup, Button, SplitButton,
  Badge,
  AlertLabel,
  Field,
  FormErrorSummary,
  Panel,
  Select,
  Notice,
  Continuity,
  TextLink,
  TertiaryAction,
  EditAction,
  Empty,
  Modal,
  RecordTabs,
  PersonIdentity,
  Avatar,
  ValidatedForm,
} from "../components/UI";

const hiddenRecordTabs = ["Contact", "History", "Change log"];
const outcomeLockedTabs = ["Assessment", "Events", "Report", "Consent & respondents"];

function PersonRecordNavigation({ tabs, value, onChange }) {
  return (
    <div className="person-record-navigation">
      <RecordTabs
        id="person"
        label="Person record"
        items={tabs}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

export default function Person({ id, navigate, openModal }) {
  const { state, commit } = useStore();
  const mvpAssessments = mvpAssessmentMode(state.settings);
  const highlightMvpReview = mvpPathwayEnabled(state.settings) && state.settings?.mvpReviewHighlight !== false;
  const mvpLedgerShowsReviews = !highlightMvpReview || !mvpClinicianCreationEnabled(state.settings);
  const simpleAssessments = !!state.settings?.simpleAssessments;
  const groupAssessmentsByBundle = assessmentBundleGroupingEnabled(state.settings);
  const bundleAccordions = assessmentBundleAccordionsEnabled(state.settings);
  const scheduleAssessments = assessmentSchedulingEnabled(state.settings);
  const assessmentDueDates = assessmentDueDatesEnabled(state.settings);
  const showDueDates = assessmentDueDates || scheduleAssessments;
  const linkAssessmentAppointments = assessmentContactLinkingEnabled(state.settings);
  const p = personWithVisibleContacts(state.people.find((p) => p.id === id), state.settings);
  const searchParams = useSearchParams();
  const [intakeDetailsOpen, setIntakeDetailsOpen] = useState(false);
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState("");
  const [tagError, setTagError] = useState("");
  const [levelHistoryOpen, setLevelHistoryOpen] = useState(false);
  const [assessmentFilter, setAssessmentFilter] = useState("all");
  const [assessmentQuery, setAssessmentQuery] = useState("");
  const [assessmentMethod, setAssessmentMethod] = useState("all");
  const { sort: bundleSort, toggleSort: toggleBundleSort, setSort: setBundleSort } = useQueueSort({ key: null, direction: "asc" });
  const [newBundleOpen, setNewBundleOpen] = useState(false);
  const [editBundleId, setEditBundleId] = useState(null);
  const [bundleDetailsKey, setBundleDetailsKey] = useState(null);
  const [responseGroup, setResponseGroup] = useState(null);
  const [completedQuery, setCompletedQuery] = useState('');
  const [completedSource, setCompletedSource] = useState('all');
  const [completedRespondent, setCompletedRespondent] = useState('all');
  const [completedFrom, setCompletedFrom] = useState('');
  const [completedTo, setCompletedTo] = useState('');
  const [expandedBundleRows, setExpandedBundleRows] = useState([]);
  const toggleBundleRow = key => setExpandedBundleRows(keys => keys.includes(key) ? keys.filter(value => value !== key) : [...keys, key]);
  const openBundleDetails = key => bundleAccordions ? toggleBundleRow(key) : setBundleDetailsKey(key);
  const [bundleMessage, setBundleMessage] = useState('');
  const [createdBundleId, setCreatedBundleId] = useState(null);
  const groupAssessmentsByType = true;
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
  // Referral links open their workflow outside the record tab bar.
  const contextualView = ["Referrals"].find(
    (view) => view.toLowerCase() === searchParams.get("tab"),
  );
  const setTab = (value) => {
    if (!assessmentAvailable && outcomeLockedTabs.includes(value)) return;
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
      (mvpAssessments ? e.collections.find(col => col.mvpTimepointId && col.response !== 'Submitted') || e.collections.find(col => col.mvpTimepointId) : null) ||
      currentCollection(e),
    nextStep = overviewNextStep(p, e, c, currentStaff(state));
  const overviewStep = !scheduleAssessments ? {
    badge: c.response === "Submitted" ? "Completed" : c.response === "Draft" ? "Draft" : "Not started",
    title: c.response === "Submitted" ? "Instrument completed" : c.response === "Draft" ? "Continue draft" : "Start instrument",
    description: c.response === "Submitted" ? "The completed response is recorded in Assessment."
      : c.response === "Draft" ? "Saved answers are ready to continue." : "This assessment is ready to start.",
    primary: { label: "Open instrument", tab: "Assessment" },
  } : nextStep;
  const reviewSchedule = episodeReviewSchedule(e, TODAY);
  const careJourney = careJourneyForEpisode(p, e.id);
  const episodeIntake = intakeFor(p, e);
  const initialIntake = p.intakes?.find((intake) =>
    intake.episodeId === e.id && intake.outcome === "Proceed");
  const initialAssessmentContacts = initialIntake
    ? (e.appointments || []).filter((appointment) => appointment.assessmentIntakeId === initialIntake.id)
    : [];
  const assessmentAvailable = canAssess(p, e);
  const tabs = assessmentAvailable ? allTabs : allTabs.map((item) => {
    const value = typeof item === "string" ? item : item.value;
    if (!outcomeLockedTabs.includes(value)) return item;
    return {
      value,
      label: typeof item === "string" ? value : item.label,
      disabled: true,
      title: "Available after a Proceed outcome is saved",
    };
  });
  const visibleTabs = tabs.filter((item) => {
    const value = typeof item === "string" ? item : item.value;
    return !hiddenRecordTabs.includes(value) &&
      (!simpleAssessments || value !== "Consent & respondents");
  });
  const requestedTab =
    contextualView ||
    (["progress", "analysis", "record 2"].includes(searchParams.get("tab"))
      ? "Report"
      : null) ||
    (["appointments", "contact"].includes(searchParams.get("tab")) ? "Contact" : null) ||
    (tabs.map((item) => typeof item === "string" ? item : item.value)
      .find((value) => value.toLowerCase() === searchParams.get("tab"))) ||
    "Overview";
  const tab = !assessmentAvailable && outcomeLockedTabs.includes(requestedTab)
    ? "Overview"
    : requestedTab;
  const hiddenRecordTab = hiddenRecordTabs.includes(tab) ||
    (simpleAssessments && tab === "Consent & respondents");
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const returnLabel =
    returnTo.split("?")[0] === "/"
      ? "My work"
      : returnTo.split("?")[0] === "/quality"
        ? "Data quality"
        : "people";
  const pathwayCollections = mvpAssessments
    ? e.collections.filter(record => record.mvpInitialAssessment || record.mvpTimepointId ||
        (mvpClinicianCreationEnabled(state.settings) && record.mvpCreatedAssessment))
    : e.collections;
  const dueByType = assessmentDueByType(pathwayCollections, TODAY);
  const assessmentCollections = assessmentDueDates
    ? assessmentsWithDueVisibility(pathwayCollections, TODAY, dueByType)
    : pathwayCollections;
  const assessmentEpisode = { ...e, collections: assessmentCollections };
  const orderedCollections = [...assessmentCollections].sort(
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
  const collectAssessmentResponse = (record) => {
    const savedBundle = state.settings?.assessmentScheduleRules?.find(item => item.id === (record.bundleId || record.scheduleRuleId));
    const override = e.assessmentBundleSelections?.[savedBundle?.id]?.assessmentOverrides?.[0];
    const collection = savedBundle ? {...record,channel:override?.channel || savedBundle.channel || savedBundle.assessments?.[0]?.channel || record.channel,
      respondent:override?.recipient || savedBundle.recipient || savedBundle.assessments?.[0]?.recipient || record.respondent} : record;
    const openSetup = () => navigate(`/questionnaire?${new URLSearchParams({
      person: p.id, episode: e.id, collection: collection.id, overview: "1",
    })}`);
    if (!canAssess(p, e) || (!collection.due && !collection.scheduleFree) || !getInstrument(collection.version) ||
        collection.response === "Submitted" ||
        ["Cancelled", "Paused"].includes(collection.assignment) ||
        p.consent !== "Recorded" || p.contact !== "Suitable") {
      openSetup();
      return;
    }
    const channel = collection.channel || "Clinic tablet";
    const respondent = collection.respondent || "Person";
    const assistance = collection.assistance ||
      (channel === "Clinician entry" ? "Transcribed" : "Independent");
    if (!getInstrument(collection.version).respondents.includes(respondent) ||
        (channel === "Clinician entry" && currentStaff(state)?.role !== "Clinician")) {
      openSetup();
      return;
    }
    const latestAttempt = collection.attempts?.at(-1);
    const reusableAttempt = collection.assignment === "Active" && collection.link === "Active" &&
      latestAttempt && !latestAttempt.endedAt && latestAttempt.channel === channel &&
      (channel !== "Clinician entry" || latestAttempt.recorderId === currentStaff(state)?.id);
    if (!reusableAttempt) {
      if (linkAssessmentAppointments && collection.externalAppointment &&
          (collection.externalAppointment.date < TODAY || collection.externalAppointment.date > collection.due)) {
        openSetup();
        return;
      }
      const result = commit({
        type: "DELIVER",
        personId: p.id,
        episodeId: e.id,
        collectionId: collection.id,
        channel,
        respondent,
        assistance,
        appointmentId: linkAssessmentAppointments ? collection.appointmentId || null : null,
      });
      if (result.error) {
        openSetup();
        return;
      }
    }
    navigate(`/questionnaire?${new URLSearchParams({
      person: p.id, episode: e.id, collection: collection.id, overview: "1",
    })}`);
  };
  const modal = (type) =>
    type === "review" ? openReview(c) : openModal({ type, ...context });
  const consentRequests = (p.consentRequests || []).filter((request) =>
    assessmentSmsEnabled(state.settings) || request.channel !== "SMS link");
  const episodeConsentRequest = [...(p.consentRequests || [])].reverse().find(request =>
    request.consentId === 'assessment-participation' &&
    (!request.episodeId || request.episodeId === e.id) &&
    (!request.scope || request.scope === 'This care episode' || request.scope === `Care episode ${e.number}`));
  const overviewConsentStatus = ({Recorded:'Accepted', Declined:'Denied', 'Not recorded':'Waiting', 'Not requested':'Waiting', Pending:'Waiting'})[
    episodeConsentRequest?.status || p.consent
  ] || episodeConsentRequest?.status || p.consent || 'Waiting';
  const assessmentState = (col) => col.notRequiredReason ? "Not required" : !scheduleAssessments
    ? col.response === "Submitted" ? "Completed" : col.response === "Draft" ? "Draft" : "Not started"
    : collectionStatus(col);
  const currentMvpTimepointId = orderedCollections.filter(col => col.mvpTimepointId)
    .sort((a, b) => a.due.localeCompare(b.due)).at(-1)?.mvpTimepointId;
  const inMvpActiveTable = col => (mvpClinicianCreationEnabled(state.settings) && col.mvpCreatedAssessment) ||
    (mvpLedgerShowsReviews && !!col.mvpTimepointId && col.mvpTimepointId === currentMvpTimepointId);
  const ledgerCollections = groupAssessmentsByBundle ? orderedCollections.filter(col => mvpAssessments
    ? inMvpActiveTable(col) && assessmentState(col) !== 'Completed'
    : assessmentState(col) !== 'Completed') : orderedCollections;
  const countMvpAssessments = collections => new Set(collections.map(col => col.bundleInstanceId || col.bundleId || col.id)).size;
  const assessmentStatuses = [...new Set(ledgerCollections.map(assessmentState))];
  const assessmentItems = ["all", ...assessmentStatuses].map((value) => ({
    value,
    label: value === "all" ? "All" : value,
    count: mvpAssessments
      ? countMvpAssessments(value === "all" ? ledgerCollections : ledgerCollections.filter(col => assessmentState(col) === value))
      : value === "all" ? ledgerCollections.length : ledgerCollections.filter((col) => assessmentState(col) === value).length,
  }));
  const visibleCollections = orderedCollections.filter((col) =>
    (assessmentFilter === "all" || assessmentState(col) === assessmentFilter) &&
    (mvpAssessments || assessmentMethod === "all" || (col.channel || "Not set up") === assessmentMethod ||
      col.attempts?.some((attempt) => attempt.channel === assessmentMethod)) &&
    (mvpAssessments || `${col.label} ${col.version} ${col.assignment} ${col.response} ${assessmentState(col)} ${groupAssessmentsByBundle ? `${col.bundleName || ''} ${state.settings?.assessmentScheduleRules?.find(rule => rule.id === col.bundleId)?.name || ''}` : ''} ${col.attempts?.map((attempt) => attempt.channel).join(" ") || ""}`
      .toLowerCase().includes(assessmentQuery.trim().toLowerCase())),
  );
  const visibleActiveCollections = mvpAssessments
    ? visibleCollections.filter(col => ledgerCollections.some(record => record.id === col.id))
    : visibleCollections;
  const chronologicalCollections = [...visibleCollections].sort((a, b) =>
    (!scheduleAssessments ? Number(a.response === "Submitted") - Number(b.response === "Submitted") : 0) ||
    (!scheduleAssessments ? simpleAssessmentDate(b) || "" : responseDate(b) || b.due || "")
      .localeCompare(!scheduleAssessments ? simpleAssessmentDate(a) || "" : responseDate(a) || a.due || "") ||
    a.id.localeCompare(b.id),
  );
  const firstPastAssessmentIndex = chronologicalCollections.findIndex((col) => {
    const date = responseDate(col) || (scheduleAssessments ? col.due : null);
    return Boolean(date) && date <= TODAY;
  });
  const groupedAssessments = assessmentTypeGroups(assessmentEpisode, visibleCollections);
  const ledgerGroups = collections => {
    const groups = assessmentBundleGroups(e,collections,state.settings?.assessmentScheduleRules);
    return mvpAssessments ? groups.flatMap(group => group.key === 'individual'
      ? group.records.map(record => ({...group, key:`individual:${record.id}`, name:record.label || getInstrument(record.version)?.name || 'Individual instrument',
          records:[record], legacyIndividual:true}))
      : [group]) : groups;
  };
  const allBundleGroups = groupAssessmentsByBundle ? ledgerGroups(assessmentCollections) : [];
  const overviewBundleSummary = groupAssessmentsByBundle ? peopleBundleSummary({person:p,episode:e,collection:c},state.settings) : null;
  const overviewBundle = overviewBundleSummary && allBundleGroups.find(group => group.key !== 'individual' && !group.legacyIndividual && group.records.some(record => record.id === overviewBundleSummary.collection?.id));
  const upcomingBundle = !!overviewBundle && showDueDates && overviewBundleSummary.due > TODAY;
  const overviewCardStep = overviewBundle ? {
    badge:overviewBundleSummary.status,
    title:overviewBundleSummary.status === 'Completed' ? 'Assessment completed' : upcomingBundle ? 'Upcoming assessment' : overviewBundleSummary.status === 'In progress' ? 'Continue assessment' : 'Start assessment',
    description:overviewBundleSummary.detail,
    primary:{label:'Open assessment',tab:'Assessment'},
  } : overviewStep;
  const selectedBundleGroup = allBundleGroups.find(group => group.key === bundleDetailsKey);
  const deliveryForBundle = group => {
    const template = state.settings?.assessmentScheduleRules?.find(item => item.id === (group.bundleId || group.key));
    const override = e.assessmentBundleSelections?.[group.bundleId || group.key]?.assessmentOverrides?.[0];
    const record = group.records.find(col => col.response !== 'Submitted') || group.records[0];
    const respondentLabel = value => value === 'Family respondent' ? 'Family respondent' : mvpAssessments ? 'Young person' : 'Patient';
    return {
      channel: group.key === 'individual' ? [...new Set(group.records.map(col => col.channel || 'Not set up'))].join(', ')
        : override?.channel || template?.channel || template?.assessments?.[0]?.channel || record?.channel || 'Not set up',
      recipient: group.key === 'individual' ? [...new Set(group.records.map(col => respondentLabel(col.respondent)))].join(', ')
        : respondentLabel(override?.recipient || template?.recipient || template?.assessments?.[0]?.recipient || record?.respondent),
    };
  };
  const bundleGroups = groupAssessmentsByBundle ? ledgerGroups(visibleActiveCollections) : [];
  const bundleRows = allBundleGroups.map(group => {
    const allRecords = allBundleGroups.find(bundle => bundle.key === group.key)?.records || group.records;
    const completedCount = allRecords.filter(col => assessmentState(col) === 'Completed').length;
    const nextDue = showDueDates ? earliestPendingAssessment(allRecords) : null;
    const sharedDue = showDueDates ? nextDue?.due || allRecords.map(col => col.due).filter(Boolean).sort().at(-1) || '' : '';
    const { channel: bundleChannel, recipient: bundleRecipient } = deliveryForBundle({ ...group, records: allRecords });
    return { group, allRecords, completedCount, nextDue, sharedDue, bundleChannel, bundleRecipient,
      completedDate: allRecords.map(responseDate).filter(Boolean).sort().at(-1) || "",
      completedSection: group.key !== 'individual' && allRecords.length > 0 && completedCount === allRecords.length };
  });
  const sortedBundleRows = sortQueueRows(bundleRows, bundleSort, {
    due: row => (row.completedSection ? row.completedDate : row.sharedDue) || (bundleSort.direction === 'asc' ? '\uffff' : ''),
    method: row => row.bundleChannel.toLowerCase(),
    respondent: row => row.bundleRecipient.toLowerCase(),
    completion: row => row.allRecords.length ? row.completedCount / row.allRecords.length : 0,
  });
  const simpleGroupedAssessments = simpleAssessments && groupAssessmentsByType
    ? prioritizeSimpleAssessmentGroups(groupedAssessments, visibleCollections)
    : [];
  const renderAssessmentCard = (collection, inTimeline = false, headingLevel = 4, initiallyExpanded = inTimeline, compactGrouped = false, bundleDueDate = undefined) => (
    <AssessmentCollectionCard
      key={collection.id}
      collection={collection}
      simpleAssessments={simpleAssessments}
      scheduleAssessments={scheduleAssessments}
      showDueDates={showDueDates}
      showDueLabels={assessmentDueDates}
      linkAssessmentAppointments={linkAssessmentAppointments}
      compactGrouped={compactGrouped}
      bundleDueDate={bundleDueDate}
      showBundleDetails={groupAssessmentsByBundle && !inTimeline}
      person={p}
      relatedContacts={[...new Map([
        ...contactsForAssessment(e, collection.id),
        ...(linkAssessmentAppointments && collection.label === "Initial assessment" ? initialAssessmentContacts : []),
      ].map((contact) => [contact.id, contact])).values()]}
      score={linkedAssessmentScore(e, collection)}
      selectedId={searchParams.get("collection")}
      inTimeline={inTimeline}
      initiallyExpanded={initiallyExpanded}
      headingLevel={headingLevel}
      onViewDetails={(item) => openModal({
        type: "collection-details",
        personId: p.id,
        episodeId: e.id,
        collectionId: item.id,
      })}
      onReview={openReview}
      onCollect={collectAssessmentResponse}
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
      .filter((appointment) => (assessmentSmsEnabled(state.settings) || appointment.deliveryMode !== "SMS") && appointment.attendance === "Planned" && appointment.plannedDate && appointment.plannedDate <= TODAY)
      .map((appointment) => ({ id: `appointment-${appointment.id}`, type: "appointment", date: appointment.plannedDate })),
    ...(scheduleAssessments ? e.collections || [] : [])
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
  const displayedLevelPeriod = currentLevelPeriod || e.carePeriods?.at(-1);
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
            <h1 className="person-name-heading"><span>{patientIdentifier(p)}</span></h1>
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
            {patientSecondaryDetail(p) && <><span>·</span>{patientSecondaryDetail(p)}</>}
            <span>·</span>
            {p.pronouns}
            {p.archivedAt && <Badge>Archived</Badge>}
            <TextLink icon={Info} iconPosition="start" aria-haspopup="dialog" onClick={() => setIntakeDetailsOpen(true)}>
              More info
            </TextLink>
          </p>
        </div>
        <ActionGroup className="actions">
          <Button
            disabled={e.status !== "Active"}
            onClick={() => modal("episode")}
          >
            Care episode actions
            <ChevronDown size={16} />
          </Button>
        </ActionGroup>
      </div>
      {e.status !== "Active" && (
        <div className="care-period-status-notice" role="status">
          <Notice>
            {e.status === "Completed"
              ? `This period of care ended${e.end ? ` on ${formatDate(e.end)}` : ""}. The closure assessment and care experience feedback are complete.`
              : e.status === "Closed"
              ? `This period of care is closed${e.end ? ` as of ${formatDate(e.end)}` : ""}. Closure assessment and feedback assignments can still be completed here.`
              : "This care episode is paused. Outstanding collections are paused and their links are revoked. Submitted responses remain in the record."}
          </Notice>
        </div>
      )}
      {requiredDataIssues.length > 0 && (
        <button
          type="button"
          className="care-event-attention person-quality-alert"
          aria-haspopup={requiredDataIssues.length === 1 ? "dialog" : undefined}
          onClick={() => requiredDataIssues.length === 1
            ? openModal({ type: "quality-issue", personId: p.id, issueId: requiredDataIssues[0].id })
            : navigate(`/quality?q=${encodeURIComponent(p.name)}`)}
        >
          <CircleAlert size={20} aria-hidden="true" />
          <span className="care-event-attention-summary">
            <strong>{requiredDataIssues.length === 1 ? "Data quality issue" : `${requiredDataIssues.length} data quality issues`}</strong>
            <span>{requiredDataIssues[0].title}{requiredDataIssues.length > 1 ? ` · ${requiredDataIssues.length - 1} more` : ""}</span>
          </span>
          <span className="care-event-attention-action">
            {requiredDataIssues.length === 1 ? "Manage issue" : "View issues"}
            <ArrowRight size={16} aria-hidden="true" />
          </span>
        </button>
      )}
      {attentionItems.length > 0 && (
        <button type="button" className="care-event-attention" onClick={toggleAttention}>
          <CircleAlert size={20} aria-hidden="true" />
          <span className="care-event-attention-summary"><strong>{attentionItems.length} {attentionItems.length === 1 ? "thing needs" : "things need"} attention</strong><span>{attentionSummary}</span></span>
          <span className="care-event-attention-action">
            {attentionOnly ? "Show all records" : "View all"}
            <ArrowRight size={16} aria-hidden="true" />
          </span>
        </button>
      )}
      {intakeDetailsOpen && (
        <IntakeDetailsModal
          person={p}
          intake={episodeIntake}
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
            <ActionGroup className="modal-footer person-tag-editor-actions"><Button type="button" onClick={() => setTagEditorOpen(false)}>Close</Button><Button type="submit" variant="primary">Add tag</Button></ActionGroup>
            {tagError && <FormErrorSummary title="Tag not added · 1 item to check" description="Correct the tag selection, then try again." items={[{ id: "person-tag-choice", label: "Tag", message: tagError }]} />}
          </ValidatedForm>
        </Modal>
      )}
      <div className={`person-content-surface person-open-surface${tab === "Assessment" ? " assessment-ledger-surface" : ""}`}>
      {contextualView === "Referrals" ? (
        <div className="section-toolbar">
          <h2 id="person-context-heading">{contextualView}</h2>
        </div>
      ) : !contextualView ? (
        <PersonRecordNavigation
          tabs={visibleTabs}
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
              : `person-tab-${visibleTabs.findIndex((item) => (typeof item === "string" ? item : item.value) === tab)}`
        }
        aria-label={hiddenRecordTab ? (tab === "Contact" ? "Contact" : tab) : undefined}
      >
        {!canAssess(p, e) && (
          <Notice tone="amber">
            Intake must be reviewed before further assessment work.{" "}
            <button className="inline-link" onClick={() => setTab("Overview")}>
              Open overview
            </button>
          </Notice>
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
            {!assessmentAvailable && intakeFor(p, e) && (
              <IntakePanel
                key={`${intakeFor(p, e).id}:${intakeFor(p, e).revision}:${p.intakeResetToken || "original"}`}
                person={p}
                intake={intakeFor(p, e)}
                navigate={navigate}
              />
            )}
            <div className="overview-top-row">
            <Panel className="overview-assessment">
              <header className="overview-assessment-heading">
                <div className="overview-assessment-topline">
                  <p className="overview-assessment-label">
                    {overviewBundle ? (["Closed", "Completed"].includes(e.status) || overviewBundleSummary.status === 'Completed' ? 'Latest assessment / review' : upcomingBundle ? 'Upcoming assessment / review' : 'Current assessment / review') : ["Closed", "Completed"].includes(e.status)
                      ? (c.closureKind ? "Post-closure patient check-in" : "Latest instrument in this period")
                      : "Current instrument"}
                  </p>
                </div>
                <div className="overview-assessment-title">
                  <h2>{overviewBundle?.name || c.label}</h2>
                </div>
                {!overviewBundle && scheduleAssessments && !simpleAssessments && <p className="overview-assessment-context">
                  {nextStep.overdueText ? (
                    <>{nextStep.dueDateText} · <span className="status-overdue-text">{nextStep.overdueText}</span></>
                  ) : nextStep.dueText}
                </p>}
              </header>
              <div className="panel-body">
                <div className="overview-assessment-layout">
                  <section className="next-step" aria-label="Next step">
                    <p className="next-step-label">Next step</p>
                    <h3>{overviewCardStep.title}</h3>
                    <p>{overviewCardStep.description}</p>
                    <ActionGroup className="actions">
                      <Button
                        variant="primary"
                        aria-haspopup={
                          overviewCardStep.primary.modal ? "dialog" : undefined
                        }
                        onClick={() =>
                          overviewCardStep.primary.modal
                            ? modal(overviewCardStep.primary.modal)
                            : setTab(overviewCardStep.primary.tab)
                        }
                      >
                        {overviewCardStep.primary.label}
                      </Button>
                    {!overviewBundle && <div className="assessment-preview-action">
                      <TextLink
                        aria-haspopup="dialog"
                        onClick={() => modal("questionnaire-preview")}
                      >
                        Preview instrument
                      </TextLink>
                    </div>}
                    </ActionGroup>
                  </section>
                  <section
                    className="overview-assessment-details"
                    aria-label="Assessment details"
                  >
                    {overviewBundle ? <dl className="metadata">
                      <div><dt>Status</dt><dd><Badge>{overviewBundleSummary.status}</Badge></dd></div>
                      <div><dt>Completion</dt><dd>{overviewBundleSummary.detail.split(' · ')[0]}</dd></div>
                      <div><dt>Instrument</dt><dd className="overview-bundle-instruments">{overviewBundle.records.map(record => <span key={record.id}>{getInstrument(record.version)?.name || record.label}</span>)}</dd></div>
                      {showDueDates && overviewBundleSummary.due && <div><dt>Due</dt><dd>{formatDate(overviewBundleSummary.due)}</dd></div>}
                    </dl> : <dl className="metadata">
                      {!simpleAssessments && <div>
                        <dt>Assessment</dt>
                        <dd>
                          <Badge>{c.assessmentProgress || "In progress"}</Badge>
                        </dd>
                      </div>}
                      <div>
                        <dt>Response</dt>
                        <dd>
                          <Badge>{simpleAssessments ? overviewCardStep.badge : c.response}</Badge>
                        </dd>
                      </div>
                      {!simpleAssessments && <div>
                        <dt>Clinical review</dt>
                        <dd>
                          <Badge>{clinicalReviewStatus(c)}</Badge>
                        </dd>
                      </div>}
                      <div>
                        <dt>Instrument</dt>
                        <dd>{c.version}</dd>
                      </div>
                    </dl>}
                    {!overviewBundle && !simpleAssessments && c.response === "Submitted" && (!reviewed || noClinicalReviewRequired(c)) && (
                      <Notice>
                        {noClinicalReviewRequired(c)
                          ? "The response is complete; no separate clinical review is required."
                          : "A submitted response still needs clinical review."}
                      </Notice>
                    )}
                  </section>
                </div>
              </div>
            </Panel>
            <aside className="overview-side-container" aria-label="Care episode details">
              <div className="overview-info-panel">
                    <div className="episode-bar">
                      <div className="episode-context episode-period">
                        <h2 className="episode-summary-title">
                          {e.status === "Active" ? "Current care episode" : `${e.status} care episode`}
                        </h2>
                        {careJourney?.episodes.length > 1 && (
                          <small>Care journey · Episode {careJourney.episodes.findIndex((item) => item.id === e.id) + 1} of {careJourney.episodes.length}</small>
                        )}
                        {p.episodes.length > 1 && (
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
                        )}
                      </div>
                      <div className="episode-status">
                        <Badge>{e.status}</Badge>
                      </div>
                      <div className="episode-fact episode-started">
                        <small>Started</small>
                        <span>
                          {formatDate(e.start)}
                          {e.end ? ` · Ended ${formatDate(e.end)}` : ""}
                        </span>
                      </div>
                      {simpleAssessments && <div className="episode-fact episode-consent-status">
                        <small>Consent status</small>
                        <span>{overviewConsentStatus}</span>
                      </div>}
                      <div className="episode-fact episode-program-stream">
                        <small>Program stream</small>
                        <span>{e.programStream || "Not recorded"}</span>
                      </div>
                      <div className="episode-fact episode-care-level">
                        <small>{e.status === "Active" ? "Care level" : "Last care level"}</small>
                        <div className="episode-care-level-value">
                          <span>{displayedLevelPeriod?.careLevel || "Not recorded"}</span>
                          {canEditCareProfile && (
                            <EditAction
                              onClick={() => modal("care-level")}
                              aria-label={currentLevelPeriod ? "Edit stream and care level" : "Record starting care level"}
                            >
                              {currentLevelPeriod ? "Edit" : "Record"}
                            </EditAction>
                          )}
                          {e.carePeriods?.length > 0 && (
                            <TertiaryAction icon={History}
                              onClick={() => setLevelHistoryOpen(true)}
                              aria-haspopup="dialog"
                            >
                              History
                            </TertiaryAction>
                          )}
                          {displayedLevelPeriod && (
                            <small className="episode-care-level-context">
                              {displayedLevelPeriod.deliveringUnit} · {formatDate(displayedLevelPeriod.startDate)}
                              {displayedLevelPeriod.endDateExclusive
                                ? `–${formatDate(previousDate(displayedLevelPeriod.endDateExclusive))}`
                                : "–present"}
                            </small>
                          )}
                        </div>
                      </div>
                      <div className="episode-fact episode-next-review">
                        <small>{reviewSchedule.confirmed ? "Next review" : "Proposed next review"}</small>
                        <div className="episode-next-review-value">
                          <span>{reviewSchedule.outcome.due ? formatDate(reviewSchedule.outcome.due) : "Not scheduled"}</span>
                          {reviewSchedule.outcome.due && <small className={reviewSchedule.outcome.due < TODAY ? "status-overdue-text" : undefined}>{reviewTiming(reviewSchedule.outcome.due, TODAY)}</small>}
                        </div>
                      </div>
                      <div className="episode-fact episode-completeness">
                        <small>Required data</small>
                        <div className="episode-completeness-value">
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
                    </div>
              </div>
            </aside>
            </div>
            <div className="person-grid">
              <Panel
                title="Care timeline"
                className="overview-timeline"
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
                className="overview-care-events"
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
                          <TextLink
                            className="overview-event-details"
                            aria-label={`View details for ${label}`}
                            onClick={() =>
                              navigate(
                                `/people/${p.id}?tab=events&event=${event.id}`,
                                { scroll: false },
                              )
                            }
                          >
                            View details
                          </TextLink>
                        </span>
                      ) : (
                        <span className="muted">Not present</span>
                      )}
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel title="People involved" className="overview-people-involved">
                <div className="panel-body">
                  <div className="involved">
                    <Avatar name={p.owner} />
                    <PersonIdentity name={p.owner} descriptor="Care owner" />
                  </div>
                  <div className="involved">
                    <Avatar name={patientIdentifier(p)} />
                    <PersonIdentity name={patientIdentifier(p)} descriptor="Patient" />
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
            {levelHistoryOpen && (
              <Modal title="Care level history" onClose={() => setLevelHistoryOpen(false)}>
                <div className="form-body">
                  <CareLevelHistory episode={e} expanded />
                </div>
                <ActionGroup className="modal-footer">
                  <Button type="button" onClick={() => setLevelHistoryOpen(false)}>Close</Button>
                </ActionGroup>
              </Modal>
            )}
          </>
        )}
        {tab === "Assessment" && (
          <div className="stack">
            {scheduleAssessments && initialIntake && !e.collections?.[0]?.due && (
              <IntakeAssessmentPanel
                person={p}
                intake={initialIntake}
                navigate={navigate}
                onReopen={() => {
                  const result = commit({ type: "REOPEN_INTAKE", personId: p.id, intakeId: initialIntake.id, revision: initialIntake.revision });
                  if (!result.error) setTab("Overview");
                }}
              />
            )}
            <SectionActionHeader
              mvp={mvpAssessments}
              title="Assessment ledger"
              description={mvpAssessments
                ? mvpClinicianCreationEnabled(state.settings) ? 'Initial, 90-day and clinician-created assessments.' : 'Initial and 90-day assessments.'
                : simpleAssessments
                ? `${orderedCollections.length} instruments in care episode ${e.number}. ${showDueDates ? "Records show due dates, drafts and completion." : "Records show creation, drafts and completion."}`
                : `${orderedCollections.length} instruments in care episode ${e.number}. Each is a separate collection point. Closure instruments and feedback stay linked after this episode closes.`}
              action={mvpAssessments ? mvpClinicianCreationEnabled(state.settings) && <Button variant="primary"
                disabled={e.status !== 'Active' || !canAssess(p,e) || !!p.archivedAt || !!p.readOnly || !!e.readOnly}
                onClick={() => setNewBundleOpen(true)}>New assessment</Button> : <ActionGroup className="button-row assessment-ledger-actions">
                {groupAssessmentsByBundle ? <SplitButton
                  label="New assessment"
                  menuLabel="More assessment actions"
                  disabled={e.status !== 'Active' || !canAssess(p,e) || !!p.archivedAt || !!p.readOnly || !!e.readOnly}
                  onClick={() => setNewBundleOpen(true)}
                  items={[{
                    label: scheduleAssessments ? "Schedule instrument" : "New instrument",
                    disabled: e.status !== "Active" || !canAssess(p, e) || (scheduleAssessments && !c.due && !c.scheduleFree),
                    onClick: () => modal("plan"),
                  }]}
                /> : <Button
                  variant="primary"
                  disabled={e.status !== "Active" || !canAssess(p, e) || (scheduleAssessments && !c.due && !c.scheduleFree)}
                  onClick={() => modal("plan")}
                >
                  {scheduleAssessments ? "Schedule instrument" : "New instrument"}
                </Button>}
              </ActionGroup>}
            />
            {highlightMvpReview && <MvpAssessmentSummary person={p} episode={e} settings={state.settings} commit={commit}
              onCollect={collectAssessmentResponse} onShowResponse={setResponseGroup} />}
            {bundleMessage && <p role="status">{bundleMessage}</p>}
            {(newBundleOpen || editBundleId) && <NewAssessmentBundle key={editBundleId || 'new'} editBundleId={editBundleId} person={p} episode={e} onClose={() => {setNewBundleOpen(false);setEditBundleId(null);}} onCreated={(bundleId,message) => {
              setCreatedBundleId(bundleId);setBundleMessage(message);setAssessmentFilter('all');setAssessmentQuery('');setAssessmentMethod('all');
            }} />}
            {highlightMvpReview && mvpClinicianCreationEnabled(state.settings) && <h2 className="mvp-user-assessments-heading">User-created assessments</h2>}
            <ListFilterBar
              id="assessment-status"
              className={`assessment-filter-bar${simpleAssessments ? " assessment-filter-bar-simple" : ""}`}
              label="Instrument status"
              items={assessmentItems}
              value={assessmentFilter}
              onChange={setAssessmentFilter}
              query={assessmentQuery}
              onQueryChange={setAssessmentQuery}
              hideSearchRow={mvpAssessments}
              placeholder={groupAssessmentsByBundle ? "Search assessments or instruments" : "Search instruments"}
              shown={mvpAssessments ? countMvpAssessments(visibleActiveCollections)
                : groupAssessmentsByBundle ? visibleActiveCollections.filter(col=>assessmentState(col) !== "Completed").length : visibleCollections.length}
              total={mvpAssessments ? countMvpAssessments(ledgerCollections) : ledgerCollections.length}
              noun={mvpAssessments ? 'assessments' : 'instruments'}
              activeAdvancedCount={Number(assessmentMethod !== "all")}
              onClear={() => { setAssessmentFilter("all"); setAssessmentQuery(""); setAssessmentMethod("all"); }}
              resultAction={groupAssessmentsByBundle ? null :
                <ActionGroup as="span" className="assessment-result-actions">
                  <TimelineExpandAll
                    containerRef={assessmentListRef}
                    containerId="assessment-list"
                    itemCount={groupAssessmentsByBundle ? bundleGroups.filter(group => group.key === 'individual' || !(allBundleGroups.find(bundle => bundle.key === group.key)?.records || group.records).every(col => assessmentState(col) === 'Completed')).length : simpleAssessments && groupAssessmentsByType ? groupedAssessments.length : visibleCollections.length}
                    detailsSelector={groupAssessmentsByBundle ? ".assessment-active-assessments details.assessment-bundle-group" : simpleAssessments && groupAssessmentsByType ? "details.assessment-simple-group" : undefined}
                    groupsExpanded={groupAssessmentsByBundle || simpleAssessments || !groupAssessmentsByType || groupedAssessments.every((group) =>
                      expandedAssessmentTypes === null || expandedAssessmentTypes.includes(group.key))}
                    onToggleAll={!groupAssessmentsByBundle && !simpleAssessments && groupAssessmentsByType ? (expand) => setExpandedAssessmentTypes(expand ? null : []) : undefined}
                  />
                </ActionGroup>
              }
              advanced={simpleAssessments && !mvpAssessments ? null :
                <Select label={LABELS.collectionMethod} value={assessmentMethod} onChange={(event) => setAssessmentMethod(event.target.value)}>
                  <option value="all">All methods</option>
                  {[...new Set((mvpAssessments ? ledgerCollections : orderedCollections).flatMap((col) => [col.channel || "Not set up", ...(col.attempts || []).map((attempt) => attempt.channel)])
                    .filter((method) => method && (assessmentSmsEnabled(state.settings) || method !== "SMS link")))].map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </Select>
              }
            />
            {responseGroup && <Modal className="assessment-response-viewer" title={`${responseGroup.name} responses`} wide onClose={()=>setResponseGroup(null)}>
              <div className="form-body stack">{responseGroup.records.map(record=>{
                const instrument = getInstrument(record.version);
                const entries = questionnaireState(instrument,record.answers).entries;
                return <section key={record.id}><h3>{instrument?.name || record.label}</h3>
                  <p className="muted">Completed {responseDate(record) ? formatDate(responseDate(record)) : 'date not recorded'}</p>
                  <dl className="metadata">{entries.map(entry=><div key={entry.question.id}><dt>{entry.question.title || entry.question.text}</dt><dd>{answerLabel(entry)}</dd></div>)}</dl>
                </section>;
              })}</div>
              <ActionGroup className="modal-footer"><Button onClick={()=>setResponseGroup(null)}>Close</Button></ActionGroup>
            </Modal>}
            {selectedBundleGroup && <AssessmentBundleDetails group={selectedBundleGroup} episode={e} scheduleAssessments={scheduleAssessments} delivery={deliveryForBundle(selectedBundleGroup)}
              statusFor={assessmentState} showDueDates={showDueDates} hideRequirement={mvpAssessments && !mvpClinicianCreationEnabled(state.settings)}
              onAddInstrument={mvpAssessments && mvpBundleEditingEnabled(state.settings) && selectedBundleGroup.records.some(record=>record.mvpTimepointId || record.mvpInitialAssessment) && !p.archivedAt && !p.readOnly && !e.readOnly && e.status === 'Active' && canAssess(p,e)
                ? version=>commit({type:'CUSTOMIZE_MVP_BUNDLE',operation:'add',personId:p.id,episodeId:e.id,bundleId:selectedBundleGroup.bundleId,version})
                : !mvpAssessments && !p.archivedAt && !p.readOnly && !e.readOnly && e.status === 'Active' && canAssess(p,e) ? version=>commit({type:'ADD_GROUP_INSTRUMENT',personId:p.id,episodeId:e.id,collectionIds:selectedBundleGroup.records.map(record=>record.id),version}) : null}
              onRemoveInstrument={mvpAssessments && mvpBundleEditingEnabled(state.settings) && selectedBundleGroup.records.some(record=>record.mvpTimepointId || record.mvpInitialAssessment) && !p.archivedAt && !p.readOnly && !e.readOnly && e.status === 'Active' && canAssess(p,e)
                ? record=>commit({type:'CUSTOMIZE_MVP_BUNDLE',operation:'remove',personId:p.id,episodeId:e.id,bundleId:selectedBundleGroup.bundleId,collectionId:record.id}) : null}
              onNotRequired={!p.archivedAt && !p.readOnly && !e.readOnly && e.status === 'Active' && canAssess(p,e) && selectedBundleGroup.records.some(record=>record.bundleSource === 'Scheduled' || record.bundleSource === 'System' || record.id?.startsWith('AUTO-') || (record.scheduleAnchor && record.bundleSource !== 'User')) && !selectedBundleGroup.records.every(record=>record.notRequiredReason) ? (reason,postponedDate)=>{commit({type:'MARK_ASSESSMENT_NOT_REQUIRED',personId:p.id,episodeId:e.id,collectionIds:selectedBundleGroup.records.map(record=>record.id),reason,postponedDate});setBundleDetailsKey(null);} : null}
              onArchive={!mvpAssessments && !p.archivedAt && !p.readOnly && !e.readOnly && e.status === 'Active' && canAssess(p,e) && selectedBundleGroup.records.every(record=>record.bundleSource !== 'Scheduled' && record.bundleSource !== 'System' && !record.id?.startsWith('AUTO-') && (!record.scheduleAnchor || record.bundleSource === 'User')) ? record=>{commit({type:'ARCHIVE_ASSESSMENT_GROUP',personId:p.id,episodeId:e.id,collectionIds:record ? [record.id] : selectedBundleGroup.records.map(record=>record.id)});if(!record || selectedBundleGroup.records.length === 1) setBundleDetailsKey(null);} : null}
              assessmentEditor={!mvpAssessments && selectedBundleGroup.key !== 'individual' && !p.archivedAt && !p.readOnly && !e.readOnly && e.status === 'Active' && canAssess(p,e) && state.settings?.assessmentScheduleRules?.some(bundle => bundle.id === (selectedBundleGroup.bundleId || selectedBundleGroup.key))
                ? <NewAssessmentBundle embedded group={selectedBundleGroup} statusFor={assessmentState} key={selectedBundleGroup.key} editBundleId={selectedBundleGroup.bundleId || selectedBundleGroup.key} person={p} episode={e}
                    onClose={() => setBundleDetailsKey(null)} onCreated={(bundleId,message) => {setCreatedBundleId(bundleId);setBundleMessage(message);}} /> : null}
              canEdit={!p.archivedAt && !p.readOnly && !e.readOnly && e.status === 'Active' && canAssess(p,e)}
              onEdit={!mvpAssessments && selectedBundleGroup.key !== 'individual' && state.settings?.assessmentScheduleRules?.some(bundle => bundle.id === (selectedBundleGroup.bundleId || selectedBundleGroup.key))
                ? () => {setEditBundleId(selectedBundleGroup.key);setBundleDetailsKey(null);} : null}
              onClose={() => setBundleDetailsKey(null)} />}
            <div className={`assessment-list${!groupAssessmentsByBundle && !simpleAssessments && groupAssessmentsByType ? " assessment-ledger-list" : ""}${!showDueDates ? " assessment-ledger-no-due" : ""}`} id="assessment-list" ref={assessmentListRef}>
              {groupAssessmentsByBundle ? [false, true].map(completedSection => {
                const completeRows = sortedBundleRows.filter(row=>row.completedSection);
                const isSystem = row=>row.allRecords.some(record=>record.bundleSource === 'Scheduled' || record.bundleSource === 'System' || record.id?.startsWith('AUTO-') || (record.scheduleAnchor && record.bundleSource !== 'User'));
                const sectionRows = sortedBundleRows.filter(row => row.completedSection === completedSection && (completedSection
                  ? (mvpAssessments || !completedQuery.trim() || `${row.group.name} ${row.allRecords.map(record=>getInstrument(record.version)?.name || record.label).join(' ')}`.toLowerCase().includes(completedQuery.trim().toLowerCase())) &&
                    ((mvpAssessments && !mvpClinicianCreationEnabled(state.settings)) || completedSource === 'all' || (completedSource === 'system') === !!isSystem(row)) &&
                    (mvpAssessments || completedRespondent === 'all' || row.bundleRecipient === completedRespondent) &&
                    (mvpAssessments || !completedFrom || row.completedDate >= completedFrom) && (mvpAssessments || !completedTo || (row.completedDate && row.completedDate <= completedTo))
                  : bundleGroups.some(group=>group.key === row.group.key)));
                const displayRows = !completedSection && mvpAssessments && mvpLedgerShowsReviews && !bundleSort.key
                  ? [...sectionRows].sort((a, b) => Number(b.completedSection && b.allRecords.some(record =>
                      record.mvpRespondent === 'Person' && record.mvpTimepointId === currentMvpTimepointId)) -
                    Number(a.completedSection && a.allRecords.some(record =>
                      record.mvpRespondent === 'Person' && record.mvpTimepointId === currentMvpTimepointId)))
                  : sectionRows;
                const columnCount = completedSection ? 5 : mvpAssessments ? 6 : 7;
                if (!mvpAssessments && ((!completedSection && !sectionRows.length) || (completedSection && !completeRows.length))) return null;
                return <section key={String(completedSection)} className="assessment-ledger-section" aria-label={completedSection ? "Completed assessments" : mvpAssessments ? mvpLedgerShowsReviews ? "Assessments" : "User-created assessments" : "Active assessments"}>
                  {completedSection && <><h2>Completed assessments</h2>
                    <ListFilterBar id="completed-assessments" label="Completed assessment source"
                      items={[{value:'all',label:'All',count:completeRows.length},{value:'system',label:'System generated',count:completeRows.filter(isSystem).length},...(mvpClinicianCreationEnabled(state.settings) || !mvpAssessments ? [{value:'user',label:'User created',count:completeRows.filter(row=>!isSystem(row)).length}] : [])]}
                      value={completedSource} onChange={setCompletedSource} query={completedQuery} onQueryChange={setCompletedQuery}
                      hideSearchRow={mvpAssessments} hideTabs={mvpAssessments && !mvpClinicianCreationEnabled(state.settings)}
                      placeholder="Search completed assessments or instruments" shown={sectionRows.length} total={completeRows.length} noun="assessments"
                      activeAdvancedCount={Number(completedRespondent !== 'all') + Number(!!completedFrom) + Number(!!completedTo)}
                      onClear={()=>{setCompletedSource('all');setCompletedQuery('');setCompletedRespondent('all');setCompletedFrom('');setCompletedTo('');}}
                      advanced={<><Select label="Completed assessment respondent" value={completedRespondent} onChange={event=>setCompletedRespondent(event.target.value)}><option value="all">All respondents</option>{[...new Set(completeRows.map(row=>row.bundleRecipient))].map(value=><option key={value} value={value}>{value}</option>)}</Select>
                        <label className="field"><span>Completed from</span><input type="date" value={completedFrom} onChange={event=>setCompletedFrom(event.target.value)}/></label>
                        <label className="field"><span>Completed to</span><input type="date" value={completedTo} onChange={event=>setCompletedTo(event.target.value)}/></label></>}/>
                  </>}
                  <StandardTable className={`assessment-bundle-table${mvpAssessments ? ' assessment-bundle-table-mvp' : ''}`} label={completedSection ? "Completed assessments" : mvpAssessments ? mvpLedgerShowsReviews ? "Assessments" : "User-created assessments" : "Active assessments in this care episode"} columnOrderKey={completedSection ? "yscc-completed-assessment-column-order" : "yscc-assessment-ledger-column-order"}
                compactControls={<Select label="Sort assessments" value={bundleSort.key ? `${bundleSort.key}:${bundleSort.direction}` : 'default'}
                  onChange={event => { const [key, direction] = event.target.value.split(':'); setBundleSort({ key: key === 'default' ? null : key, direction: direction || 'asc' }); }}>
                  <option value="default">Default order</option>
                  <option value="due:asc">{completedSection ? "Completion date" : "Due date"} · earliest first</option><option value="due:desc">{completedSection ? "Completion date" : "Due date"} · latest first</option>
                  {!completedSection && !mvpAssessments && <><option value="method:asc">Collection method · A to Z</option><option value="method:desc">Collection method · Z to A</option></>}
                  <option value="respondent:asc">Respondent · A to Z</option><option value="respondent:desc">Respondent · Z to A</option>
                  <option value="completion:asc">Completion · lowest first</option><option value="completion:desc">Completion · highest first</option>
                </Select>}>
                  <thead><tr>
                    <th scope="col">Assessment name</th><SortableHeader label={completedSection ? "Completion date" : "Due date"} sortKey="due" sort={bundleSort} onSort={toggleBundleSort} />
                    {!completedSection && !mvpAssessments && <SortableHeader label="Collection method" sortKey="method" sort={bundleSort} onSort={toggleBundleSort} />}
                    <SortableHeader label="Respondent" sortKey="respondent" sort={bundleSort} onSort={toggleBundleSort} />
                    {!completedSection && <th scope="col">Status</th>}
                    <SortableHeader label="Completion" sortKey="completion" sort={bundleSort} onSort={toggleBundleSort} /><th scope="col">Actions</th>
                  </tr></thead>
                  <tbody>
                      {!sectionRows.length && <tr><td colSpan={columnCount} className="muted">
                        {completedSection ? completeRows.length ? 'No completed assessments match these filters.' : 'No completed assessments yet.'
                          : ledgerCollections.length ? `No ${mvpAssessments && !mvpLedgerShowsReviews ? 'user-created ' : ''}assessments match these filters.` : `No ${mvpAssessments && !mvpLedgerShowsReviews ? 'user-created ' : ''}assessments yet.`}
                      </td></tr>}
                      {displayRows.flatMap(({ group, allRecords, completedCount, nextDue, sharedDue, completedDate, bundleChannel, bundleRecipient }) => {
                        const expanded = bundleAccordions && expandedBundleRows.includes(group.key);
                        const detailsId = `bundle-row-details-${group.key}`;
                        const detailGroup = { ...group, records: allRecords };
                        const pendingRecord = allRecords.find(col => !col.notRequiredReason && col.response === 'Draft') || allRecords.find(col => !col.notRequiredReason && col.response !== 'Submitted');
                        const rowComplete = allRecords.length > 0 && completedCount === allRecords.length;
                        const displayDate = completedSection ? completedDate : sharedDue;
                        const daysUntilDue = displayDate ? Math.round((Date.parse(displayDate) - Date.parse(TODAY)) / 86400000) : null;
                        const dueDaysLabel = daysUntilDue === null ? '' : daysUntilDue === 0 ? 'Today'
                          : `${Math.abs(daysUntilDue)} ${Math.abs(daysUntilDue) === 1 ? 'day' : 'days'}${daysUntilDue < 0 ? completedSection ? ' ago' : ' overdue' : ' away'}`;
                        const dueAlert = !completedSection && rowComplete ? null : nextDue && assessmentDueLabel(nextDue, TODAY);
                        const hasDraft = allRecords.some(record => record.response === 'Draft' || record.response === 'In progress');
                        const systemCreated = allRecords.some(record => record.bundleSource === 'Scheduled' || record.bundleSource === 'System' || record.id?.startsWith('AUTO-') || (record.scheduleAnchor && record.bundleSource !== 'Manual'));
                        const bundleStatus = allRecords.every(record=>record.notRequiredReason) ? 'not-required' : allRecords.length > 0 && completedCount === allRecords.length ? 'completed'
                          : dueAlert === 'Past due' ? 'overdue'
                          : nextDue && daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 7 ? 'due-soon'
                          : hasDraft || completedCount > 0 ? 'in-progress'
                          : systemCreated ? 'new' : 'not-started';
                        const bundleStatusLabel = {'not-required':'Not required',completed:'Completed',overdue:'Overdue','due-soon':'Due soon','in-progress':'In progress',new:'New · created by system','not-started':'Not started'}[bundleStatus];
                        return [<QueueRow key={group.key} className={expanded ? 'assessment-bundle-row-expanded' : ''} onClick={event => {if (!event.target.closest('button, a')) openBundleDetails(group.key);}}>
                            <QueueCell label="Assessment name" slot="subject"><div className="assessment-bundle-name-status">
                              <button type="button" className="name-link assessment-bundle-table-name"
                              aria-label={bundleAccordions ? `${expanded ? 'Collapse' : 'Expand'} details for ${group.name}` : `View details for ${group.name}`}
                              aria-expanded={bundleAccordions ? expanded : undefined} aria-controls={bundleAccordions ? detailsId : undefined}
                              aria-haspopup={bundleAccordions ? undefined : 'dialog'}
                              onClick={event => {event.stopPropagation();openBundleDetails(group.key);}}>{bundleAccordions && <ChevronRight size={16} aria-hidden="true" />}{group.name}</button></div>
                              {(!mvpAssessments || mvpClinicianCreationEnabled(state.settings)) &&
                                <small>{systemCreated ? 'System generated' : 'User created'}</small>}
                            </QueueCell>
                            <QueueCell label={completedSection ? "Completion date" : "Due date"} slot="summary">{displayDate ? <><time dateTime={displayDate}>{formatDate(displayDate)}</time><small className={!completedSection && daysUntilDue < 0 ? 'assessment-overdue-days' : undefined}>{dueDaysLabel}</small>
                              {dueAlert && dueAlert !== 'Past due' && <AlertLabel tone="attention">{dueAlert}</AlertLabel>}</>
                              : <span className="muted">{completedSection ? "Not recorded" : "Not scheduled"}</span>}</QueueCell>
                            {!completedSection && !mvpAssessments && <QueueCell label="Collection method" slot="method">{bundleChannel}</QueueCell>}<QueueCell label="Respondent" slot="respondent">{bundleRecipient}</QueueCell>
                            {!completedSection && <QueueCell label="Status" slot="status"><Badge tone={{completed:'green',overdue:'coral','due-soon':'amber','in-progress':'blue',new:'purple','not-started':'neutral'}[bundleStatus]}>{bundleStatus === 'new' ? 'New' : bundleStatusLabel}</Badge></QueueCell>}
                            <QueueCell label="Completion" slot="metric"><div className="people-completeness-summary"><strong>{completedCount} / {allRecords.length}</strong>
                              <span className={`people-completeness-bar${completedCount === allRecords.length ? " complete-100" : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={allRecords.length || 1} aria-valuenow={completedCount}
                                aria-label={`${group.name}: ${completedCount} of ${allRecords.length} instruments completed`}>
                                <span style={{width:`${allRecords.length ? completedCount / allRecords.length * 100 : 0}%`}} />
                              </span>
                            </div></QueueCell>
                            <QueueCell label="Actions" slot="action"><ActionGroup className="assessment-bundle-table-actions">
                              {completedSection || rowComplete ? <Button variant="secondary" aria-label={`Show response for ${group.name}`} onClick={()=>setResponseGroup(detailGroup)}>Show response</Button> : <Button variant="secondary" disabled={!pendingRecord || !canAssess(p,e) || (mvpAssessments && pendingRecord?.respondent === 'Family respondent' && !p.family)}
                                aria-label={`Collect response for ${group.name}`}
                                onClick={() => collectAssessmentResponse(pendingRecord)}>Collect response</Button>}
                            </ActionGroup></QueueCell>
                          </QueueRow>, ...(expanded ? [<tr key={`${group.key}-details`} className="assessment-bundle-details-row"><td colSpan={columnCount}>
                            <div id={detailsId} role="region" aria-label={`Details for ${group.name}`}>
                              <AssessmentBundleDetails embedded group={detailGroup} episode={e} scheduleAssessments={scheduleAssessments}
                                delivery={deliveryForBundle(detailGroup)} statusFor={assessmentState} showDueDates={showDueDates}
                                hideRequirement={mvpAssessments && !mvpClinicianCreationEnabled(state.settings)}
                                onClose={() => toggleBundleRow(group.key)}
                                onAddInstrument={mvpAssessments && mvpBundleEditingEnabled(state.settings) && group.records.some(record=>record.mvpTimepointId || record.mvpInitialAssessment) && !p.archivedAt && !p.readOnly && !e.readOnly && e.status === 'Active' && canAssess(p,e)
                                  ? version=>commit({type:'CUSTOMIZE_MVP_BUNDLE',operation:'add',personId:p.id,episodeId:e.id,bundleId:group.bundleId,version}) : null}
                                onRemoveInstrument={mvpAssessments && mvpBundleEditingEnabled(state.settings) && group.records.some(record=>record.mvpTimepointId || record.mvpInitialAssessment) && !p.archivedAt && !p.readOnly && !e.readOnly && e.status === 'Active' && canAssess(p,e)
                                  ? record=>commit({type:'CUSTOMIZE_MVP_BUNDLE',operation:'remove',personId:p.id,episodeId:e.id,bundleId:group.bundleId,collectionId:record.id}) : null}
                                assessmentEditor={!mvpAssessments && group.key !== 'individual' && !p.archivedAt && !p.readOnly && !e.readOnly && e.status === 'Active' && canAssess(p,e) && state.settings?.assessmentScheduleRules?.some(bundle => bundle.id === (group.bundleId || group.key))
                                  ? <NewAssessmentBundle embedded group={detailGroup} statusFor={assessmentState} editBundleId={group.bundleId || group.key} person={p} episode={e}
                                      onClose={() => toggleBundleRow(group.key)} onCreated={(bundleId,message) => {setCreatedBundleId(bundleId);setBundleMessage(message);}} /> : null} />
                            </div>
                          </td></tr>] : [])];
                      })}
                    </tbody>
                  </StandardTable>
                </section>;
              }) : simpleAssessments && groupAssessmentsByType
                ? <div className="stack">
                  {simpleGroupedAssessments.length > 0 && <div className="assessment-simple-columns" aria-hidden="true">
                    <span /><span>Assessment type</span>
                    <span className="assessment-simple-columns-meta"><span>Records &amp; status</span><span>Latest score</span></span>
                  </div>}
                  {simpleGroupedAssessments.map((group) => {
                    const records = group.records;
                    const statusCounts = [...new Set(records.map(assessmentState))].map((status) =>
                      ({ status, count: records.filter((col) => assessmentState(col) === status).length }))
                      .filter(({ count }) => count > 0);
                    const latestScore = group.lastDone
                      ? assessmentScoreLabel(linkedAssessmentScore(e, group.lastDone))
                      : "Not scored";
                    const nextDue = dueByType.get(group.key);
                    return <details className="assessment-simple-group" key={`${assessmentFilter}:${assessmentQuery}:${group.key}`} open={assessmentFilter !== "all" || !!assessmentQuery.trim()}>
                      <summary className="assessment-simple-group-header">
                        <ChevronDown size={18} aria-hidden="true" />
                        <div className="assessment-simple-group-title">
                          <h3>{group.collections.length === 1 ? group.collections[0].label : group.name}</h3>
                          {assessmentDueDates && nextDue && <span className="assessment-simple-group-due">
                            <span>Next due <time dateTime={nextDue.due}>{formatDate(nextDue.due)}</time></span>
                            {nextDue.due <= TODAY && <AlertLabel tone={nextDue.due < TODAY ? "danger" : "attention"}>{assessmentDueLabel(nextDue, TODAY)}</AlertLabel>}
                          </span>}
                        </div>
                        <span className="assessment-simple-group-meta">
                          <span className="assessment-simple-group-count">
                            {statusCounts.map(({ status, count }) =>
                              <Badge key={status} tone={status === "Draft" ? "purple" : status === "Completed" ? "green" : "neutral"}>{count} {status}</Badge>)}
                          </span>
                          <span className="assessment-simple-group-score">Latest score <strong>{latestScore}</strong></span>
                        </span>
                      </summary>
                      <div className="assessment-simple-group-records">
                        {records.map((col) => renderAssessmentCard(col, false, 4, false, true))}
                      </div>
                    </details>;
                  })}</div>
                : groupAssessmentsByType
                ? <>
                  {groupedAssessments.length > 0 && (
                    <div className="assessment-ledger-columns" aria-hidden="true">
                      <span /><span>Assessment type</span><span>Status</span><span>Latest submitted</span><span>Latest score</span>{showDueDates && <span>Next due</span>}
                    </div>
                  )}
                  {groupedAssessments.map((group, index) => {
                    const expanded = expandedAssessmentTypes === null || expandedAssessmentTypes.includes(group.key);
                    const historyId = `assessment-type-history-${index}`;
                    const submittedDate = responseDate(group.lastDone);
                    const nextDue = assessmentDueDates ? dueByType.get(group.key) : group.collections
                      .filter((col) => col.due && col.response !== "Submitted" &&
                        !["Paused", "Cancelled"].includes(col.assignment))
                      .sort((a, b) => a.due.localeCompare(b.due) || a.id.localeCompare(b.id))[0];
                    const firstPastHistoryIndex = group.collections.findIndex((col) => {
                      const date = responseDate(col) || (scheduleAssessments ? col.due : null);
                      return Boolean(date) && date <= TODAY;
                    });
                    return (
                      <article className={`assessment-ledger-row${showDueDates && nextDue?.due < TODAY ? " assessment-ledger-row-overdue" : ""}`} key={group.key}>
                        <button
                          type="button"
                          className="assessment-ledger-expand"
                          aria-label={`${expanded ? "Hide" : "Show"} full timeline for ${group.name}, ${group.collections.length} instruments`}
                          aria-expanded={expanded}
                          aria-controls={historyId}
                          onClick={() => setExpandedAssessmentTypes((current) => {
                            const active = current ?? groupedAssessments.map((item) => item.key);
                            return expanded ? active.filter((key) => key !== group.key) : [...active, group.key];
                          })}
                        >
                          <ChevronRight size={18} aria-hidden="true" />
                        </button>
                        <header className="assessment-ledger-type">
                          <span className="assessment-ledger-icon" aria-hidden="true">{group.measureKey ? <FileCheck2 size={19} /> : <CalendarClock size={19} />}</span>
                          <span>
                            <h3>{group.name}</h3>
                            <small>{group.collections.length} instrument{group.collections.length === 1 ? "" : "s"} in this episode</small>
                          </span>
                        </header>
                        <div className="assessment-ledger-status">
                          <small className="assessment-ledger-mobile-label">Status</small>
                          <Badge>{group.lastDone ? collectionStatus(group.lastDone) : "No response yet"}</Badge>
                        </div>
                        <div className="assessment-ledger-submitted">
                          <small className="assessment-ledger-mobile-label">Latest submitted</small>
                          <strong>{submittedDate ? <time dateTime={submittedDate}>{formatDate(submittedDate)}</time> : "No dated response"}</strong>
                          <small>{submittedDate ? daysAgoLabel(submittedDate) : "No dated submission"}</small>
                        </div>
                        <div className="assessment-ledger-score">
                          <small className="assessment-ledger-mobile-label">Latest score</small>
                          <strong>{group.score !== null
                            ? `${group.score}${group.scoreRange ? ` / ${group.scoreRange[1]}` : ""}`
                            : "Not scored"}</strong>
                          {group.scoreChange !== null ? (
                            <small
                              className={`assessment-ledger-score-change${group.scoreChange > 0 ? " is-positive" : group.scoreChange < 0 ? " is-negative" : ""}`}
                              title="Numerical score change only; no clinical interpretation"
                            >
                              {group.scoreChange > 0 ? `+${group.scoreChange}` : group.scoreChange} vs previous raw score
                            </small>
                          ) : <small>{group.measureKey ? "Linked sample measure result" : "This instrument has no clinical score"}</small>}
                        </div>
                        {showDueDates && <div className="assessment-ledger-due">
                          <small className="assessment-ledger-mobile-label">Next due</small>
                            {nextDue ? (
                              <>
                                <strong className={nextDue.due < TODAY ? "status-overdue-text" : undefined}>
                                  {assessmentDueDates ? (assessmentDueLabel(nextDue, TODAY) ? `${assessmentDueLabel(nextDue, TODAY)} · ` : "") : nextDue.due < TODAY ? "Overdue · " : ""}<time dateTime={nextDue.due}>{formatDate(nextDue.due)}</time>
                                </strong>
                                <small>{nextDue.label}</small>
                              </>
                            ) : (
                              <>
                                <strong className="assessment-ledger-unscheduled">{assessmentDueDates ? "No upcoming due date" : "To be scheduled"}</strong>
                                {scheduleAssessments && e.status === "Active" && canAssess(p, e) && c.due && (
                                  <button
                                    type="button"
                                    className="assessment-type-plan-link"
                                    onClick={() => openModal({
                                      type: "plan",
                                      ...context,
                                      initialInstrumentVersion: group.collections[0]?.version,
                                    })}
                                  >
                                    Plan follow-up
                                  </button>
                                )}
                              </>
                            )}
                        </div>}
                        <div id={historyId} className="assessment-type-history" hidden={!expanded}>
                          <p>All instruments of this type in care episode {e.number}, including records outside the current filters.</p>
                          <ol className="assessment-type-timeline">
                            {group.collections.map((col, historyIndex) => {
                              const date = responseDate(col) || (scheduleAssessments ? col.due : col.createdAt?.slice(0, 10));
                              return (
                                <Fragment key={col.id}>
                                  {historyIndex === firstPastHistoryIndex && historyIndex > 0 && (
                                    <li className="care-timeline-divider" aria-label="Past and today's instruments begin below">
                                      <span>Past &amp; today</span><span className="care-timeline-divider-line" aria-hidden="true" />
                                    </li>
                                  )}
                                  <li>
                                    <div className="assessment-type-timeline-meta">
                                      <span>{col.response === "Submitted" ? "Submitted" : scheduleAssessments ? "Due" : "Created"} {formatDate(date)}</span>
                                    </div>
                                    {renderAssessmentCard(col, true, 4)}
                                  </li>
                                </Fragment>
                              );
                            })}
                          </ol>
                        </div>
                      </article>
                    );
                  })}
                  </>
                : (
                  <ol className="record-timeline assessment-chronology" aria-label="Instruments in date order">
                    {chronologicalCollections.map((col, index) => {
                      const submittedDate = responseDate(col);
                      const savedDate = col.response === "Draft" ? col.attempts?.at(-1)?.savedAt?.slice(0, 10) : null;
                      const date = !scheduleAssessments ? simpleAssessmentDate(col) : submittedDate || col.due;
                      return (
                        <Fragment key={col.id}>
                          {!simpleAssessments && index === firstPastAssessmentIndex && index > 0 && (
                            <li className="care-timeline-divider" aria-label="Past and today's instruments begin below">
                              <span>Past &amp; today</span><span className="care-timeline-divider-line" aria-hidden="true" />
                            </li>
                          )}
                          <li className="record-timeline-entry">
                            <time className="record-timeline-date" dateTime={date || undefined}>
                              <span className="record-timeline-date-label">{!scheduleAssessments
                                ? submittedDate ? "Completed" : savedDate ? "Draft" : date ? "Created" : "Date not recorded"
                                : submittedDate ? "Submitted" : date ? "Due" : "Date not set"}</span>
                              {date && <strong className="record-timeline-when">{formatDate(date)}</strong>}
                            </time>
                            <span className="record-timeline-icon" aria-hidden="true">
                              {submittedDate ? <FileCheck2 size={22} /> : !scheduleAssessments ? <FileText size={22} /> : <CalendarClock size={22} />}
                            </span>
                            {renderAssessmentCard(col, true, 3)}
                          </li>
                        </Fragment>
                      );
                    })}
                  </ol>
                )}
            </div>
            {!visibleCollections.length && <Empty title="No instruments match these filters">Try another search or filter.</Empty>}
          </div>
        )}
        {tab === "Contact" && (
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
                <Select label={LABELS.deliveryMethod} value={consentChannel} onChange={(event) => setConsentChannel(event.target.value)}>
                  <option value="all">All delivery methods</option>
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
                  <dd><PersonIdentity name={patientIdentifier(p)} descriptor="Patient" /></dd>
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
                  Assessment responses and reviews, contacts, contextual events and
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
