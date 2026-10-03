import { displayMeasureVersion } from '../terminology.js';
import { episodeWithVisibleContacts } from "../assessmentFeatures.js";
import { LABELS, COLLECTION_METHOD_OPTIONS, collectionMethodLabel } from "../terminology.js";
import { RegisterPerson } from "../features/Intake";
import { ReferralForm } from "../features/Referrals";
import { canAssess } from "../intake";
import { collectionSetupLabel } from "../overview";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  MessageSquare,
  Tablet,
  ClipboardPen,
  Check,
  ShieldCheck,
  Eye,
  Copy,
} from "lucide-react";
import { useStore } from "../store";
import {
  TODAY,
  formatDate,
  DEMO_STAFF,
  currentStaff,
  reducer,
  qualityResolutionError,
  displayPersonName,
  displayFamilyName,
  CONSENT_LIBRARY,
  canCollectInEpisode,
  uid,
} from "../model";
import { INSTRUMENTS, INSTRUMENT_GROUPS, STANDARD_INSTRUMENTS, getInstrument } from "../instruments";
import {
  ActionGroup, Modal,
  Field,
  Button,
  Notice,
  Select,
  Badge,
  StaffPicker,
  Checkbox,
  RadioInput,
  ValidatedForm,
} from "./UI";
import CollectionDetails from "./CollectionDetails";
import InstrumentPreview from "./InstrumentPreview";
import InstrumentLibrary from "./InstrumentLibrary";
import EditResponses from "./EditResponses";
import ReviewResponses from "./ReviewResponses";
import ClinicianQuestionnaire from "./ClinicianQuestionnaire";
import BundleQuestionnaire from "./BundleQuestionnaire";
import CareTimelineEntryForm, { NEW_RECORD_TYPES, recordCategoryLabel } from "./CareTimelineEntryForm";
import AppointmentSlotPicker from "./AppointmentSlotPicker";
import { addDays } from "../externalAppointmentSlots";
import { contactsForAssessment } from "../assessmentContacts";
import { assessmentSchedulingEnabled, assessmentDueDatesEnabled, assessmentContactLinkingEnabled, assessmentSmsEnabled, assessmentModalityEnabled, assessmentBundleGroupingEnabled } from "../assessmentFeatures";
import { asBundle, bundleName, bundleAgeMatches, instrumentSupportsRespondent } from "../assessmentBundles";
import CareEventForm from "./CareEventForm";
import AppointmentForm from "./AppointmentForm";
import AppointmentOutcomeForm from "./AppointmentOutcomeForm";
import CareLevelForm from "./CareLevelForm";
import { carePeriodError } from "../carePeriods";
import ClinicalRecordForm from "./ClinicalRecordForm";
import QualityIssueForm from "./QualityIssueForm";
const COLLECTION_METHOD_PRESENTATION = {
  "Clinician entry": ["Complete the measure in your workspace", ClipboardPen],
  "Clinic tablet": ["In-person device handover", Tablet],
  "SMS link": ["Account-free sample link", MessageSquare],
};
const formValues = (e) => Object.fromEntries(new FormData(e.currentTarget));
const suggestedAssessmentName = (collections = [], version) => {
  const instrumentName = getInstrument(version)?.name || "Measure";
  const existingNames = new Set(collections.map((collection) => collection.label?.trim()));
  if (!collections.some((collection) => collection.version === version) &&
      !existingNames.has(instrumentName)) return instrumentName;

  const followUpName = `${instrumentName} · follow-up`;
  if (!existingNames.has(followUpName)) return followUpName;
  let number = 2;
  while (existingNames.has(`${followUpName} ${number}`)) number += 1;
  return `${followUpName} ${number}`;
};
export default function Forms({
  modal,
  onClose,
  openModal,
  navigate,
  startQuestionnaire,
  startConsentRequest,
  notify,
}) {
  const { state, dispatch, commit } = useStore();
  const simpleAssessments = !!state.settings?.simpleAssessments;
  const scheduleAssessments = assessmentSchedulingEnabled(state.settings);
  const linkAssessmentAppointments = assessmentContactLinkingEnabled(state.settings);
  const assessmentSms = assessmentSmsEnabled(state.settings);
  const assessmentModality = assessmentModalityEnabled(state.settings);
  const showPlanChannel = scheduleAssessments || assessmentModality;
  const staff = currentStaff(state);
  const p = state.people.find((person) => person.id === modal.personId),
    e = episodeWithVisibleContacts(p?.episodes.find((episode) => episode.id === modal.episodeId), state.settings),
    c = e?.collections.find((collection) => collection.id === modal.collectionId);
  const planningInitialAssessment = e?.collections.some((collection) =>
    collection.label === "Initial assessment" && collection.response !== "Submitted");
  const [channel, setChannel] = useState(
      (() => {
        const saved = modal.collectionDraft?.channel || modal.channel || c?.channel;
        return saved && (saved !== "SMS link" || assessmentSms) ? saved : "Clinic tablet";
      })(),
    ),
    [respondent, setRespondent] = useState(
      modal.collectionDraft?.respondent || c?.respondent || "Person",
    ),
    [assistance, setAssistance] = useState(
      modal.collectionDraft?.assistance ||
        c?.assistance ||
        ((modal.channel || c?.channel) === "Clinician entry" && c?.respondent !== "Clinician" ? "Transcribed" : "Independent"),
    ),
    [name, setName] = useState(""),
    [episodeAction, setEpisodeAction] = useState("Paused"),
    [previewOpen, setPreviewOpen] = useState(false);
  const [collectionExternalSlot, setCollectionExternalSlot] = useState(undefined);
  const [responseContactId, setResponseContactId] = useState("");
  const [planDue, setPlanDue] = useState(addDays(TODAY, 14));
  const [planChannel, setPlanChannel] = useState(
    !scheduleAssessments && assessmentModality && staff?.role === "Clinician"
      ? "Clinician entry" : scheduleAssessments && assessmentSms ? "SMS link" : "Clinic tablet",
  );
  const [planRespondent, setPlanRespondent] = useState("Person");
  const [planAssistance, setPlanAssistance] = useState(
    !scheduleAssessments && assessmentModality && staff?.role === "Clinician" ? "Transcribed" : "Independent",
  );
  const [planExternalSlot, setPlanExternalSlot] = useState(null);
  const [plannedCollectionId] = useState(() => uid());
  const [copyFeedback, setCopyFeedback] = useState("");
  const [messageTemplate, setMessageTemplate] = useState(() =>
    localStorage.getItem("yscc-message-template") ||
    "Your care team has invited you to complete a short check-in. Open your secure request to see what it involves and get help if you need it.\n\n[Scoped measure link]"
  );
  const [formError, setFormError] = useState("");
  const [handoverStatus, setHandoverStatus] = useState("Not applicable");
  const [resolution, setResolution] = useState("Confirmed unchanged");
  const [instrumentVersion, setInstrumentVersion] = useState(
    INSTRUMENTS.some((instrument) => instrument.version === modal.initialInstrumentVersion)
      ? modal.initialInstrumentVersion
      : STANDARD_INSTRUMENTS[0].version,
  );
  const [assessmentName, setAssessmentName] = useState(() =>
    suggestedAssessmentName(e?.collections, instrumentVersion));
  const [assessmentBundleId, setAssessmentBundleId] = useState("");
  const groupAssessmentsByBundle = assessmentBundleGroupingEnabled(state.settings);
  const availableAssessmentBundles = p
    ? (state.settings?.assessmentScheduleRules || []).map(asBundle)
      .filter(bundle => bundle.enabled && bundleAgeMatches(bundle, p, TODAY))
    : [];
  const [assessmentNameEdited, setAssessmentNameEdited] = useState(false);
  const selectedInstrument = getInstrument(instrumentVersion);
  const previewTrigger = useRef(null);
  const planPickerRef = useRef(null);
  const planSmsRef = useRef(null);
  const collectionPickerRef = useRef(null);
  const scrollToPicker = (ref) => {
    requestAnimationFrame(() => {
      ref.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
  };
  const wasPreviewOpen = useRef(false);
  useEffect(() => {
    if (wasPreviewOpen.current && !previewOpen) previewTrigger.current?.focus();
    wasPreviewOpen.current = previewOpen;
  }, [previewOpen]);
  const selectedCollectionExternalSlot = collectionExternalSlot === undefined
    ? c?.externalAppointment || null
    : collectionExternalSlot;
  const sampleQuestionnaireLink = modal.type === "plan" && p && e
    ? `${window.location.origin}/questionnaire?${new URLSearchParams({ person: p.id, episode: e.id, collection: plannedCollectionId })}`
    : "";
  const plannedSmsDate = planDue ? addDays(planDue, -5) : "";
  const unresolvedReferrals = (p?.referrals ?? []).filter(
    (referral) =>
      referral.episodeId === e?.id &&
      !["Resolved handover", "Resolved alternative", "Cancelled with plan"].includes(
        referral.handover,
      ),
  );
  const save = (action, message, onError = setFormError) => {
    const fullAction = { ...modal, ...action };
    if (reducer(state, fullAction) === state) {
      onError(
        "This change could not be saved. Check the values and whether the record is still available for this action.",
      );
      return false;
    }
    const result = commit(fullAction);
    if (result.error) {
      onError(result.error);
      return false;
    }
    onClose();
    notify(message);
    return true;
  };
  const footer = (label, disabled = false) => (
    <ActionGroup className="modal-footer">
      {formError && (
        <p className="field-error form-save-error" role="alert">
          {formError}
        </p>
      )}
      <Button type="button" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="primary" type="submit" disabled={disabled}>
        {label}
      </Button>
    </ActionGroup>
  );
  if (modal.type === "import-people")
    return (
      <Modal
        title="Import people"
        onClose={onClose}
        className="import-people-modal"
      >
        <div className="import-placeholder">
          <p>Feature to be defined.</p>
        </div>
        <ActionGroup className="modal-footer">
          <Button variant="secondary" type="button" onClick={onClose}>
            Close
          </Button>
        </ActionGroup>
      </Modal>
    );
  if (modal.type === "instrument")
    return <InstrumentLibrary onClose={onClose} />;
  if (
    modal.type === "care-timeline-entry" ||
    modal.type === "care-event" ||
    modal.type === "clinical-record"
  )
    return (
      <CareTimelineEntryForm
        episode={e}
        initialScope={
          modal.type === "care-event"
            ? "contextual"
            : "structured"
        }
        initialType={modal.initialType}
        simpleAssessments={simpleAssessments}
        scheduleAssessments={scheduleAssessments}
        error={formError}
        onClose={onClose}
        onSelectAppointment={() => openModal({
          type: "appointment",
          personId: modal.personId,
          episodeId: modal.episodeId,
        })}
        onSave={(action) =>
          save(
            action,
            action.type === "ADD_CLINICAL_RECORD"
              ? "Structured care record added to this care episode."
              : "Event added to the timeline.",
          )
        }
      />
    );
  if (modal.type === "appointment")
    return (
      <AppointmentForm
        episode={e}
        people={state.people}
        person={p}
        recordTypes={(state.settings?.phase2CareActivity ? ["appointment"] : NEW_RECORD_TYPES).map((value) => ({
          value,
          label: simpleAssessments && value === "outcome"
            ? "Score collection"
            : recordCategoryLabel(value),
        }))}
        onChangeEventType={(initialType) => openModal({
          type: "care-timeline-entry",
          personId: modal.personId,
          episodeId: modal.episodeId,
          initialType,
        })}
        error={formError}
        canCreateAssessment={canAssess(p, e)}
        simpleAssessments={!linkAssessmentAppointments}
        scheduleAssessments={scheduleAssessments}
        assessmentSms={assessmentSms}
        phase2Mvp={!!state.settings?.phase2CareActivity}
        onClose={onClose}
        onSave={(action) =>
          save(action, "Contact added to this care episode.")
        }
      />
    );
  if (modal.type === "care-level") {
    const clinicians = DEMO_STAFF.filter((item) => item.role === "Clinician");
    return (
      <CareLevelForm
        episode={e}
        clinicians={clinicians}
        error={formError}
        onClose={onClose}
        onSave={(action) => {
          const problem = carePeriodError(e, action, staff, TODAY, clinicians);
          if (problem) return setFormError(problem);
          if (action.type === "CHANGE_CARE_LEVEL") {
            const newEpisodeId = uid();
            if (save({ ...action, newEpisodeId }, "New care episode started. The earlier episode remains in history."))
              navigate(`/people/${p.id}?episode=${newEpisodeId}`);
          } else {
            save(action, "Starting care level recorded.");
          }
        }}
      />
    );
  }
  if (modal.type === "appointment-outcome") {
    const appointment = e?.appointments?.find(
      (item) => item.id === modal.appointmentId,
    );
    if (!appointment) return null;
    return (
      <AppointmentOutcomeForm
        episode={e}
        appointment={appointment}
        person={p}
        simpleAssessments={!linkAssessmentAppointments}
        error={formError}
        onClose={onClose}
        onSave={(action) =>
          save(action, "Contact outcome recorded.")
        }
      />
    );
  }
  if (modal.type === "correct-care-event") {
    const event = e?.events?.find((item) => item.id === modal.eventId);
    if (!event) return null;
    return (
      <CareTimelineEntryForm
        episode={e}
        event={event}
        simpleAssessments={simpleAssessments}
        error={formError}
        onClose={onClose}
        onSave={(action) =>
          save(
            {
              ...action,
              type: "CORRECT_CARE_EVENT",
              correctedEventId: event.id,
            },
            "Event correction added to the timeline.",
          )
        }
      />
    );
  }
  if (modal.type === "questionnaire-preview")
    return (
      <Modal
        title="Measure preview"
        subtitle={`${displayMeasureVersion(c.version)} · ${displayPersonName(p)} · ${c.label}`}
        onClose={onClose}
        closeLabel="Close preview"
        className="questionnaire-preview-modal"
      >
        <InstrumentPreview
          instrument={getInstrument(c.version)}
          respondent={c.respondent}
          onBack={onClose}
          backLabel={
            modal.returnToDetails ? "Back to collection details" : undefined
          }
        />
      </Modal>
    );
  if (modal.type === "link-assessment-contact") {
    if (!linkAssessmentAppointments) return null;
    const linkedIds = new Set(contactsForAssessment(e, c?.id).map((item) => item.id));
    const choices = (e?.appointments || []).filter((item) =>
      !linkedIds.has(item.id) && (assessmentSms || item.deliveryMode !== "SMS"));
    const unlinkedAttempts = (c?.attempts || []).filter((item) =>
      !item.appointmentId && (assessmentSms || item.channel !== "SMS link"));
    return (
      <Modal title="Link existing contact" subtitle={c?.label} onClose={onClose}>
        <ValidatedForm onSubmit={(event) => {
          event.preventDefault();
          const values = formValues(event);
          save({ type: "LINK_ASSESSMENT_CONTACT", appointmentId: values.appointmentId,
            attemptId: values.attemptId || null },
            "Contact linked to measure.");
        }}>
          <div className="form-body">
            <Field label="Contact">
              <select name="appointmentId" required defaultValue="">
                <option value="" disabled>Choose a contact</option>
                {choices.map((item) => (
                  <option key={item.id} value={item.id}>
                    {formatDate(item.actualDate || item.plannedDate)} · {item.contactType || item.appointmentType || item.practitionerService} · {item.attendance}
                  </option>
                ))}
              </select>
            </Field>
            {unlinkedAttempts.length > 0 && <Field label="Delivery attempt" hint="Optional. Choose an attempt only if this contact was used for that delivery.">
              <select name="attemptId" defaultValue="">
                <option value="">Related contact only</option>
                {unlinkedAttempts.map((attempt) => (
                  <option key={attempt.id} value={attempt.id}>
                    Attempt {c.attempts.indexOf(attempt) + 1} · {attempt.date ? formatDate(attempt.date) : "Date not recorded"} · {attempt.channel || "Collection method not recorded"} · {attempt.assistance || "Assistance not recorded"}
                  </option>
                ))}
              </select>
            </Field>}
            <p>Collection method and assistance belong to each delivery attempt. Linking a contact alone does not change the response source{scheduleAssessments ? " or due date" : ""}.{unlinkedAttempts.some((item) => item.id === c.submittedAttemptId)
              ? " If you link the submitted attempt, this contact becomes its response source."
              : unlinkedAttempts.length > 0
                ? " The submitted response source remains unchanged."
                : " All recorded delivery attempts already have a contact."}</p>
          </div>
          {footer("Link contact", choices.length === 0)}
        </ValidatedForm>
      </Modal>
    );
  }
  if (modal.type === "collection-details")
    return (
      <CollectionDetails
        person={p}
        episode={e}
        collection={c}
        simpleAssessments={simpleAssessments}
        linkAssessmentAppointments={linkAssessmentAppointments}
        scheduleAssessments={scheduleAssessments}
        showDueDates={scheduleAssessments || assessmentDueDatesEnabled(state.settings)}
        showDueLabels={assessmentDueDatesEnabled(state.settings)}
        assessmentSms={assessmentSms}
        canCompleteAsClinician={staff?.role === "Clinician" && canAssess(p, e)}
        onClose={onClose}
        onAction={(type) => {
          if (type === "clinician-entry") {
            const instrument = getInstrument(c.version);
            const respondent = instrumentSupportsRespondent(instrument, c.respondent, 'Clinician entry')
              ? c.respondent
              : "Person";
            const assistance = respondent === "Clinician" ? "Independent" : ["Transcribed", "Joint completion"].includes(
              c.assistance,
            )
              ? c.assistance
              : "Transcribed";
            const result = commit({
              ...modal,
              type: "DELIVER",
              channel: "Clinician entry",
              respondent,
              assistance,
            });
            if (result.error) {
              setFormError(result.error);
              return;
            }
            openModal({
              personId: p.id,
              episodeId: e.id,
              collectionId: c.id,
              type: "clinician-questionnaire",
            });
            return;
          }
          openModal({
            ...modal,
            type,
            returnToDetails: true,
          });
        }}
      />
    );
  if (modal.type === "clinician-questionnaire")
    return (
      c.bundleId || c.scheduleRuleId ? <BundleQuestionnaire person={p} episode={e} collection={c} onClose={onClose} /> :
      <ClinicianQuestionnaire
        person={p}
        episode={e}
        collection={c}
        onClose={onClose}
      />
    );
  if (modal.type === "edit-responses")
    return (
      <EditResponses
        person={p}
        episode={e}
        collection={c}
        onClose={onClose}
        notify={notify}
      />
    );
  if (modal.type === "new-person")
    return (
      <RegisterPerson onClose={onClose} navigate={navigate} notify={notify} />
    );
  if (["new-referral", "referral-event"].includes(modal.type))
    return <ReferralForm modal={modal} onClose={onClose} notify={notify} />;
  if (["plan", "collection"].includes(modal.type) && !canAssess(p, e))
    return (
      <Modal title="Complete intake first" onClose={onClose}>
        <div className="form-body">
          <Notice>
            A completed intake with a proceed decision and receiving owner is
            required before assessment work.
          </Notice>
          <Button
            onClick={() => {
              onClose();
              navigate(`/people/${p?.id}`);
            }}
          >
            Open intake
          </Button>
        </div>
      </Modal>
    );
  if (modal.type === "plan")
    return (
      <Modal
        title={previewOpen ? "Measure preview" : scheduleAssessments ? "Schedule measure" : "Start measure"}
        subtitle={
          previewOpen
            ? `${displayMeasureVersion(selectedInstrument.version)} · ${displayPersonName(p)}`
            : `${displayPersonName(p)} · Care episode ${e.number}`
        }
        onClose={previewOpen ? () => setPreviewOpen(false) : onClose}
        closeLabel={previewOpen ? "Close preview" : "Close dialog"}
        className={previewOpen ? "questionnaire-preview-modal" : ""}
      >
        <ValidatedForm
          hidden={previewOpen}
          onSubmit={(ev) => {
            ev.preventDefault();
            const values = formValues(ev);
            const label = String(values.label || "").trim();
            const dueDate = scheduleAssessments ? planDue || values.due : "";
            if (!scheduleAssessments && (p.consent !== "Recorded" || p.contact !== "Suitable")) {
              setFormError("Record assessment consent and confirm contact suitability before starting.");
              return;
            }
            if (scheduleAssessments && linkAssessmentAppointments && planChannel !== "SMS link" &&
                (!planExternalSlot || planExternalSlot.date > dueDate)) {
              setFormError("Choose an available contact on or before the measure due date.");
              return;
            }
            const externalAppointment = !scheduleAssessments || !linkAssessmentAppointments || planChannel === "SMS link" ? null : planExternalSlot;

            const result = commit({
              ...modal,
              type: "PLAN",
              id: plannedCollectionId,
              bundleId: groupAssessmentsByBundle ? assessmentBundleId : undefined,
              label,
              due: dueDate,
              version: instrumentVersion,
              respondent: planRespondent,
              channel: showPlanChannel ? planChannel : undefined,
              assistance: planAssistance,
              externalAppointment,
            });
            if (result.error) {
              setFormError(result.error);
              return;
            }
            if (!scheduleAssessments) {
              const delivery = commit({
                type: "DELIVER",
                personId: p.id,
                episodeId: e.id,
                collectionId: plannedCollectionId,
                channel: showPlanChannel ? planChannel : "Clinic tablet",
                respondent: planRespondent,
                assistance: planAssistance,
              });
              if (delivery.error) {
                setFormError(delivery.error);
                return;
              }
              onClose();
              if (planChannel === "Clinician entry" && showPlanChannel) {
                openModal({ type: "clinician-questionnaire", personId: p.id, episodeId: e.id, collectionId: plannedCollectionId });
              } else {
                startQuestionnaire({
                  personId: p.id,
                  episodeId: e.id,
                  collectionId: plannedCollectionId,
                  channel: showPlanChannel ? planChannel : "Clinic tablet",
                  respondent: planRespondent,
                  assistance: planAssistance,
                  attemptId: delivery.state.people.find((person) => person.id === p.id)
                    ?.episodes.find((episode) => episode.id === e.id)
                    ?.collections.find((collection) => collection.id === plannedCollectionId)
                    ?.attempts.at(-1)?.id,
                });
              }
              return;
            }
            onClose();
            notify(
              !scheduleAssessments ? "Measure created." : externalAppointment
                ? "Follow-up linked to an external contact."
                : "Follow-up added to the existing care episode.",
            );
          }}
        >
          <div className="form-body">
            <Notice>
              {!scheduleAssessments
                ? `Start a measure in care episode ${e.number}. Answers can be saved as a draft and then completed.`
                : `Schedule a measure in care episode ${e.number}, preserving the previous responses.`}
            </Notice>
            {scheduleAssessments && <Field
              label="Due date"
              hint="A sample due date is shown. Confirm or change it for this measure."
            >
              <input
                name="due"
                type="date"
                min={TODAY}
                value={planDue}
                onChange={(event) => { setPlanDue(event.target.value); setPlanExternalSlot(null); }}
                required
              />
            </Field>}
            <div className="instrument-field">
              <Field label="Measure" hint={selectedInstrument.description}>
                <select
                  name="version"
                  value={instrumentVersion}
                  onChange={(event) => {
                    const nextVersion = event.target.value;
                    setInstrumentVersion(nextVersion);
                    if (!getInstrument(nextVersion)?.respondents.includes(planRespondent)) {
                      setPlanRespondent("Person");
                    }
                    if (!assessmentNameEdited) {
                      setAssessmentName(suggestedAssessmentName(e?.collections, nextVersion));
                    }
                  }}
                >
                  {INSTRUMENT_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.instruments.map((instrument) => (
                        <option key={instrument.version} value={instrument.version}>
                          {displayMeasureVersion(instrument.version)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <button
                ref={previewTrigger}
                type="button"
                className="preview-launcher"
                onClick={() => setPreviewOpen(true)}
              >
                <Eye size={20} aria-hidden="true" />
                <span>
                  <strong>Preview measure</strong>
                  <small>
                    Up to {selectedInstrument.questions.length} questions · Try
                    different paths
                  </small>
                </span>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
            <Field
              label="Measure name"
              hint="Suggested from the measure and existing measures. You can edit it."
            >
              <input
                name="label"
                value={assessmentName}
                onChange={(event) => {
                  setAssessmentName(event.target.value);
                  setAssessmentNameEdited(true);
                }}
                required
                maxLength={80}
              />
            </Field>
            {groupAssessmentsByBundle && <Field
              label="Assessment"
              hint="Choose an assessment for this measure, or keep it as an individual measure."
            >
              <select value={assessmentBundleId} onChange={event => {setAssessmentBundleId(event.target.value);const bundle = availableAssessmentBundles.find(item => item.id === event.target.value);if(bundle){setPlanChannel(bundle.channel);setPlanRespondent(bundle.recipient);setPlanAssistance(bundle.channel === 'Clinician entry' && bundle.recipient !== 'Clinician' ? 'Transcribed' : 'Independent');}}}>
                <option value="">Individual measure</option>
                {availableAssessmentBundles.map(bundle =>
                  <option key={bundle.id} value={bundle.id}>{bundleName(bundle)}</option>)}
              </select>
            </Field>}
            {!simpleAssessments && <details className="setup-disclosure">
              <summary>
                Existing collection plan ({e.collections.length})
              </summary>
              <ul>
                {[...e.collections]
                  .sort((a, b) => (a.due || "").localeCompare(b.due || ""))
                  .map((col) => (
                    <li key={col.id}>
                      {col.label}{scheduleAssessments && col.due ? ` · ${formatDate(col.due)}` : ""} ·{" "}
                      {col.response === "Submitted"
                        ? "Response received"
                        : col.assignment}
                    </li>
                  ))}
              </ul>
            </details>}
            <Field label={LABELS.respondent}>
              <select
                value={planRespondent}
                disabled={!!assessmentBundleId}
                onChange={(event) => {setPlanRespondent(event.target.value);if(planChannel === 'Clinician entry')setPlanAssistance(event.target.value === 'Clinician' ? 'Independent' : 'Transcribed');}}
              >
                <option value="Person">{displayPersonName(p)}</option>
                {(planChannel === "Clinician entry" || planRespondent === "Clinician") && <option value="Clinician">Clinician</option>}
              </select>
            </Field>

            {showPlanChannel && <fieldset className="channel-options">
              <legend>{LABELS.collectionMethod}</legend>
              {COLLECTION_METHOD_OPTIONS.map(([value]) => [value, ...COLLECTION_METHOD_PRESENTATION[value]]).map(([label, description, Icon]) => (
                (!assessmentSms && label === "SMS link" ? null :
                <label
                  className={`channel ${planChannel === label ? "chosen" : ""}`}
                  key={label}
                >
                  <RadioInput
                    name="planChannel"
                    value={label}
                    checked={planChannel === label}
                    disabled={!!assessmentBundleId ||
                      label === "Clinician entry" &&
                      staff?.role !== "Clinician"
                    }
                    onChange={() => {
                      setPlanChannel(label);
                      setCopyFeedback("");
                      setPlanAssistance(
                        label === "Clinician entry"
                          ? planRespondent === "Clinician" ? "Independent" : "Transcribed"
                          : "Independent",
                      );
                      scrollToPicker(label === "SMS link" ? planSmsRef : planPickerRef);
                    }}
                  />
                  <Icon size={23} />
                  <span>
                    <strong>{collectionMethodLabel(label)}</strong>
                    <small>{description}</small>
                  </span>
                  <span className="radio-dot" />
                </label>)
              ))}
            </fieldset>}

            {showPlanChannel && assessmentSms && scheduleAssessments && planChannel === "SMS link" && (
              <section ref={planSmsRef} className="sms-plan-panel" aria-label="SMS link details">
                <strong>SMS link plan</strong>
                <p>
                  In the intended service, the SMS link is sent automatically five days before the due date
                  {plannedSmsDate && <> ({formatDate(plannedSmsDate)})</>}.
                  {plannedSmsDate && plannedSmsDate < TODAY && " This date has passed; arrange delivery now."}
                  {" "}A reminder is sent if the response is still outstanding.
                </p>
                <p>Saved answer progress and the submitted response appear in the measure record for the clinician to review.</p>
                <label className="sms-plan-link-label" htmlFor="planned-sms-link">Sample measure link</label>
                <div className="sms-plan-link-row">
                  <input id="planned-sms-link" type="text" readOnly value={sampleQuestionnaireLink} />
                  <Button type="button" onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(sampleQuestionnaireLink);
                      setCopyFeedback("Link copied");
                    } catch {
                      setCopyFeedback("Could not copy. Select the link and copy it manually.");
                    }
                  }}><Copy size={16} aria-hidden="true" /> Copy</Button>
                </div>
                <p className="sms-plan-footnote">Save this follow-up before using the link. This browser-local prototype does not send SMS or reminders; the link works in this browser after collection starts.</p>
                {copyFeedback && <p className="sms-plan-copy-feedback" role="status">{copyFeedback}</p>}
              </section>
            )}
            {scheduleAssessments && linkAssessmentAppointments && planChannel !== "SMS link" && <AppointmentSlotPicker
              key={planDue}
              scrollTargetRef={planPickerRef}
              mode="assessment"
              required
              dueDate={planDue}
              selectedSlot={planExternalSlot}
              onSelect={(slot) => { setPlanExternalSlot(slot); setFormError(""); }}
            />}
          </div>
          <ActionGroup className="modal-footer">
            {formError && (
              <p className="field-error form-save-error" role="alert">
                {formError}
              </p>
            )}
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {scheduleAssessments ? "Schedule measure"
                : showPlanChannel && planChannel === "Clinic tablet" ? "Send to tablet"
                : "Start measure"}
            </Button>
          </ActionGroup>
        </ValidatedForm>
        {previewOpen && (
          <InstrumentPreview
            key={selectedInstrument.version}
            instrument={selectedInstrument}
            respondent="Person"
            onBack={() => setPreviewOpen(false)}
            backLabel="Back to follow-up"
          />
        )}
      </Modal>
    );
  if (modal.type === "collection") {
    const responseContacts = contactsForAssessment(e, c.id).filter((item) =>
      !["Cancelled", "Did not attend"].includes(item.attendance));
    const allowed =
      (c.clientProfileMeasure || p.consent === "Recorded" && p.contact === "Suitable") &&
      canCollectInEpisode(e, c) &&
      c.response !== "Submitted" &&
      !!getInstrument(c.version) &&
      instrumentSupportsRespondent(getInstrument(c.version), respondent, channel) &&
      (assessmentSms || channel !== "SMS link") &&
      (channel !== "Clinician entry" || staff?.role === "Clinician") &&
      !["Cancelled", "Paused"].includes(c.assignment);
    const blockers = [
      !c.clientProfileMeasure && p.consent !== "Recorded" &&
        `Measure participation is ${p.consent.toLowerCase()}.`,
      !c.clientProfileMeasure && p.contact !== "Suitable" &&
        `Contact suitability is ${p.contact.toLowerCase()}.`,
      !canCollectInEpisode(e, c) &&
        `This care episode is ${e.status.toLowerCase()}.`,
      c.response === "Submitted" && "A response has already been submitted.",
      !getInstrument(c.version) && "This measure version is unavailable.",
      getInstrument(c.version) &&
        !instrumentSupportsRespondent(getInstrument(c.version), respondent, channel) &&
        "Choose a compatible respondent and collection method.",
      channel === "Clinician entry" &&
        staff?.role !== "Clinician" &&
        "Choose a Clinician profile to complete this measure.",
      !assessmentSms && channel === "SMS link" && "Choose a collection method available in this workspace.",
      ["Cancelled", "Paused"].includes(c.assignment) &&
        `This collection is ${c.assignment.toLowerCase()}.`,
    ].filter(Boolean);
    return (
      <Modal
        title={modal.collectResponse ? "Collect response" : collectionSetupLabel(c)}
        subtitle={`${displayPersonName(p)} · ${c.label}`}
        onClose={onClose}
      >
        <ValidatedForm
          noValidate
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!allowed) return;
            if (linkAssessmentAppointments && modal.collectResponse && channel !== "SMS link" &&
                !selectedCollectionExternalSlot && responseContacts.length > 1 && !responseContactId) {
              setFormError("Choose the contact that supplied this response.");
              return;
            }
            const result = commit({
              ...modal,
              type: modal.collectResponse ? "DELIVER" : "SAVE_COLLECTION_SETUP",
              channel,
              respondent,
              assistance,
              appointmentId: linkAssessmentAppointments && modal.collectResponse && channel !== "SMS link" ? responseContactId || undefined : null,
              externalAppointment: !linkAssessmentAppointments || !c.due || channel === "SMS link" ? null : selectedCollectionExternalSlot,
            });
            if (result.error) {
              setFormError(result.error);
              return;
            }
            if (!modal.collectResponse) {
              openModal(null);
              notify("Collection setup saved.");
              return;
            }
            if (channel === "Clinician entry") {
              openModal({
                personId: p.id,
                episodeId: e.id,
                collectionId: c.id,
                type: "clinician-questionnaire",
              });
              return;
            }
            const savedCollection = result.state.people
              .find((person) => person.id === p.id)
              ?.episodes.find((episode) => episode.id === e.id)
              ?.collections.find((collection) => collection.id === c.id);
            openModal(null);
            startQuestionnaire({
              ...modal,
              channel,
              respondent,
              assistance,
              attemptId: savedCollection?.attempts.at(-1)?.id,
            });
          }}
        >
          <div className="form-body">
            <div className="context-line">
              <span>{displayMeasureVersion(c.version)}</span>
              <Badge>
                {c.link === "Expired" ? "Previous link expired" : c.response}
              </Badge>
            </div>
            {c.draftAnswers?.some(Boolean) && <Notice>
              Saved answers will open in this session. Each answer keeps the collection method
              of the session that supplied its current value. The respondent is
              fixed while this draft is in progress.
            </Notice>}
            {!allowed && (
              <Notice tone="amber">
                <strong>Collection needs attention</strong>
                <ul>
                  {blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
                {!c.clientProfileMeasure && (p.consent !== "Recorded" || p.contact !== "Suitable") && (
                  <button
                    type="button"
                    className="inline-link"
                    onClick={() =>
                      openModal({
                        ...modal,
                        type: "consent",
                        returnToCollection: true,
                        returnToDetails: false,
                        collectionDraft: { channel, respondent, assistance },
                      })
                    }
                  >
                    Update participation & contact
                  </button>
                )}
              </Notice>
            )}
            <Field label={LABELS.respondent}>
              <select
                value={respondent}
                disabled={!!c.bundleId || !!c.scheduleRuleId || !!c.draftAnswers?.some(Boolean)}
                onChange={(ev) => { setRespondent(ev.target.value); if (channel === "Clinician entry") setAssistance(ev.target.value === "Clinician" ? "Independent" : "Transcribed"); }}
              >
                <option value="Person">{displayPersonName(p)}</option>
                {(channel === "Clinician entry" || respondent === "Clinician") && <option value="Clinician">Clinician</option>}
              </select>
            </Field>
            <fieldset className="channel-options">
              <legend>{LABELS.collectionMethod}</legend>
              {COLLECTION_METHOD_OPTIONS.map(([value]) => [value, ...COLLECTION_METHOD_PRESENTATION[value]]).map(([label, description, Icon]) => (
                (!assessmentSms && label === "SMS link" ? null :
                <label
                  className={`channel ${channel === label ? "chosen" : ""}`}
                  key={label}
                >
                  <RadioInput
                    name="channel"
                    value={label}
                    checked={channel === label}
                    disabled={!!c.bundleId || !!c.scheduleRuleId ||
                      label === "Clinician entry" &&
                      staff?.role !== "Clinician"
                    }
                    onChange={() => {
                      setChannel(label);
                      setAssistance(
                        label === "Clinician entry"
                          ? respondent === "Clinician" ? "Independent" : "Transcribed"
                          : "Independent",
                      );
                      if (label !== "SMS link") scrollToPicker(collectionPickerRef);
                    }}
                  />
                  <Icon size={23} />
                  <span>
                    <strong>{collectionMethodLabel(label)}</strong>
                    <small>{description}</small>
                  </span>
                  <span className="radio-dot" />
                </label>)
              ))}
            </fieldset>
            <Field label={LABELS.assistance}>
              <select
                value={assistance}
                onChange={(ev) => setAssistance(ev.target.value)}
              >
                {(channel === "Clinician entry"
                  ? respondent === "Clinician" ? ["Independent"] : ["Transcribed", "Joint completion"]
                  : ["Independent", "Supported"]
                ).map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </Field>
            {linkAssessmentAppointments && !!c.due && channel !== "SMS link" && <AppointmentSlotPicker
              scrollTargetRef={collectionPickerRef}
              mode="assessment"
              dueDate={c.due}
              selectedSlot={selectedCollectionExternalSlot}
              onSelect={(slot) => { setCollectionExternalSlot(slot); setFormError(""); }}
            />}
            {linkAssessmentAppointments && modal.collectResponse && channel !== "SMS link" && !selectedCollectionExternalSlot && responseContacts.length > 0 && (
              <Field label="Contact for this response" hint="Choose which related contact supplied these answers.">
                <select value={responseContactId} onChange={(ev) => setResponseContactId(ev.target.value)}>
                  <option value="">{responseContacts.length > 1 ? "Choose a contact" : "Choose automatically"}</option>
                  {responseContacts.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatDate(item.actualDate || item.plannedDate)} · {item.contactType || item.appointmentType || item.practitionerService}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <details className="setup-disclosure collection-checks">
              <summary>Check this collection</summary>
              <dl className="metadata">
                <div>
                  <dt>Answering</dt>
                  <dd>
                    {respondent === "Family respondent"
                      ? displayFamilyName(p)
                      : respondent === "Clinician" ? `${staff?.name || "Clinician"} · Clinician` : displayPersonName(p)}
                    {respondent === "Family respondent"
                      ? " · own family contribution"
                      : " · own answers"}
                  </dd>
                </div>
                <div>
                  <dt>
                    {channel === "SMS link"
                      ? "SMS destination"
                      : "Collection setting"}
                  </dt>
                  <dd>
                    {channel === "SMS link"
                      ? "No phone number connected · sample link only"
                      : channel === "Clinic tablet"
                        ? "Shared clinic device · staff handover"
                        : respondent === "Clinician" ? `${staff?.name} supplies their own answers` : `${staff?.name} records the respondent’s answers`}
                  </dd>
                </div>
                <div>
                  <dt>Assistance</dt>
                  <dd>{assistance}</dd>
                </div>
                <div>
                  <dt>Participation / contact</dt>
                  <dd>
                    {p.consent} / {p.contact}
                  </dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>
                    {p.participationRecord?.source ||
                      "Source not recorded · illustrative sample settings"}
                  </dd>
                </div>
              </dl>
            </details>
            {channel === "SMS link" && (
              <details className="setup-disclosure">
                <summary>Preview sample message</summary>
                <p className="message-preview">
                  Your care team at Northside Centre invites you to complete a
                  short check-in. Open your request to see what it involves
                  and how to get help.
                  <br />
                  <br />
                  [Sample measure link]
                </p>
                <p className="muted">
                  Preview only. No message will be sent.
                </p>
              </details>
            )}
            <Notice>
              {respondent === "Family respondent"
                ? `${displayFamilyName(p)} provides their own contribution. This does not establish guardian authority.`
                : `${displayPersonName(p)} can answer this sample check-in by ${assessmentSms ? "SMS link, " : ""}clinic tablet, or with staff recording the answers.`}
            </Notice>
          </div>
          {footer(
            modal.collectResponse
              ? channel === "Clinician entry" ? "Begin measure" : "Open measure"
              : "Save",
            !allowed,
          )}
        </ValidatedForm>
      </Modal>
    );
  }
  if (modal.type === "review")
    return (
      <ReviewResponses
        person={p}
        episode={e}
        collection={c}
        initialNote={modal.reviewDraft || ""}
        onClose={onClose}
        notify={notify}
        onEdit={(reviewDraft) =>
          openModal({
            ...modal,
            type: "edit-responses",
            returnToDetails: false,
            returnToReview: true,
            reviewDraft,
          })
        }
      />
    );
  if (modal.type === "consent-send") {
    const sendableConsents = CONSENT_LIBRARY.filter(
      (item) =>
        !p.consentRequests?.some(
          (request) =>
            request.consentId === item.id &&
            ["Sent", "Accepted"].includes(request.status),
        ),
    );
    return (
      <Modal
        title="Send consent request"
        subtitle={`${displayPersonName(p)} · Care episode ${e.number}`}
        onClose={onClose}
      >
        <ValidatedForm
          onSubmit={(event) => {
            event.preventDefault();
            save(
              { type: "CONSENT_SEND", ...formValues(event) },
              "Sample consent request sent. Open it from the list to view the patient experience.",
            );
          }}
        >
          <div className="form-body">
            <Notice>
              Select an approved sample consent. Sending a request does not
              record consent.
            </Notice>
            <Field label="Consent purpose">
              <select name="consentId" defaultValue={sendableConsents[0]?.id}>
                {sendableConsents.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} · {displayMeasureVersion(item.version)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={LABELS.deliveryMethod}>
              <select name="channel" defaultValue={assessmentSms ? "SMS link" : "Clinic tablet"}>
                {assessmentSms && <option>SMS link</option>}
                <option>Clinic tablet</option>
              </select>
            </Field>
            {assessmentSms && <p className="muted">
              SMS requires suitable contact. This is labelled sample policy, not
              approved consent wording.
            </p>}
          </div>
          {footer("Send sample request", sendableConsents.length === 0)}
        </ValidatedForm>
      </Modal>
    );
  }
  if (modal.type === "consent-detail") {
    const request = p.consentRequests?.find(
      (item) => item.id === modal.consentRequestId,
    );
    if (!request) return null;
    return (
      <Modal
        title={request.title}
        subtitle={`${request.status} · ${displayMeasureVersion(request.version)}`}
        onClose={onClose}
      >
        <div className="form-body">
          <dl className="metadata">
            <div>
              <dt>Scope</dt>
              <dd>{request.scope}</dd>
            </div>
            <div>
              <dt>{LABELS.deliveryMethod}</dt>
              <dd>{request.channel}</dd>
            </div>
            <div>
              <dt>Sent</dt>
              <dd>{request.sentAt || "Not sent"}</dd>
            </div>
            <div>
              <dt>Decision</dt>
              <dd>{request.status}</dd>
            </div>
            {request.decisionMaker && (
              <div>
                <dt>Decision maker</dt>
                <dd>{request.decisionMaker}</dd>
              </div>
            )}
          </dl>
          <Notice>
            This opens a scoped sample patient view. It does not establish
            recipient verification, authority, delivery or production
            persistence.
          </Notice>
        </div>
        <ActionGroup className="modal-footer">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {request.status === "Sent" && (
            <Button
              variant="primary"
              onClick={() =>
                startConsentRequest({
                  personId: p.id,
                  episodeId: e.id,
                  consentRequestId: request.id,
                })
              }
            >
              Open sample patient view
            </Button>
          )}
          {request.status === "Accepted" && (
            <Button
              variant="secondary"
              onClick={() =>
                openModal({
                  ...modal,
                  type: "consent-withdraw",
                  consentRequestId: request.id,
                })
              }
            >
              Record withdrawal
            </Button>
          )}
        </ActionGroup>
      </Modal>
    );
  }
  if (modal.type === "consent-withdraw") {
    const request = p.consentRequests?.find(
      (item) => item.id === modal.consentRequestId,
    );
    if (!request) return null;
    return (
      <Modal
        title="Record consent withdrawal"
        subtitle={request.title}
        onClose={onClose}
      >
        <ValidatedForm
          onSubmit={(event) => {
            event.preventDefault();
            save(
              { type: "CONSENT_WITHDRAW", consentRequestId: request.id },
              "Consent withdrawal recorded. Earlier decisions remain in history.",
            );
          }}
        >
          <div className="form-body">
            <Notice>
              This stops future activity only where the approved purpose policy
              requires it. It does not delete prior history.
            </Notice>
          </div>
          {footer("Record withdrawal")}
        </ValidatedForm>
      </Modal>
    );
  }
  if (modal.type === "consent")
    return (
      <Modal
        title="Update sample participation settings"
        subtitle={displayPersonName(p)}
        onClose={onClose}
      >
        <ValidatedForm
          onSubmit={(ev) => {
            ev.preventDefault();
            save(
              { type: "CONSENT", ...formValues(ev) },
              "Sample participation settings updated and recorded in history.",
            );
          }}
        >
          <div className="form-body">
            <Notice>
              Illustrative permission settings for this workspace. Research and
              guardian authority stay separate.
            </Notice>
            <Field label="Assessment participation">
              <select name="consent" defaultValue={p.consent}>
                <option>Recorded</option>
                <option>Not recorded</option>
                <option>Withdrawn</option>
              </select>
            </Field>
            <Field label="Contact suitability">
              <select name="contact" defaultValue={p.contact}>
                <option>Suitable</option>
                <option>Not confirmed</option>
                <option>Unsuitable</option>
              </select>
            </Field>
            <Field
              label="Source or reference"
              hint="Use a fictional reference. Existing seed settings have no verified source."
            >
              <input
                name="source"
                required
                placeholder="e.g. sample participation discussion note"
              />
            </Field>
            <Field label="Reason for recording or changing these settings">
              <textarea name="reason" rows={3} required />
            </Field>
            <p className="muted">
              Recorded as {staff?.name}. The source, time and previous settings
              are retained in history.
            </p>
            <p className="muted">
              Withdrawing participation or marking contact unsuitable revokes
              active sample links. Existing submitted responses stay in the
              history.
            </p>
          </div>
          {footer("Save sample settings")}
        </ValidatedForm>
      </Modal>
    );
  if (modal.type === "episode")
    return (
      <Modal
        title="Care episode actions"
        subtitle={`${displayPersonName(p)} · Care episode ${e.number}`}
        onClose={onClose}
      >
        <ValidatedForm
          onSubmit={(ev) => {
            ev.preventDefault();
            save(
              { type: "EPISODE", status: episodeAction, ...formValues(ev) },
              `Care episode ${episodeAction.toLowerCase()}. Outstanding collections reconciled.`,
            );
          }}
        >
          <div className="form-body">
            <Field label="Action">
              <select
                value={episodeAction}
                onChange={(ev) => setEpisodeAction(ev.target.value)}
              >
                <option value="Paused">Pause care episode</option>
                <option value="Closed">Close care episode</option>
              </select>
            </Field>
            <Field label="Reason for this decision">
              <textarea
                name="reason"
                required
                rows={3}
                placeholder="Explain why this episode of care is being paused or closed…"
              />
            </Field>
            {episodeAction === "Closed" && (
              <>
                <Notice>
                  Prototype closure record only. Closure categories and
                  final-measure rules must be confirmed before PMHC-MDS use.
                </Notice>
                <Notice>
                  Closing assigns the patient an episode closure measure and a separate care experience feedback measure, due seven days from today. This prototype prepares sample links but sends no SMS.
                </Notice>
                <Field label="Actual care end date">
                  <input
                    name="end"
                    type="date"
                    min={e.start}
                    max={TODAY}
                    defaultValue={TODAY}
                    required
                  />
                </Field>
                <Field label="Closure category">
                  <select name="closureCategory" required defaultValue="">
                    <option value="" disabled>
                      Choose a category
                    </option>
                    <option>Planned care completed</option>
                    <option>Transferred or handed over</option>
                    <option>Care ended early</option>
                    <option>Other or not yet classified</option>
                  </select>
                </Field>
                <Field label="Handover status">
                  <select
                    name="handoverStatus"
                    value={handoverStatus}
                    onChange={(ev) => setHandoverStatus(ev.target.value)}
                  >
                    <option>Not applicable</option>
                    <option>Planned</option>
                    <option>Confirmed</option>
                  </select>
                </Field>
                {handoverStatus !== "Not applicable" && (
                  <Field label="Receiving service or destination">
                    <input
                      name="handoverDestination"
                      required
                      placeholder="Record the agreed receiving service or destination…"
                    />
                  </Field>
                )}
                {handoverStatus === "Confirmed" && (
                  <>
                    <Field label="Receiving responsible person or team">
                      <input
                        name="receivingResponsiblePerson"
                        required
                        placeholder="Record who accepted responsibility at the receiving service…"
                      />
                    </Field>
                    <Field label="Handover confirmation date and time">
                      <input
                        name="handoverConfirmedAt"
                        type="datetime-local"
                        max={`${TODAY}T23:59`}
                        required
                      />
                    </Field>
                    <Field label="Handover confirmation evidence or reference">
                      <textarea
                        name="handoverConfirmationReference"
                        rows={2}
                        required
                        placeholder="Record the agreed channel, reference and what was confirmed…"
                      />
                    </Field>
                  </>
                )}
                <Field label="Final outcome-measure status">
                  <select name="finalMeasureStatus" required defaultValue="">
                    <option value="" disabled>
                      Choose a status
                    </option>
                    <option>Not required or not applicable</option>
                    <option>Complete</option>
                    <option>Outstanding</option>
                    <option>Recorded missing</option>
                  </select>
                </Field>
                {unresolvedReferrals.length > 0 && (
                  <>
                    <Notice tone="amber">
                      {unresolvedReferrals.length} onward referral{unresolvedReferrals.length === 1 ? " remains" : "s remain"} unresolved. Closure does not cancel it: assign an owned reconciliation task.
                    </Notice>
                    <Field label="Unresolved-referral rule">
                      <select name="unresolvedReferralRule" defaultValue="">
                        <option value="" disabled>Choose rule</option>
                        <option value="Reconciliation task required">
                          Reconciliation task required
                        </option>
                      </select>
                    </Field>
                    <Field label="Referral reconciliation owner">
                      <StaffPicker name="referralReconciliationOwner" defaultValue={p.owner} required />
                    </Field>
                    <Field label="Referral reconciliation due date">
                      <input name="referralReconciliationDue" type="date" min={TODAY} required />
                    </Field>
                    <Field label="Referral reconciliation action">
                      <textarea
                        name="referralReconciliationAction"
                        rows={2}
                        required
                        placeholder="Record what must be verified, by whom and through which agreed channel…"
                      />
                    </Field>
                  </>
                )}
              </>
            )}
            <Field label="Next care step">
              <textarea
                name="nextCareStep"
                required
                rows={2}
                placeholder="Record the agreed action or handover…"
              />
            </Field>
            <Field label="Owner of the next step">
              <StaffPicker
                name="nextCareOwner"
                defaultValue={p.owner}
                required
              />
            </Field>
            <div className="impact">
              <h3>Review the impact</h3>
              <p>
                <strong>
                  {
                    e.collections.filter((c) => c.response !== "Submitted")
                      .length
                  }
                </strong>{" "}
                outstanding collections will be{" "}
                {episodeAction === "Paused" ? "paused" : "cancelled"}.
              </p>
              <p>
                Active sample links will be revoked. Existing responses and
                review history are retained.
              </p>
              <p>No clinical admission decision is made by this action.</p>
              {episodeAction === "Closed" && (
                <p>Two new patient measures will be assigned to this closed episode. If participation or contact settings are unsuitable, their links will wait for review.</p>
              )}
            </div>
            <Checkbox label="I have reviewed outstanding work and the next care step." required />
          </div>
          {footer(
            episodeAction === "Paused" ? "Pause care episode" : "Close care episode",
            e.status !== "Active",
          )}
        </ValidatedForm>
      </Modal>
    );
  if (modal.type === "correct") {
    const issue = state.issues.find((i) => i.id === modal.issueId);
    if (!issue || !p) return null;
    return (
      <Modal
        title="Review data quality issue"
        subtitle={`${displayPersonName(p)} · ${issue.title}`}
        onClose={onClose}
      >
        <ValidatedForm
          onSubmit={(ev) => {
            ev.preventDefault();
            const action = {
              ...modal,
              type: "RESOLVE_ISSUE",
              resolution,
              ...formValues(ev),
            };
            const problem = qualityResolutionError(state, action);
            if (problem) {
              setFormError(problem);
              return;
            }
            save(
              action,
              resolution === "Needs investigation"
                ? "Investigation recorded. This issue remains open."
                : "Issue resolved. The outcome and source are recorded in history.",
            );
          }}
        >
          <div className="form-body">
            <Notice>{issue.detail}</Notice>
            <Field label="Current value">
              <input value={p[issue.field]} readOnly />
            </Field>
            <Field label="Outcome">
              <select
                value={resolution}
                onChange={(event) => {
                  setResolution(event.target.value);
                  setFormError("");
                }}
              >
                <option value="Confirmed unchanged">Confirm unchanged</option>
                <option value="Corrected value">Correct the value</option>
                <option value="Needs investigation">Needs investigation</option>
              </select>
            </Field>
            {resolution === "Corrected value" && (
              <Field label="Corrected value">
                {issue.field === "dob" ? (
                  <input
                    name="value"
                    type="date"
                    max={TODAY}
                    required
                    defaultValue={p.dob}
                  />
                ) : (
                  <select name="value" defaultValue={p.contact}>
                    <option>Suitable</option>
                    <option>Unsuitable</option>
                    <option>Not confirmed</option>
                  </select>
                )}
              </Field>
            )}
            <Field
              label={
                resolution === "Needs investigation"
                  ? "Source checked so far"
                  : "Verified source"
              }
            >
              <input
                name="source"
                required
                placeholder="e.g. sample referral record, 14 September"
              />
            </Field>
            <Field label="Reason for this outcome">
              <textarea name="reason" rows={3} required />
            </Field>
            {resolution === "Needs investigation" && (
              <Field label="Next investigation step">
                <textarea
                  name="nextStep"
                  required
                  rows={2}
                  placeholder="What needs to be verified next?"
                />
              </Field>
            )}
            <Notice>
              {resolution === "Needs investigation"
                ? `The issue stays open, with ${staff?.name} responsible for the next investigation step.`
                : "The original value, source and outcome stay in history. Submitted measure answers are unaffected."}
            </Notice>
          </div>
          {footer(
            resolution === "Needs investigation"
              ? "Save investigation"
              : resolution === "Confirmed unchanged"
                ? "Confirm unchanged"
                : "Save correction",
          )}
        </ValidatedForm>
      </Modal>
    );
  }
  if (modal.type === "quality-issue")
    return (
      <QualityIssueForm
        modal={modal}
        state={state}
        person={p}
        onClose={onClose}
        openModal={openModal}
        navigate={navigate}
        save={save}
      />
    );
  if (modal.type === "messages" && !assessmentSms) return null;
  const content = {
    about: [
      "About this workspace",
      "A working model of the YSCC assessment experience.",
      <>
        <p>
          Explore staff work, people and care episodes, sample measure
          collection, clinical review, and data corrections.
        </p>
        <Notice>
          Fictional people, sample measure and sample policies. Changes stay
          in this browser. SMS delivery, staff authentication, and clinical
          scoring are not connected.
        </Notice>
        <p>
          Sample records are dated around 15 September 2026. Statuses and date
          limits use your device's current date. Use Administration to reset
          the sample workspace.
        </p>
      </>,
    ],
    "submission-readiness": [
      "Sample submission hand-off",
      "All current blocking checks are resolved.",
      <>
        <p>
          This prototype would allow a submission package to be prepared at this
          point. The package, VPN hand-off, receipt, acceptance outcome and safe
          retry workflow are not connected.
        </p>
        <Notice>
          The readiness decision is based on the visible sample rule set. It is
          not evidence of compliance with the current PMHC-MDS specification or
          approval to submit real data.
        </Notice>
      </>,
    ],
    scope: [
      "Your workspace",
      "Northside Centre",
      <>
        <div className="scope-detail">
          <ShieldCheck size={30} />
          <div>
            <h3>Northside Centre</h3>
            <p>
              {staff?.name} · {staff?.role}
            </p>
          </div>
          <Badge>Selected</Badge>
        </div>
        <p>
          This workspace includes one centre. Live organisation scopes and role
          permissions require a connected access system.
        </p>
      </>,
    ],
    profile: [
      staff?.name || "Staff profile",
      "Sample staff profile",
      <>
        <dl className="metadata">
          <div>
            <dt>Role</dt>
            <dd>{staff?.role}</dd>
          </div>
          <div>
            <dt>Workspace</dt>
            <dd>Northside Centre</dd>
          </div>
          <div>
            <dt>Access</dt>
            <dd>Workspace demonstration</dd>
          </div>
        </dl>
        <Notice>
          No real account is signed in. All displayed people and records are
          fictional.
        </Notice>
        <Field label="Demo staff profile">
          <select
            value={staff?.id || ""}
            onChange={(event) =>
              dispatch({ type: "SWITCH_STAFF", staffId: event.target.value })
            }
          >
            {DEMO_STAFF.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name} · {person.role}
              </option>
            ))}
          </select>
        </Field>
      </>,
    ],
    rules: [
      "Collection rules",
      "Illustrative configuration",
      <>
        <p>
          Questions adapt to earlier answers. Hidden questions are excluded from
          completion and comparison. {scheduleAssessments
            ? "Scheduled measures have an explicit due date inside an active episode."
            : "Measures can start immediately without a due date."}
          {linkAssessmentAppointments ? " Appointments can be linked to measures." : ""}
        </p>
        <p>
          Reissuing adds a delivery attempt to the same assignment. Submission
          fulfils that assignment once. Clinician entry and supported tablet
          completion do not require a separate clinical review.
        </p>
        <Notice>
          Cadence, requiredness, eligibility, and completion policy are sample
          assumptions awaiting governance approval.
        </Notice>
      </>,
    ],
    messages: [
      "Message preview",
      "Sample SMS content",
      <>
        <label className="message-template-label" htmlFor="message-template">SMS message</label>
        <textarea
          id="message-template"
          className="message-preview message-template-input"
          value={messageTemplate}
          onChange={(event) => setMessageTemplate(event.target.value)}
          rows={5}
        />
      </>,
    ],
    reset: [
      "Reset sample workspace",
      "This affects only the workspace’s sample data.",
      <>
        <p>
          Return to the original sample people and their tasks. Your local
          demo changes and measure drafts will be removed.
        </p>
        <Button
          variant="primary"
          onClick={() => {
            dispatch({ type: "RESET" });
            sessionStorage.removeItem("yscc-session");
            sessionStorage.removeItem("yscc-draft");
            Object.keys(sessionStorage)
              .filter(
                (key) =>
                  key.startsWith("yscc-staff-draft:") ||
                  key.startsWith("yscc-scroll:"),
              )
              .forEach((key) => sessionStorage.removeItem(key));
            onClose();
            navigate("/");
            notify("Sample workspace reset.");
          }}
        >
          Reset sample data
        </Button>
      </>,
    ],
    "reset-intake-examples": [
      "Reset River and Samira",
      "Restore only these two fictional records for intake testing.",
      <>
        <p>River returns to intake in progress. Samira returns to completed intake, ready to plan the initial measure. Other people and their work stay as they are.</p>
        <Button
          variant="primary"
          onClick={() => {
            const result = commit({ type: "RESET_INTAKE_EXAMPLES", resetToken: uid() });
            if (result.error) return setFormError(result.error);
            onClose();
            navigate("/people/YS-1031");
            notify("River and Samira reset to their sample intake states.");
          }}
        >
          Reset River and Samira
        </Button>
        {formError && <p className="field-error" role="alert">{formError}</p>}
      </>,
    ],
    "system-status": [
      "System Status & Infrastructure",
      "Live health metrics for clinical workspace",
      <>
        <div className="status-grid">
          <div className="status-item">
            <span className="system-status-dot green" />
            <div>
              <strong>Database & Workspace Store</strong>
              <p className="small muted">Operational • Query Latency 0.6ms</p>
            </div>
            <Badge tone="green">Normal</Badge>
          </div>
          <div className="status-item">
            <span className="system-status-dot green" />
            <div>
              <strong>Clinical API Gateway</strong>
              <p className="small muted">Operational • Response Time 14ms</p>
            </div>
            <Badge tone="green">Normal</Badge>
          </div>
          <div className="status-item">
            <span className="system-status-dot green" />
            <div>
              <strong>Session & Security Services</strong>
              <p className="small muted">Active • 256-bit Encrypted</p>
            </div>
            <Badge tone="green">Normal</Badge>
          </div>
        </div>
        <Notice>All systems operational. No scheduled maintenance or outages detected.</Notice>
      </>,
    ],
    logout: [
      "Log out",
      "End workspace session",
      <>
        <p className="logout-confirm-copy">
          Are you sure you want to log out of <strong>{staff?.name || "Workspace Session"}</strong>?
        </p>
        <div className="logout-confirm-actions">
          <Button
            variant="primary"
            onClick={() => {
              onClose();
              if (notify) notify("Successfully logged out.");
              navigate("/");
            }}
          >
            Log out
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </>,
    ],
  }[modal.type];
  if (!content) return null;
  return (
    <Modal title={content[0]} subtitle={content[1]} onClose={onClose}>
      <div className="form-body prose">{content[2]}</div>
      <ActionGroup className="modal-footer">
        {modal.type === "messages" ? (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                localStorage.setItem("yscc-message-template", messageTemplate);
                onClose();
              }}
            >
              Save
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Done</Button>
        )}
      </ActionGroup>
    </Modal>
  );
}
