import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useStore } from "../store";
import { appTerm } from "../terminology.js";
import { patientIdentifier, patientSecondaryDetail } from "../patientIdentity";
import AppointmentSlotPicker from "../components/AppointmentSlotPicker";
import { PROGRAM_STREAMS, UNIDENTIFIED_EPISODE_STREAM } from "../carePeriods";
import {
  REFERRAL_SOURCES, GENDER_OPTIONS, SEXUALITY_OPTIONS, ATSI_OPTIONS,
  EDUCATION_OPTIONS, PROFILE_FIELDS, derivedEpisodeStream,
} from "../batch1Registration";
import { assessmentSchedulingEnabled, assessmentContactLinkingEnabled } from "../assessmentFeatures";
import { mvpAssessmentMode, mvpInitialBundles, mvpInitialVersions } from "../mvpAssessmentPathway";
import { clientProfileBundle } from '../clientProfileMeasure';
import { getInstrument } from "../instruments";
import Appointments from "./Appointments";
import {
  TODAY,
  currentStaff,
  formatTimestamp,
  displayPersonName,
} from "../model";
import { INTAKE_CHECKS, intakeReady, intakeActionError } from "../intake";
import useDraft from "../useDraft";
import { safeReturnTo } from "../workflow";
import {
  ActionGroup, Badge,
  Button,
  Field,
  FormErrorSummary,
  Modal,
  Notice,
  Panel,
  RecordTabs,
  Empty,
  ValidatedForm,
} from "../components/UI";

export function RegisterPerson({ onClose, navigate, notify }) {
  const { state, commit } = useStore(),
    staff = currentStaff(state);
  const mvpProfile = mvpAssessmentMode(state.settings);
  const [requestId] = useState(() => crypto.randomUUID());
  const [name, setName] = useState(""),
    [error, setError] = useState("");
  const duplicate =
    name.trim() &&
    state.people.find(
      (p) =>
        !p.nameUnknown && p.name.toLowerCase() === name.trim().toLowerCase(),
    );
  return (
    <Modal
      title={mvpProfile ? "New profile" : "Register for intake"}
      subtitle={mvpProfile ? "Add the essentials now. Complete the profile details in the new record." : "Create the young person record, then complete registration in intake."}
      onClose={onClose}
    >
      <ValidatedForm
        onSubmit={(event) => {
          event.preventDefault();
          const values = Object.fromEntries(new FormData(event.currentTarget));
          const action = {
            type: "ADD_PERSON",
            dob: values.dob || "",
            name,
            nameUnknown: false,
            owner: staff?.name || "",
            nextAction: mvpProfile ? clientProfileBundle(state.settings)?.enabled ? "Complete Client profile" : "Begin initial assessment" : "Complete registration",
            reviewDate: TODAY,
            requestId,
            mvpProfile,
            programStream: mvpProfile ? values.programStream : "",
          };
          const problem = intakeActionError(state, action, staff);
          if (problem) return setError(problem);
          const result = commit(action);
          if (result.error) return setError(result.error);
          const person = result.state.people.find(
            (p) => p.registrationRequestId === requestId,
          );
          onClose();
          navigate(`/people/${person.id}`);
          notify(mvpProfile ? clientProfileBundle(state.settings)?.enabled
            ? "Profile created. Complete Client profile to prepare the initial assessment."
            : "Profile created. The initial assessment is ready." : "Person registered. Intake is ready to begin.");
        }}
      >
        <div className="form-body registration-form-body">
          {!mvpProfile && <p className="muted">Name and date of birth create the profile. registration fields are completed in intake.</p>}
          <Field label="Young person’s name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="off"
              placeholder="e.g. Alex Morgan"
            />
          </Field>
          {duplicate && (
            <Notice tone="amber">
              A matching name exists.{" "}
              <button
                type="button"
                className="inline-link"
                onClick={() => {
                  onClose();
                  navigate(`/people/${duplicate.id}`);
                }}
              >
                Review {displayPersonName(duplicate)}’s record
              </button>
            </Notice>
          )}
          <Field label={mvpProfile ? "Date of birth (optional)" : "Date of birth"}>
            <input name="dob" type="date" max={TODAY} required={!mvpProfile} />
          </Field>
          {mvpProfile && <Field label="Episode stream">
            <select name="programStream" defaultValue="" required>
              <option value="">Choose an episode stream</option>
              <option value={UNIDENTIFIED_EPISODE_STREAM}>{UNIDENTIFIED_EPISODE_STREAM}</option>
              {PROGRAM_STREAMS.map(stream => <option key={stream} value={stream}>{stream}</option>)}
            </select>
          </Field>}
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
        </div>
        <ActionGroup className="modal-footer">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={!!duplicate}>
            {mvpProfile ? "Create profile" : "Register and open intake"}
          </Button>
        </ActionGroup>
      </ValidatedForm>
    </Modal>
  );
}

export function IntakeHistory({ intake, bare = false }) {
  const entries = (
      <ol className="intake-history">
        {intake.history.map((event) => (
          <li key={event.id}>
            <div>
              <strong>{event.title}</strong>
              <small>
                {formatTimestamp(event.timestamp)} · {event.actor}
              </small>
            </div>
            <p>{event.detail}</p>
            {event.priorIdentity && (
              <small>
                Previously recorded: {event.priorIdentity.name} · date of birth{" "}
                {event.priorIdentity.dob}
              </small>
            )}
            {event.snapshot && (
              <details>
                <summary>View saved intake details</summary>
                <dl className="metadata">
                  {Object.entries(event.snapshot)
                    .filter(
                      ([key, value]) =>
                        value !== "" &&
                        ["string", "boolean", "number"].includes(
                          typeof value,
                        ) &&
                        key !== "changeReason",
                    )
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt>
                          {INTAKE_CHECKS.find(([k]) => k === key)?.[1] ||
                            key.replace(/([A-Z])/g, " $1")}
                        </dt>
                        <dd>
                          {typeof value === "boolean"
                            ? value
                              ? "Reviewed"
                              : "Unresolved"
                            : value}
                        </dd>
                      </div>
                    ))}
                </dl>
              </details>
            )}
          </li>
        ))}
      </ol>
  );
  return bare ? entries : (
    <details className="collection-details-accordion intake-history-accordion">
      <summary>
        <span>Intake history</span>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      {entries}
    </details>
  );
}

function intakeFieldErrors(_draft, _outcomeDraft, _mode, modelError) {
  const errors = {};
  if (modelError.includes("matching name exists")) errors.displayName = "A matching name exists. Check the identity before saving.";
  if (modelError.includes("supplied date of birth")) errors.dob = "Enter a valid date of birth.";
  return errors;
}

const INTAKE_ERROR_LABELS = {
  displayName: "Preferred / supplied name",
  dob: "Date of birth",
};

export function IntakePanel({ person, intake, navigate }) {
  const { state, commit } = useStore(),
    staff = currentStaff(state);
  const searchParams = useSearchParams();
  const [draft, setDraft, _clearDraft, draftError] = useDraft(
    `intake:${intake.id}:${intake.revision}:${person.intakeResetToken || "original"}`,
    {
      ...intake,
      ...Object.fromEntries(PROFILE_FIELDS.map((key) => [key, person[key] || intake[key] || ""])),
    },
  );
  const [error, setError] = useState(""),
    [saveMessage, setSaveMessage] = useState("");
  const [validationMode, setValidationMode] = useState("");
  const [validationAttempt, setValidationAttempt] = useState(0);
  const errorSummaryRef = useRef(null);
  const validationErrors = intakeFieldErrors(draft, {}, validationMode, error);
  const validationItems = Object.entries(validationErrors).map(([key, message]) => ({
    id: `intake-${key}`,
    label: INTAKE_ERROR_LABELS[key] || key,
    message,
  }));
  useEffect(() => {
    if (validationAttempt) errorSummaryRef.current?.focus();
  }, [validationAttempt]);
  const reportValidation = (mode, message = "") => {
    setValidationMode(mode);
    setError(message);
    setSaveMessage("");
    setValidationAttempt((attempt) => attempt + 1);
  };
  const episode = person.episodes.find((item) => item.id === intake.episodeId);
  const stream = derivedEpisodeStream(draft, episode);
  const change = (key, value) => {
    setError("");
    setSaveMessage("");
    setDraft((d) => ({ ...d, [key]: value }));
  };
  const field = (
    key,
    label,
    {
      type = "text",
      hint,
      multiline = false,
      required = false,
      staff = false,
    } = {},
  ) => (
    <Field label={label} hint={hint} error={validationErrors[key]}>
      {staff ? (
        <StaffPicker
          id={`intake-${key}`}
          value={draft[key] || ""}
          onChange={(value) => change(key, value)}
          required={required}
          invalid={Boolean(validationErrors[key])}
        />
      ) : multiline ? (
        <textarea
          id={`intake-${key}`}
          rows={2}
          value={draft[key] || ""}
          required={required}
          aria-invalid={Boolean(validationErrors[key]) || undefined}
          onChange={(e) => change(key, e.target.value)}
        />
      ) : (
        <input
          id={`intake-${key}`}
          type={type}
          value={draft[key] || ""}
          required={required}
          aria-invalid={Boolean(validationErrors[key]) || undefined}
          onChange={(e) => change(key, e.target.value)}
        />
      )}
    </Field>
  );
  const selectField = (key, label, options, hint) => (
    <Field label={label} hint={hint}>
      <select id={`intake-${key}`} value={draft[key] || ""} onChange={(event) => change(key, event.target.value)}>
        <option value="">Not recorded</option>
        {draft[key] && !options.includes(draft[key]) && <option value={draft[key]}>{draft[key]} (previously recorded)</option>}
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </Field>
  );
  const submit = (action, successMessage, failedMode = "") => {
    const full = {
      ...action,
      personId: person.id,
      intakeId: intake.id,
      revision: intake.revision,
    };
    const problem = intakeActionError(state, full, staff);
    if (problem) {
      reportValidation(failedMode, problem);
      return false;
    }
    const result = commit(full);
    if (result.error) {
      reportValidation(failedMode, result.error);
      return false;
    }
    setError("");
    setValidationMode("");
    if (action.type === "REOPEN_INTAKE") {
      const reopenedPerson = result.state.people.find((p) => p.id === person.id);
      const reopenedIntake = reopenedPerson?.intakes.find(
        (i) => i.id === intake.id,
      );
      if (reopenedPerson && reopenedIntake) {
        setDraft({
          ...reopenedIntake,
          ...Object.fromEntries(PROFILE_FIELDS.map((key) => [key, reopenedPerson[key] || reopenedIntake[key] || ""])),
        });
      }
      setSaveMessage("Intake reopened. Update it before completing intake again.");
    }
    if (action.type === "SAVE_INTAKE") {
      const savedPerson = result.state.people.find((p) => p.id === person.id);
      const savedIntake = savedPerson?.intakes.find((i) => i.id === intake.id);
      if (savedPerson && savedIntake) {
        setDraft({
          ...savedIntake,
          ...Object.fromEntries(PROFILE_FIELDS.map((key) => [key, savedPerson[key] || savedIntake[key] || ""])),
        });
      }
      setSaveMessage(successMessage || "Intake saved. This update is recorded.");
    }
    return true;
  };
  const saveIntake = () => {
    setValidationMode("");
    submit({
      type: "SAVE_INTAKE",
      values: { ...draft, changeReason: "registration fields saved." },
    }, "Registration fields saved.");
  };
  return (
    <ValidatedForm
      className="stack intake-form"
      onSubmit={(e) => {
        e.preventDefault();
        saveIntake();
      }}
    >
      {draftError && (
        <Notice tone="amber">
          This browser cannot keep an intake draft. Keep this page open until
          your changes are saved.
        </Notice>
      )}
      <div className="intake-sections">
        <div className="stack">
          <Panel>
            <div className="panel-body stack">
              <div className="form-grid">
                {field("clientPostcode", "Young person’s postcode", { hint: "Four digits, if known." })}
                {selectField("clientGender", "Gender", GENDER_OPTIONS)}
              </div>
              <div className="form-grid">
                {selectField("clientSexuality", "Sexual orientation", SEXUALITY_OPTIONS)}
                {selectField("clientAtsiStatus", "Aboriginal and/or Torres Strait Islander", ATSI_OPTIONS)}
              </div>
              <div className="form-grid">
                {field("clientCountryOfBirth", "Country of birth", { hint: "Enter the response as recorded, or ‘Prefer not to answer’." })}
                {field("clientLanguageHome", "Language spoken at home", { hint: "Enter the response as recorded, or ‘Prefer not to answer’." })}
              </div>
              <div className="form-grid">
                {field("clientEthnicity", "Main cultural background other than Australian or Aboriginal and Torres Strait Islander", { hint: "Enter the response as recorded, or ‘Prefer not to answer’." })}
                {selectField("clientEducationLevel", "Highest education level at episode", EDUCATION_OPTIONS)}
              </div>
            </div>
          </Panel>
          <Panel title="Episode dates and referral" verbatim>
            <div className="panel-body stack">
              <p className="muted">Referral details belong to the episode. Stream dates are recorded here and inform the calculated extract stream.</p>
              <div className="form-grid">
                {field("commencementDate", "Service commencement date", { type: "date" })}
                <Field label="Referral date" hint="If known.">
                  <input id="intake-referralDate" type="date" max={TODAY} value={draft.referralDate || ""} onChange={(event) => change("referralDate", event.target.value)} />
                </Field>
              </div>
              <div className="form-grid">
                <Field label="Referral source">
                  <select id="intake-source" value={draft.source || "Unknown"} onChange={(event) => change("source", event.target.value)}>
                    <option value="Unknown">Not recorded</option>
                    {draft.source && draft.source !== "Unknown" && !REFERRAL_SOURCES.includes(draft.source) && <option value={draft.source}>{draft.source} (previously recorded)</option>}
                    {REFERRAL_SOURCES.map((source) => <option key={source} value={source}>{source}</option>)}
                  </select>
                </Field>
              </div>
              <div className="form-grid">
                {field("commencementDateUhr", "Clinician-recorded UHR commencement date", { type: "date" })}
                {field("commencementDateFep", "Clinician-recorded FEP commencement date", { type: "date" })}
              </div>
            </div>
          </Panel>
          <div className="stack intake-registration-save">
              {saveMessage && <p className="form-save-success" role="status">{saveMessage}</p>}
              {validationItems.length > 0 || error ? (
                <FormErrorSummary
                  containerRef={errorSummaryRef}
                  title={`Registration not saved · ${validationItems.length || 1} ${validationItems.length === 1 ? "item" : "items"} to check`}
                  description={error || "Correct the highlighted fields, then save again."}
                  items={validationItems}
                />
              ) : <p className="muted">Save the registration fields entered above. Leave unknown values blank.</p>}
              <Button type="submit" variant="primary">Save registration</Button>
          </div>
        </div>
      </div>
    </ValidatedForm>
  );
}

export function IntakeAssessmentPanel({ person, intake, navigate, onReopen, reopenError }) {
  const { state, commit } = useStore();
  const scheduleAssessments = assessmentSchedulingEnabled(state.settings);
  const linkAssessmentAppointments = assessmentContactLinkingEnabled(state.settings);
  const [due, setDue] = useState(TODAY);
  const [programStream, setProgramStream] = useState("");
  const [error, setError] = useState("");
  const [externalSlot, setExternalSlot] = useState(null);
  const mvpProfile = mvpAssessmentMode(state.settings);
  const initialAssessmentInstruments = mvpProfile && programStream
    ? [...new Set(mvpInitialBundles(state.settings)
        .filter((bundle) => bundle.enabled && bundle.programStream === programStream)
        .flatMap((bundle) => mvpInitialVersions(bundle, programStream)))]
        .map((version) => getInstrument(version)?.name)
        .filter(Boolean)
    : [];
  const ready = intakeReady(intake);
  const episode = person.episodes.find((item) => item.id === intake.episodeId);
  const assessmentPlanned = Boolean(episode?.collections?.[0]?.due);
  const canReopen = intake.status === "Completed" && !assessmentPlanned &&
    person.episodes.every((item) => item.id === intake.episodeId);
  const startAssessment = (event) => {
    event.preventDefault();
    const action = {
      type: "START_ASSESSMENT",
      personId: person.id,
      intakeId: intake.id,
      revision: intake.revision,
      due,
      programStream,
      externalAppointment: linkAssessmentAppointments ? externalSlot : null,
    };
    const problem = intakeActionError(state, action, currentStaff(state));
    if (problem) return setError(problem);
    const result = commit(action);
    if (result.error) return setError(result.error);
    navigate(`/people/${person.id}?tab=assessment`);
  };

  return (
    <div className="stack">
      <Panel title="Initial assessment" verbatim={mvpProfile} action={<Badge>{ready ? "Ready to plan" : "Waiting for intake"}</Badge>}>
        <div className="panel-body stack">
          <dl className="metadata">
          </dl>
          {ready && episode && !scheduleAssessments ? (
            <div className="stack">
              <Notice>The initial assessment is planned. Open it to save a draft or complete the response.</Notice>
              <Button variant="primary" onClick={() => navigate(`/people/${person.id}?episode=${intake.episodeId}&tab=assessment`)}>
                Open assessment
              </Button>
            </div>
          ) : ready ? (
            assessmentPlanned ? (
              <Button
                variant="primary"
                onClick={() => navigate(`/people/${person.id}?episode=${intake.episodeId}&tab=assessment`)}
              >
                Open assessment plan
              </Button>
            ) : (
              <ValidatedForm className="stack" onSubmit={startAssessment}>
                <Notice>
                  {intake.assessmentOwner || intake.owner} owns the next step. Set the due date
                  and program stream to place the initial assessment in the record.
                </Notice>
                <Field label="Initial assessment due date">
                  <input
                    type="date"
                    min={TODAY}
                    required
                    value={due}
                    onChange={(event) => { setDue(event.target.value); setExternalSlot(null); }}
                  />
                </Field>
                <Field label="Program stream">
                  <select required value={programStream} onChange={(event) => setProgramStream(event.target.value)}>
                    <option value="">Choose stream</option>
                    {PROGRAM_STREAMS.map((stream) => <option key={stream} value={stream}>{stream}</option>)}
                  </select>
                </Field>
                {mvpProfile && programStream && (
                  <section className="mvp-initial-assessment-preview" aria-label="Initial assessment">
                    <div className="mvp-initial-assessment-preview-heading">
                      <h3>Young person</h3>
                      <Badge>{initialAssessmentInstruments.length} measures</Badge>
                    </div>
                    {initialAssessmentInstruments.length > 0
                      ? <ul>{initialAssessmentInstruments.map((name) => <li key={name}>{name}</li>)}</ul>
                      : <p className="muted">No initial assessment measures are configured for this stream.</p>}
                  </section>
                )}
                {linkAssessmentAppointments && <AppointmentSlotPicker key={due} mode="assessment" dueDate={due} selectedSlot={externalSlot} onSelect={setExternalSlot} />}
                {error && <p role="alert" className="field-error">{error}</p>}
                <ActionGroup className="intake-assessment-actions">
                  <Button type="submit" variant="primary">Create assessment plan</Button>
                  {canReopen && onReopen && <Button type="button" onClick={onReopen}>Reopen intake</Button>}
                </ActionGroup>
              </ValidatedForm>
            )
          ) : (
            <Notice tone="amber">
              Save registration before planning the initial assessment.
            </Notice>
          )}
          {!ready && canReopen && onReopen && (
            <Button type="button" onClick={onReopen}>Reopen intake</Button>
          )}
          {reopenError && <p className="field-error" role="alert">{reopenError}</p>}
        </div>
      </Panel>
    </div>
  );
}

export default function IntakeWorkspace({ person, navigate, openModal }) {
  const params = useSearchParams(),
    intake = person.intakes[0];
  const returnTo = safeReturnTo(params.get("returnTo"));
  const recordTabsUnlocked = intakeReady(intake);
  const lockedTab = (value, label = value) => ({
    value,
    label,
    disabled: !recordTabsUnlocked,
    title: !recordTabsUnlocked ? "Available after registration is saved" : undefined,
  });
  const tabs = ["Overview", lockedTab("Assessment", appTerm("measures")), "Events"];
  const requestedTab = params.get("tab")?.toLowerCase();
  const tab = tabs.find((item) => (typeof item === "string" ? item : item.value).toLowerCase() === requestedTab);
  const selectedTab = tab && (typeof tab === "string" || !tab.disabled)
    ? (typeof tab === "string" ? tab : tab.value)
    : "Overview";
  const setTab = (value) => {
    if (!recordTabsUnlocked && value !== "Overview") return;
    navigate(`/people/${person.id}${value === "Overview" ? "" : `?tab=${encodeURIComponent(value.toLowerCase())}`}`, { scroll: false });
  };
  return (
    <>
      <button className="back-link" onClick={() => navigate(returnTo)}>
        <ArrowLeft size={17} />
        Back to {returnTo.split("?")[0] === "/" ? "My work" : "people"}
      </button>
      <div className="person-heading">
        <div>
          <div className="intake-heading-title-row">
            <h1>{patientIdentifier(person)}</h1>
            <Badge>{intake.status}</Badge>
          </div>
          {patientSecondaryDetail(person) && <p>{patientSecondaryDetail(person)}</p>}
        </div>
      </div>
      <div className="person-content-surface person-open-surface">
        <div className="person-record-navigation">
          <RecordTabs id="person" label="Person record" items={tabs} value={selectedTab} onChange={setTab} />
        </div>
        <div id="person-panel" role="tabpanel" aria-labelledby={`person-tab-${tabs.findIndex((item) => (typeof item === "string" ? item : item.value) === selectedTab)}`}>
          {selectedTab === "Overview" && (
            <div id="intake-workspace-panel" className="stack intake-workspace-sections">
              <IntakePanel
                key={`${intake.id}:${intake.revision}:${person.intakeResetToken || "original"}`}
                person={person}
                intake={intake}
                navigate={navigate}
              />
            </div>
          )}
          {selectedTab === "Assessment" && (
            <div className="stack intake-workspace-sections">
              {intakeReady(intake)
                ? <IntakeAssessmentPanel person={person} intake={intake} navigate={navigate} />
                : <Empty title="Assessment has not started">Save registration on Overview to plan the initial assessment.</Empty>}
            </div>
          )}
          {selectedTab === "Events" && intake.episodeId && person.episodes.find((item) => item.id === intake.episodeId) && (
            <Appointments
              episode={person.episodes.find((item) => item.id === intake.episodeId)}
              openModal={(modal) => openModal({ ...modal, personId: person.id })}
            />
          )}
          {selectedTab === "Events" && !intake.episodeId && (
            <Empty title={`No ${appTerm("contacts").toLowerCase()} yet`}>
              Record an initial contact once the intake episode has been created.
            </Empty>
          )}

        </div>
      </div>
    </>
  );
}
