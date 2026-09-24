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
  Calendar,
  CalendarDays,
} from "lucide-react";
import { useStore } from "../store";
import {
  TODAY,
  formatDate,
  DEMO_STAFF,
  currentStaff,
  practitionerServiceOptions,
  reducer,
  qualityResolutionError,
  displayPersonName,
  displayFamilyName,
  CONSENT_LIBRARY,
  canCollectInEpisode,
  uid,
} from "../model";
import { DEMO_INSTRUMENT, INSTRUMENTS, getInstrument } from "../instruments";
import { APPOINTMENT_DELIVERY_MODES } from "../appointments";
import {
  Modal,
  Field,
  Button,
  Notice,
  Select,
  Badge,
  StaffPicker,
  ValidatedForm,
} from "./UI";
import CollectionDetails from "./CollectionDetails";
import InstrumentPreview from "./InstrumentPreview";
import InstrumentLibrary from "./InstrumentLibrary";
import EditResponses from "./EditResponses";
import ReviewResponses from "./ReviewResponses";
import ClinicianQuestionnaire from "./ClinicianQuestionnaire";
import CareTimelineEntryForm from "./CareTimelineEntryForm";
import CareEventForm from "./CareEventForm";
import AppointmentForm from "./AppointmentForm";
import AppointmentOutcomeForm from "./AppointmentOutcomeForm";
import CareLevelForm from "./CareLevelForm";
import { carePeriodError } from "../carePeriods";
import ClinicalRecordForm from "./ClinicalRecordForm";
import QualityIssueForm from "./QualityIssueForm";
const formValues = (e) => Object.fromEntries(new FormData(e.currentTarget));
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
  const staff = currentStaff(state);
  const [channel, setChannel] = useState(
      modal.collectionDraft?.channel || modal.channel || "SMS link",
    ),
    [respondent, setRespondent] = useState(
      modal.collectionDraft?.respondent || "Person",
    ),
    [assistance, setAssistance] = useState(
      modal.collectionDraft?.assistance ||
        (modal.channel === "Clinician entry" ? "Transcribed" : "Independent"),
    ),
    [name, setName] = useState(""),
    [episodeAction, setEpisodeAction] = useState("Paused"),
    [previewOpen, setPreviewOpen] = useState(false);
  const [createAppointment, setCreateAppointment] = useState(true);
  const [appointmentTime, setAppointmentTime] = useState("10:00");
  const [appointmentDuration, setAppointmentDuration] = useState("60");
  const [appointmentPractitioner, setAppointmentPractitioner] = useState(
    staff?.name
      ? `${staff.name} · Northside Centre`
      : "Jess Taylor · Northside Centre",
  );
  const [appointmentDeliveryMode, setAppointmentDeliveryMode] =
    useState("In person");
  const [editingTodayAppt, setEditingTodayAppt] = useState(false);
  const [cancellingTodayAppt, setCancellingTodayAppt] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [planDue, setPlanDue] = useState(TODAY);
  const [planChannel, setPlanChannel] = useState("SMS link");
  const [planRespondent, setPlanRespondent] = useState("Person");
  const [planAssistance, setPlanAssistance] = useState("Independent");
  const [planCreateAppointment, setPlanCreateAppointment] = useState(true);
  const [planAppointmentTime, setPlanAppointmentTime] = useState("10:00");
  const [planAppointmentDuration, setPlanAppointmentDuration] = useState("60");
  const [planAppointmentPractitioner, setPlanAppointmentPractitioner] = useState(
    staff?.name
      ? `${staff.name} · Northside Centre`
      : "Jess Taylor · Northside Centre",
  );
  const [planAppointmentDeliveryMode, setPlanAppointmentDeliveryMode] =
    useState("In person");
  const [editingExistingAppt, setEditingExistingAppt] = useState(false);
  const [formError, setFormError] = useState("");
  const [handoverStatus, setHandoverStatus] = useState("Not applicable");
  const [resolution, setResolution] = useState("Confirmed unchanged");
  const [collectionType, setCollectionType] = useState("Instrument check-in");
  const [instrumentVersion, setInstrumentVersion] = useState(
    DEMO_INSTRUMENT.version,
  );
  const selectedInstrument = getInstrument(instrumentVersion);
  const previewTrigger = useRef(null);
  const appointmentSectionRef = useRef(null);
  const wasPreviewOpen = useRef(false);
  useEffect(() => {
    if (wasPreviewOpen.current && !previewOpen) previewTrigger.current?.focus();
    wasPreviewOpen.current = previewOpen;
  }, [previewOpen]);
  useEffect(() => {
    if (planChannel === "SMS link") return;

    const frame = requestAnimationFrame(() => {
      const section = appointmentSectionRef.current;
      const scroller = section?.closest(".form-body");
      if (!section || !scroller) return;

      const sectionOffset =
        section.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top;
      scroller.scrollTo({
        top: Math.max(0, scroller.scrollTop + sectionOffset - 16),
        behavior: "smooth",
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [planChannel]);
  const p = state.people.find((p) => p.id === modal.personId),
    e = p?.episodes.find((e) => e.id === modal.episodeId),
    c = e?.collections.find((c) => c.id === modal.collectionId);
  const existingAppointmentToday = (e?.appointments || []).find(
    (a) =>
      (a.plannedDate === TODAY || a.actualDate === TODAY) &&
      !["Cancelled", "Did not attend"].includes(a.attendance),
  );
  const existingAppointmentOnPlanDue = (e?.appointments || []).find(
    (a) => a.plannedDate === planDue || a.actualDate === planDue,
  );
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
    <div className="modal-footer">
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
    </div>
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
        <div className="modal-footer">
          <Button variant="secondary" type="button" onClick={onClose}>
            Close
          </Button>
        </div>
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
        error={formError}
        canCreateAssessment={canAssess(p, e)}
        onClose={onClose}
        onSave={(action) =>
          save(action, "Appointment or service contact added to this care episode.")
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
        error={formError}
        onClose={onClose}
        onSave={(action) =>
          save(action, "Appointment or service contact outcome recorded.")
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
        title="Questionnaire preview"
        subtitle={`${c.version} · ${displayPersonName(p)} · ${c.label}`}
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
  if (modal.type === "collection-details")
    return (
      <CollectionDetails
        person={p}
        episode={e}
        collection={c}
        canCompleteAsClinician={staff?.role === "Clinician" && canAssess(p, e)}
        onClose={onClose}
        onAction={(type) => {
          if (type === "clinician-entry") {
            const instrument = getInstrument(c.version);
            const respondent = instrument?.respondents.includes(c.respondent)
              ? c.respondent
              : "Person";
            const assistance = ["Transcribed", "Joint completion"].includes(
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
              navigate(`/people/${p?.id}?tab=intake`);
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
        title={previewOpen ? "Questionnaire preview" : "Plan a follow-up"}
        subtitle={
          previewOpen
            ? `${selectedInstrument.version} · ${displayPersonName(p)}`
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
            const label = collectionType === "Custom"
              ? values.label
              : collectionType === "Instrument check-in"
                ? `${selectedInstrument?.name || "Assessment"} · follow-up check-in`
                : collectionType;
            const dueDate = planDue || values.due;
            let linkedAppointmentId =
              existingAppointmentOnPlanDue?.id || null;

            if (
              planChannel !== "SMS link" &&
              planCreateAppointment &&
              !existingAppointmentOnPlanDue
            ) {
              const generatedApptId = uid();
              const apptResult = commit({
                type: "ADD_APPOINTMENT",
                id: generatedApptId,
                personId: p.id,
                episodeId: e.id,
                plannedDate: dueDate,
                plannedTime: planAppointmentTime,
                plannedDurationMinutes:
                  Number(planAppointmentDuration) || 60,
                practitionerService: planAppointmentPractitioner,
                deliveryMode: planAppointmentDeliveryMode,
                attendance: "Planned",
                notes: `Associated appointment for follow-up assessment (${label} · ${planChannel})`,
              });
              if (apptResult.error) {
                setFormError(apptResult.error);
                return;
              }
              linkedAppointmentId = generatedApptId;
            } else if (
              planChannel !== "SMS link" &&
              existingAppointmentOnPlanDue &&
              editingExistingAppt
            ) {
              commit({
                type: "UPDATE_APPOINTMENT",
                personId: p.id,
                episodeId: e.id,
                appointmentId: existingAppointmentOnPlanDue.id,
                plannedDate: dueDate,
                plannedTime: planAppointmentTime,
                plannedDurationMinutes:
                  Number(planAppointmentDuration) || 60,
                practitionerService: planAppointmentPractitioner,
                deliveryMode: planAppointmentDeliveryMode,
              });
              linkedAppointmentId = existingAppointmentOnPlanDue.id;
            }

            const generatedColId = uid();
            const result = commit({
              ...modal,
              type: "PLAN",
              id: generatedColId,
              label,
              due: dueDate,
              version: instrumentVersion,
              respondent: planRespondent,
              channel: planChannel,
              assistance: planAssistance,
              appointmentId: linkedAppointmentId,
            });
            if (result.error) {
              setFormError(result.error);
              return;
            }
            onClose();
            notify(
              linkedAppointmentId
                ? "Follow-up and linked appointment saved to the care episode."
                : "Follow-up added to the existing care episode.",
            );
          }}
        >
          <div className="form-body">
            <Notice>
              This creates a new collection point in care episode {e.number},
              preserving the previous responses. Choose Add follow-up to
              save the follow-up.
            </Notice>
            <Field
              label="Collection point type"
              hint="Sample labels only. Choose the due date explicitly below."
            >
              <select
                name={collectionType === "Custom" ? undefined : "label"}
                value={collectionType}
                onChange={(event) => setCollectionType(event.target.value)}
              >
                <option>Instrument check-in</option>
                <option>90-day review</option>
                <option>Custom</option>
              </select>
            </Field>
            {collectionType === "Custom" && (
              <Field label="Collection point name">
                <input
                  name="label"
                  required
                  maxLength={60}
                  placeholder="Describe this follow-up"
                />
              </Field>
            )}
            <details className="setup-disclosure">
              <summary>
                Existing collection plan ({e.collections.length})
              </summary>
              <ul>
                {[...e.collections]
                  .sort((a, b) => (a.due || "").localeCompare(b.due || ""))
                  .map((col) => (
                    <li key={col.id}>
                      {col.label} · {formatDate(col.due)} ·{" "}
                      {col.response === "Submitted"
                        ? "Response received"
                        : col.assignment}
                    </li>
                  ))}
              </ul>
            </details>
            <Field
              label="Due date"
              hint="This workspace uses 15 September 2026 as today. Cadence is set explicitly for this sample."
            >
              <input
                name="due"
                type="date"
                min={TODAY}
                value={planDue}
                onChange={(event) => setPlanDue(event.target.value)}
                required
              />
            </Field>
            <div className="instrument-field">
              <Field label="Instrument" hint={selectedInstrument.description}>
                <select
                  name="version"
                  value={instrumentVersion}
                  onChange={(event) => setInstrumentVersion(event.target.value)}
                >
                  {INSTRUMENTS.map((instrument) => (
                    <option key={instrument.version} value={instrument.version}>
                      {instrument.version}
                    </option>
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
                  <strong>Preview questionnaire</strong>
                  <small>
                    Up to {selectedInstrument.questions.length} questions · Try
                    different paths
                  </small>
                </span>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
            <Field label="Respondent">
              <select
                value={planRespondent}
                onChange={(event) => setPlanRespondent(event.target.value)}
              >
                <option value="Person">{displayPersonName(p)}</option>
                {p?.family &&
                  selectedInstrument?.respondents?.includes(
                    "Family respondent",
                  ) && (
                    <option value="Family respondent">
                      {displayFamilyName(p)}
                    </option>
                  )}
              </select>
            </Field>

            <fieldset className="channel-options">
              <legend>How will this follow-up be collected?</legend>
              {[
                ["SMS link", "Account-free sample link", MessageSquare],
                ["Clinic tablet", "In-person device handover", Tablet],
                [
                  "Clinician entry",
                  "Complete the questionnaire in your workspace",
                  ClipboardPen,
                ],
              ].map(([label, description, Icon]) => (
                <label
                  className={`channel ${planChannel === label ? "chosen" : ""}`}
                  key={label}
                >
                  <input
                    type="radio"
                    name="planChannel"
                    value={label}
                    checked={planChannel === label}
                    disabled={
                      label === "Clinician entry" &&
                      staff?.role !== "Clinician"
                    }
                    onChange={() => {
                      setPlanChannel(label);
                      setPlanAssistance(
                        label === "Clinician entry"
                          ? "Transcribed"
                          : "Independent",
                      );
                    }}
                  />
                  <Icon size={23} />
                  <span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                  <span className="radio-dot" />
                </label>
              ))}
            </fieldset>

            {planChannel !== "SMS link" &&
              (existingAppointmentOnPlanDue ? (
                <section
                  ref={appointmentSectionRef}
                  style={{
                    background: "var(--surface-subtle, #f8fafc)",
                    border: "1px solid var(--border, #cbd5e1)",
                    borderRadius: "8px",
                    padding: "14px 16px",
                    margin: "16px 0",
                  }}
                  aria-label="Associated appointment"
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "12px",
                      marginBottom: editingExistingAppt ? "12px" : 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                      }}
                    >
                      <Calendar
                        size={20}
                        style={{
                          color: "#2563eb",
                          marginTop: "2px",
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: "0.92rem",
                            color: "#0f172a",
                          }}
                        >
                          Associated appointment on due date
                        </div>
                        <div
                          style={{
                            fontSize: "0.85rem",
                            color: "#64748b",
                            marginTop: "2px",
                          }}
                        >
                          {formatDate(planDue)} at{" "}
                          {existingAppointmentOnPlanDue.plannedTime ||
                            existingAppointmentOnPlanDue.actualTime}{" "}
                          · {existingAppointmentOnPlanDue.deliveryMode} ·{" "}
                          {existingAppointmentOnPlanDue.practitionerService} (
                          {existingAppointmentOnPlanDue.attendance})
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          if (!editingExistingAppt) {
                            setPlanAppointmentTime(
                              existingAppointmentOnPlanDue.plannedTime ||
                                "10:00",
                            );
                            setPlanAppointmentDuration(
                              String(
                                existingAppointmentOnPlanDue.plannedDurationMinutes ||
                                  60,
                              ),
                            );
                            setPlanAppointmentPractitioner(
                              existingAppointmentOnPlanDue.practitionerService ||
                                "",
                            );
                            setPlanAppointmentDeliveryMode(
                              existingAppointmentOnPlanDue.deliveryMode ||
                                "In person",
                            );
                          }
                          setEditingExistingAppt(!editingExistingAppt);
                        }}
                      >
                        {editingExistingAppt
                          ? "Done editing"
                          : "Edit appointment"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          commit({
                            type: "DELETE_APPOINTMENT",
                            personId: p.id,
                            episodeId: e.id,
                            appointmentId: existingAppointmentOnPlanDue.id,
                          });
                          setEditingExistingAppt(false);
                          notify("Associated appointment deleted.");
                        }}
                      >
                        Delete appointment
                      </Button>
                    </div>
                  </div>

                  {editingExistingAppt && (
                    <div
                      className="form-grid"
                      style={{
                        marginTop: "12px",
                        paddingTop: "12px",
                        borderTop: "1px solid #e2e8f0",
                      }}
                    >
                      <Field label="Planned time">
                        <input
                          type="time"
                          value={planAppointmentTime}
                          onChange={(ev) =>
                            setPlanAppointmentTime(ev.target.value)
                          }
                          required
                        />
                      </Field>
                      <Field label="Duration (min)">
                        <input
                          type="number"
                          min="1"
                          max="600"
                          value={planAppointmentDuration}
                          onChange={(ev) =>
                            setPlanAppointmentDuration(ev.target.value)
                          }
                          required
                        />
                      </Field>
                      <Field label="Practitioner / service">
                        <select
                          value={planAppointmentPractitioner}
                          onChange={(ev) =>
                            setPlanAppointmentPractitioner(ev.target.value)
                          }
                        >
                          {practitionerServiceOptions(state).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Delivery mode">
                        <select
                          value={planAppointmentDeliveryMode}
                          onChange={(ev) =>
                            setPlanAppointmentDeliveryMode(ev.target.value)
                          }
                        >
                          {APPOINTMENT_DELIVERY_MODES.map((mode) => (
                            <option key={mode} value={mode}>
                              {mode}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  )}
                </section>
              ) : (
                <section
                  ref={appointmentSectionRef}
                  style={{
                    background: "var(--surface-subtle, #f8fafc)",
                    border: "1px solid var(--border, #cbd5e1)",
                    borderRadius: "8px",
                    padding: "14px 16px",
                    margin: "16px 0",
                  }}
                  aria-label="Associated appointment on assessment day"
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "12px",
                      marginBottom: planCreateAppointment ? "12px" : 0,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <Calendar size={18} style={{ color: "#2563eb" }} />
                        <strong
                          style={{ fontSize: "0.92rem", color: "#0f172a" }}
                        >
                          Day-of-assessment appointment
                        </strong>
                      </div>
                      <p
                        style={{
                          margin: "4px 0 0 0",
                          fontSize: "0.83rem",
                          color: "#64748b",
                        }}
                      >
                        Non-SMS follow-up assessments require an in-person or clinician
                        contact record on the day of assessment ({formatDate(planDue)}).
                      </p>
                    </div>
                    <label
                      style={{
                        margin: 0,
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: "#0f172a",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={planCreateAppointment}
                        onChange={(ev) =>
                          setPlanCreateAppointment(ev.target.checked)
                        }
                      />
                      <span>Create linked appointment</span>
                    </label>
                  </div>

                  {planCreateAppointment && (
                    <div
                      className="form-grid"
                      style={{
                        marginTop: "12px",
                        paddingTop: "12px",
                        borderTop: "1px solid #e2e8f0",
                      }}
                    >
                      <Field label="Planned time">
                        <input
                          type="time"
                          value={planAppointmentTime}
                          onChange={(ev) =>
                            setPlanAppointmentTime(ev.target.value)
                          }
                          required
                        />
                      </Field>
                      <Field label="Duration (min)">
                        <input
                          type="number"
                          min="1"
                          max="600"
                          value={planAppointmentDuration}
                          onChange={(ev) =>
                            setPlanAppointmentDuration(ev.target.value)
                          }
                          required
                        />
                      </Field>
                      <Field label="Practitioner / service">
                        <select
                          value={planAppointmentPractitioner}
                          onChange={(ev) =>
                            setPlanAppointmentPractitioner(ev.target.value)
                          }
                        >
                          {practitionerServiceOptions(state).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Delivery mode">
                        <select
                          value={planAppointmentDeliveryMode}
                          onChange={(ev) =>
                            setPlanAppointmentDeliveryMode(ev.target.value)
                          }
                        >
                          {APPOINTMENT_DELIVERY_MODES.map((mode) => (
                            <option key={mode} value={mode}>
                              {mode}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  )}
                </section>
              ))}
          </div>
          <div className="modal-footer">
            {formError && (
              <p className="field-error form-save-error" role="alert">
                {formError}
              </p>
            )}
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Add follow-up
            </Button>
          </div>
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
    const allowed =
      p.consent === "Recorded" &&
      p.contact === "Suitable" &&
      canCollectInEpisode(e, c) &&
      c.response !== "Submitted" &&
      !!getInstrument(c.version) &&
      getInstrument(c.version).respondents.includes(respondent) &&
      (channel !== "Clinician entry" || staff?.role === "Clinician") &&
      !["Cancelled", "Paused"].includes(c.assignment);
    const blockers = [
      p.consent !== "Recorded" &&
        `Assessment participation is ${p.consent.toLowerCase()}.`,
      p.contact !== "Suitable" &&
        `Contact suitability is ${p.contact.toLowerCase()}.`,
      !canCollectInEpisode(e, c) &&
        `This care episode is ${e.status.toLowerCase()}.`,
      c.response === "Submitted" && "A response has already been submitted.",
      !getInstrument(c.version) && "This questionnaire version is unavailable.",
      getInstrument(c.version) &&
        !getInstrument(c.version).respondents.includes(respondent) &&
        "This questionnaire collects the person’s own perspective. They can receive support with their answers.",
      channel === "Clinician entry" &&
        staff?.role !== "Clinician" &&
        "Choose a Clinician profile to complete this questionnaire.",
      ["Cancelled", "Paused"].includes(c.assignment) &&
        `This collection is ${c.assignment.toLowerCase()}.`,
    ].filter(Boolean);
    return (
      <Modal
        title={
          modal.collectResponse
            ? "Collect response"
            : channel === "Clinician entry"
            ? "Complete as clinician"
            : collectionSetupLabel(c)
        }
        subtitle={`${displayPersonName(p)} · ${c.label}`}
        onClose={onClose}
      >
        <ValidatedForm
          noValidate
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!allowed) return;
            let linkedAppointmentId = existingAppointmentToday?.id || null;
            if (
              channel !== "SMS link" &&
              createAppointment &&
              !existingAppointmentToday
            ) {
              const generatedApptId = uid();
              const apptResult = commit({
                type: "ADD_APPOINTMENT",
                id: generatedApptId,
                personId: p.id,
                episodeId: e.id,
                plannedDate: TODAY,
                plannedTime: appointmentTime,
                plannedDurationMinutes: Number(appointmentDuration) || 60,
                practitionerService: appointmentPractitioner,
                deliveryMode: appointmentDeliveryMode,
                attendance: "Planned",
                notes: `Associated appointment on day of assessment (${c.label} · ${channel})`,
              });
              if (apptResult.error) {
                setFormError(apptResult.error);
                return;
              }
              linkedAppointmentId = generatedApptId;
            }
            const result = commit({
              ...modal,
              type: "DELIVER",
              channel,
              respondent,
              assistance,
              appointmentId: linkedAppointmentId,
            });
            if (result.error) {
              setFormError(result.error);
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
              <span>{c.version}</span>
              <Badge>
                {c.link === "Expired" ? "Previous link expired" : c.response}
              </Badge>
            </div>
            {!allowed && (
              <Notice tone="amber">
                <strong>Collection needs attention</strong>
                <ul>
                  {blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
                {(p.consent !== "Recorded" || p.contact !== "Suitable") && (
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
            <Field label="Who is supplying the answers?">
              <select
                value={respondent}
                onChange={(ev) => setRespondent(ev.target.value)}
              >
                <option value="Person">{displayPersonName(p)}</option>
                {p.family &&
                  getInstrument(c.version)?.respondents.includes(
                    "Family respondent",
                  ) && (
                    <option value="Family respondent">
                      {displayFamilyName(p)}
                    </option>
                  )}
              </select>
            </Field>
            <fieldset className="channel-options">
              <legend>How will the response be collected?</legend>
              {[
                ["SMS link", "Account-free sample link", MessageSquare],
                ["Clinic tablet", "In-person device handover", Tablet],
                [
                  "Clinician entry",
                  "Complete the questionnaire in your workspace",
                  ClipboardPen,
                ],
              ].map(([label, description, Icon]) => (
                <label
                  className={`channel ${channel === label ? "chosen" : ""}`}
                  key={label}
                >
                  <input
                    type="radio"
                    name="channel"
                    value={label}
                    checked={channel === label}
                    disabled={
                      label === "Clinician entry" &&
                      staff?.role !== "Clinician"
                    }
                    onChange={() => {
                      setChannel(label);
                      setAssistance(
                        label === "Clinician entry"
                          ? "Transcribed"
                          : "Independent",
                      );
                    }}
                  />
                  <Icon size={23} />
                  <span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                  <span className="radio-dot" />
                </label>
              ))}
            </fieldset>
            <Field label="Assistance">
              <select
                value={assistance}
                onChange={(ev) => setAssistance(ev.target.value)}
              >
                {(channel === "Clinician entry"
                  ? ["Transcribed", "Joint completion"]
                  : ["Independent", "Supported"]
                ).map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </Field>
            {channel !== "SMS link" &&
              (existingAppointmentToday ? (
                <section
                  style={{
                    background: "var(--surface-subtle, #f8fafc)",
                    border: "1px solid var(--border, #e2e8f0)",
                    borderRadius: "8px",
                    padding: "12px 16px",
                    margin: "16px 0",
                  }}
                  aria-label="Associated appointment on assessment day"
                >
                  <div className="appointment-association-heading">
                    <div className="appointment-association-summary">
                      <Calendar
                        size={20}
                        style={{ color: "#2563eb", flexShrink: 0 }}
                        aria-hidden="true"
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1e293b" }}>
                          Associated appointment on assessment day
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "2px" }}>
                          {formatDate(TODAY)} at{" "}
                          {existingAppointmentToday.plannedTime ||
                            existingAppointmentToday.actualTime}{" "}
                          · {existingAppointmentToday.deliveryMode} ·{" "}
                          {existingAppointmentToday.practitionerService} (
                          {existingAppointmentToday.attendance})
                        </div>
                      </div>
                    </div>
                    <div className="appointment-association-actions">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="appointment-edit-action"
                        onClick={() => {
                          if (!editingTodayAppt) {
                            setAppointmentTime(existingAppointmentToday.plannedTime || "10:00");
                            setAppointmentDuration(String(existingAppointmentToday.plannedDurationMinutes || 60));
                            setAppointmentPractitioner(existingAppointmentToday.practitionerService || "");
                            setAppointmentDeliveryMode(existingAppointmentToday.deliveryMode || "In person");
                          }
                          setEditingTodayAppt(!editingTodayAppt);
                          setCancellingTodayAppt(false);
                          setFormError("");
                        }}
                      >
                        {editingTodayAppt ? "Discard changes" : "Edit appointment"}
                      </Button>
                      {existingAppointmentToday.attendance === "Planned" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="appointment-cancel-action"
                          onClick={() => {
                            setCancellingTodayAppt(!cancellingTodayAppt);
                            setEditingTodayAppt(false);
                            setFormError("");
                          }}
                        >
                          Cancel appointment
                        </Button>
                      )}
                    </div>
                  </div>
                  {editingTodayAppt && (
                    <div className="appointment-association-editor">
                      <div className="form-grid">
                        <Field label="Planned time">
                          <input type="time" value={appointmentTime} onChange={(ev) => setAppointmentTime(ev.target.value)} required />
                        </Field>
                        <Field label="Duration (min)">
                          <input type="number" min="1" max="600" value={appointmentDuration} onChange={(ev) => setAppointmentDuration(ev.target.value)} required />
                        </Field>
                        <Field label="Practitioner or service">
                          <select value={appointmentPractitioner} onChange={(ev) => setAppointmentPractitioner(ev.target.value)} required>
                            {practitionerServiceOptions(state.people).map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Delivery mode">
                          <select value={appointmentDeliveryMode} onChange={(ev) => setAppointmentDeliveryMode(ev.target.value)} required>
                            {APPOINTMENT_DELIVERY_MODES.map((mode) => (
                              <option key={mode} value={mode}>{mode}</option>
                            ))}
                          </select>
                        </Field>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          const duration = Number(appointmentDuration);
                          if (!appointmentTime || !Number.isInteger(duration) || duration < 1 || duration > 600 || !appointmentPractitioner || !appointmentDeliveryMode) {
                            setFormError("Complete the appointment details before saving.");
                            return;
                          }
                          const result = commit({
                            type: "UPDATE_APPOINTMENT",
                            personId: p.id,
                            episodeId: e.id,
                            appointmentId: existingAppointmentToday.id,
                            plannedTime: appointmentTime,
                            plannedDurationMinutes: duration,
                            practitionerService: appointmentPractitioner,
                            deliveryMode: appointmentDeliveryMode,
                          });
                          if (result.error) {
                            setFormError(result.error);
                            return;
                          }
                          setEditingTodayAppt(false);
                          setFormError("");
                          notify("Associated appointment updated.");
                        }}
                      >
                        Save appointment changes
                      </Button>
                    </div>
                  )}
                  {cancellingTodayAppt && (
                    <div className="appointment-association-editor">
                      <p className="muted">This marks the appointment as cancelled and keeps its record in service contacts.</p>
                      <Field label="Cancellation reason (optional)">
                        <textarea value={cancellationReason} onChange={(ev) => setCancellationReason(ev.target.value)} rows="2" />
                      </Field>
                      <div className="appointment-association-actions">
                        <Button type="button" size="sm" onClick={() => setCancellingTodayAppt(false)}>Keep appointment</Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          className="appointment-cancel-confirm"
                          onClick={() => {
                            const result = commit({
                              type: "RECORD_APPOINTMENT_OUTCOME",
                              personId: p.id,
                              episodeId: e.id,
                              appointmentId: existingAppointmentToday.id,
                              attendance: "Cancelled",
                              outcomeNotes: cancellationReason,
                            });
                            if (result.error) {
                              setFormError(result.error);
                              return;
                            }
                            setCancellingTodayAppt(false);
                            setCreateAppointment(false);
                            setCancellationReason("");
                            setFormError("");
                            notify("Associated appointment cancelled.");
                          }}
                        >
                          Confirm cancellation
                        </Button>
                      </div>
                    </div>
                  )}
                  {formError && (editingTodayAppt || cancellingTodayAppt) && (
                    <p className="field-error" role="alert">{formError}</p>
                  )}
                </section>
              ) : (
                <section
                  style={{
                    background: "var(--surface-subtle, #f8fafc)",
                    border: "1px solid var(--border, #cbd5e1)",
                    borderRadius: "8px",
                    padding: "14px 16px",
                    margin: "16px 0",
                  }}
                  aria-label="Associated appointment on assessment day"
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "12px",
                      marginBottom: createAppointment ? "12px" : 0,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <Calendar size={18} style={{ color: "#2563eb" }} />
                        <strong
                          style={{ fontSize: "0.92rem", color: "#0f172a" }}
                        >
                          Day-of-assessment appointment
                        </strong>
                      </div>
                      <p
                        style={{
                          margin: "4px 0 0 0",
                          fontSize: "0.83rem",
                          color: "#64748b",
                        }}
                      >
                        Non-SMS assessments require an in-person or clinician
                        contact record on the day of assessment (
                        {formatDate(TODAY)}).
                      </p>
                    </div>
                    <label
                      style={{
                        margin: 0,
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: "#0f172a",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={createAppointment}
                        onChange={(ev) =>
                          setCreateAppointment(ev.target.checked)
                        }
                      />
                      <span>Create appointment</span>
                    </label>
                  </div>

                  {createAppointment && (
                    <div
                      className="form-grid"
                      style={{
                        marginTop: "12px",
                        paddingTop: "12px",
                        borderTop: "1px solid #e2e8f0",
                      }}
                    >
                      <Field label="Planned time">
                        <input
                          type="time"
                          value={appointmentTime}
                          onChange={(ev) =>
                            setAppointmentTime(ev.target.value)
                          }
                          required
                        />
                      </Field>
                      <Field label="Duration (min)">
                        <input
                          type="number"
                          min="1"
                          max="600"
                          value={appointmentDuration}
                          onChange={(ev) =>
                            setAppointmentDuration(ev.target.value)
                          }
                          required
                        />
                      </Field>
                      <Field label="Practitioner or service">
                        <select
                          value={appointmentPractitioner}
                          onChange={(ev) =>
                            setAppointmentPractitioner(ev.target.value)
                          }
                          required
                        >
                          {practitionerServiceOptions(state.people).map(
                            (opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ),
                          )}
                        </select>
                      </Field>
                      <Field label="Delivery mode">
                        <select
                          value={appointmentDeliveryMode}
                          onChange={(ev) =>
                            setAppointmentDeliveryMode(ev.target.value)
                          }
                          required
                        >
                          {APPOINTMENT_DELIVERY_MODES.map((mode) => (
                            <option key={mode} value={mode}>
                              {mode}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  )}
                </section>
              ))}
            <section className="setup-summary" aria-label="Collection checks">
              <h3>Check this collection</h3>
              <dl className="metadata">
                <div>
                  <dt>Answering</dt>
                  <dd>
                    {respondent === "Family respondent"
                      ? displayFamilyName(p)
                      : displayPersonName(p)}
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
                        : `${staff?.name} records the respondent’s answers`}
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
            </section>
            {channel === "SMS link" && (
              <details className="setup-disclosure">
                <summary>Preview sample message</summary>
                <p className="message-preview">
                  Your care team at Northside Centre invites you to complete a
                  short check-in. Open your request to see what it involves
                  and how to get help.
                  <br />
                  <br />
                  [Sample questionnaire link]
                </p>
                <p className="muted">
                  Preview only. No message will be sent.
                </p>
              </details>
            )}
            <Notice>
              {respondent === "Family respondent"
                ? `${displayFamilyName(p)} provides their own contribution. This does not establish guardian authority.`
                : `${displayPersonName(p)} can answer this sample check-in by SMS link, clinic tablet, or with staff recording the answers.`}
            </Notice>
          </div>
          {footer(
            channel === "Clinician entry"
              ? "Begin questionnaire"
              : "Open questionnaire",
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
                    {item.title} · {item.version}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Delivery channel">
              <select name="channel" defaultValue="SMS link">
                <option>SMS link</option>
                <option>Clinic tablet</option>
              </select>
            </Field>
            <p className="muted">
              SMS requires suitable contact. This is labelled sample policy, not
              approved consent wording.
            </p>
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
        subtitle={`${request.status} · ${request.version}`}
        onClose={onClose}
      >
        <div className="form-body">
          <dl className="metadata">
            <div>
              <dt>Scope</dt>
              <dd>{request.scope}</dd>
            </div>
            <div>
              <dt>Channel</dt>
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
        <div className="modal-footer">
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
        </div>
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
                  Closing assigns the patient an episode closure assessment and a separate care experience feedback questionnaire, due seven days from today. This prototype prepares sample links but sends no SMS.
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
                <p>Two new patient questionnaires will be assigned to this closed episode. If participation or contact settings are unsuitable, their links will wait for review.</p>
              )}
            </div>
            <label className="check-field">
              <input type="checkbox" required />
              <span>
                I have reviewed outstanding work and the next care step.
              </span>
            </label>
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
                : "The original value, source and outcome stay in history. Submitted questionnaire answers are unaffected."}
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
  const content = {
    about: [
      "About this workspace",
      "A working model of the YSCC assessment experience.",
      <>
        <p>
          Explore staff work, people and care episodes, sample questionnaire
          collection, clinical review, and data corrections.
        </p>
        <Notice>
          Fictional people, sample instrument and sample policies. Changes stay
          in this browser. SMS delivery, staff authentication, and clinical
          scoring are not connected.
        </Notice>
        <p>
          The scenario date is 15 September 2026. Use Administration to reset
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
          completion and comparison. Follow-ups require a named collection point
          and an explicit due date inside an active episode.
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
        <div className="message-preview">
          Your care team has invited you to complete a short check-in. Open your
          secure request to see what it involves and get help if you need it.
          <br />
          <br />
          [Scoped questionnaire link]
        </div>
        <Notice>
          This is a local preview. No SMS provider, contact number, or live send
          is connected.
        </Notice>
      </>,
    ],
    reset: [
      "Reset sample workspace",
      "This affects only the workspace’s sample data.",
      <>
        <p>
          Return to the original sample people and their tasks. Your local
          demo changes and questionnaire drafts will be removed.
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
        <p>River returns to intake in progress. Samira returns to completed intake, ready to plan the initial assessment. Other people and their work stay as they are.</p>
        <Button
          variant="primary"
          onClick={() => {
            const result = commit({ type: "RESET_INTAKE_EXAMPLES", resetToken: uid() });
            if (result.error) return setFormError(result.error);
            onClose();
            navigate("/people/YS-1031?tab=intake");
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
              <p className="small muted" style={{ margin: 0 }}>Operational • Query Latency 0.6ms</p>
            </div>
            <Badge tone="green">Normal</Badge>
          </div>
          <div className="status-item">
            <span className="system-status-dot green" />
            <div>
              <strong>Clinical API Gateway</strong>
              <p className="small muted" style={{ margin: 0 }}>Operational • Response Time 14ms</p>
            </div>
            <Badge tone="green">Normal</Badge>
          </div>
          <div className="status-item">
            <span className="system-status-dot green" />
            <div>
              <strong>Session & Security Services</strong>
              <p className="small muted" style={{ margin: 0 }}>Active • 256-bit Encrypted</p>
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
        <p style={{ margin: "0 0 16px" }}>
          Are you sure you want to log out of <strong>{staff?.name || "Workspace Session"}</strong>?
        </p>
        <div style={{ display: "flex", gap: "10px" }}>
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
      <div className="modal-footer">
        <Button onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}
