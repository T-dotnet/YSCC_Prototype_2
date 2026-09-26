import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useStore } from "../store";
import AppointmentSlotPicker from "../components/AppointmentSlotPicker";
import { PROGRAM_STREAMS } from "../carePeriods";
import {
  TODAY,
  currentStaff,
  formatDate,
  formatTimestamp,
  age,
  displayPersonName,
} from "../model";
import {
  INTAKE_CHECKS,
  intakeCheckFieldsError,
  intakeStepComplete,
  intakeReady,
  intakeActionError,
} from "../intake";
import useDraft from "../useDraft";
import { safeReturnTo } from "../workflow";
import {
  Badge,
  Button,
  Field,
  FormErrorSummary,
  Modal,
  Notice,
  Panel,
  RecordTabs,
  Empty,
  StaffPicker,
  ValidatedForm,
} from "../components/UI";
import Referrals from "./Referrals";

export function RegisterPerson({ onClose, navigate, notify }) {
  const { state, commit } = useStore(),
    staff = currentStaff(state);
  const [requestId] = useState(() => crypto.randomUUID());
  const [name, setName] = useState(""),
    [unknown, setUnknown] = useState(false),
    [error, setError] = useState("");
  const duplicate =
    !unknown &&
    name.trim() &&
    state.people.find(
      (p) =>
        !p.nameUnknown && p.name.toLowerCase() === name.trim().toLowerCase(),
    );
  return (
    <Modal
      title="Register for intake"
      subtitle="Every new patient starts with an owned intake."
      onClose={onClose}
    >
      <ValidatedForm
        onSubmit={(event) => {
          event.preventDefault();
          const values = Object.fromEntries(new FormData(event.currentTarget));
          const action = {
            type: "ADD_PERSON",
            ...values,
            name: unknown ? "" : name,
            nameUnknown: unknown,
            requestId,
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
          notify("Person registered. Intake is ready to begin.");
        }}
      >
        <div className="form-body">
          <Notice>
            Use fictional details only. Registration saves the person and
            intake; assessment planning follows the intake decision.
          </Notice>
          <Field label="Preferred / supplied name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={unknown}
              required={!unknown}
              autoComplete="off"
              placeholder="e.g. Alex Morgan"
            />
          </Field>
          <label className="check-field">
            <input
              type="checkbox"
              checked={unknown}
              onChange={(e) => setUnknown(e.target.checked)}
            />
            Name not yet known
          </label>
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
          <div className="form-grid">
            <Field
              label="Date of birth (if known)"
              hint="Leave blank if unknown."
            >
              <input name="dob" type="date" max={TODAY} />
            </Field>
            <Field label="Pronouns (optional)">
              <select name="pronouns">
                <option>Not recorded</option>
                <option>They/them</option>
                <option>She/her</option>
                <option>He/him</option>
                <option>Use name</option>
              </select>
            </Field>
          </div>
          <Field label="Intake owner">
            <StaffPicker
              name="owner"
              defaultValue={staff?.name || ""}
              required
            />
          </Field>
          <Field label="Next action">
            <input
              name="nextAction"
              defaultValue="Complete intake and resolve required checks"
              required
            />
          </Field>
          <Field label="Next review date">
            <input
              name="reviewDate"
              type="date"
              defaultValue={TODAY}
              required
            />
          </Field>
          <p className="muted">
            Northside Centre · Contact details can be added during intake. A
            private phone or email is optional.
          </p>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={!!duplicate}>
            Register and open intake
          </Button>
        </div>
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

function intakeFieldErrors(draft, outcomeDraft, mode, modelError) {
  const errors = {};
  if (mode) {
    for (const [key] of INTAKE_CHECKS) {
      if (draft[key] !== true) errors[key] = "Confirm this check before saving intake.";
    }
    if (!draft.reviewer?.trim()) errors.reviewer = "Choose a triage reviewer.";
    if (!draft.nextAction?.trim()) errors.nextAction = "Enter the next step.";
  }
  if (mode === "outcome") {
    if (!draft.consentRecorded && outcomeDraft.outcome !== "Closed incomplete")
      errors.consentRecorded = "Record consent before completing intake.";
    if (!draft.consentReference?.trim() && outcomeDraft.outcome !== "Closed incomplete")
      errors.consentReference = "Enter the consent source or reference.";
    if (outcomeDraft.outcome !== "Closed incomplete") {
      if (!["Person", "Family respondent"].includes(draft.respondentPreference))
        errors.respondentPreference = "Choose who will complete the initial assessment.";
      if (draft.respondentPreference === "Family respondent" && !draft.respondentName?.trim())
        errors.respondentName = "Enter the family respondent's name.";
    }
    if (!outcomeDraft.outcome) errors.outcome = "Choose an intake outcome.";
  }
  if (modelError.includes("matching name exists")) errors.displayName = "A matching name exists. Check the identity before saving.";
  if (modelError.includes("supplied date of birth")) errors.dob = "Enter a valid date of birth.";
  if (modelError.includes("received date and time")) errors.receivedAt = "Enter a valid received date and time.";
  return errors;
}

const INTAKE_ERROR_LABELS = {
  ...Object.fromEntries(INTAKE_CHECKS.map(([key, label]) => [key, label])),
  displayName: "Preferred / supplied name",
  dob: "Date of birth",
  receivedAt: "Contact received",
  reviewer: "Assigned triage reviewer",
  nextAction: "Next step",
  consentRecorded: "Consent for assessment participation",
  consentReference: "Consent source / reference",
  respondentPreference: "Initial assessment respondent",
  respondentName: "Family respondent name",
  outcome: "Outcome",
};

export function IntakePanel({ person, intake, navigate, mobileReferrals }) {
  const { state, commit } = useStore(),
    staff = currentStaff(state);
  const searchParams = useSearchParams();
  const [draft, setDraft, _clearDraft, draftError] = useDraft(
    `intake:${intake.id}:${intake.revision}:${person.intakeResetToken || "original"}`,
    {
      ...intake,
      displayName: person.nameUnknown ? "" : person.name,
      dob: person.dob || "",
      respondentName: intake.respondentName || person.family || "",
    },
  );
  const [outcomeDraft, setOutcomeDraft, _clearOutcomeDraft, outcomeDraftError] = useDraft(
    `intake-outcome:${intake.id}:${person.intakeResetToken || "original"}`,
    { outcome: "" },
  );
  const [error, setError] = useState(""),
    [saveMessage, setSaveMessage] = useState("");
  const [validationMode, setValidationMode] = useState("");
  const [validationAttempt, setValidationAttempt] = useState(0);
  const errorSummaryRef = useRef(null);
  const validationErrors = intakeFieldErrors(draft, outcomeDraft, validationMode, error);
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
  const finalised = ["Completed", "Closed incomplete"].includes(intake.status);
  const change = (key, value) => {
    setError("");
    setSaveMessage("");
    setDraft((d) => ({ ...d, [key]: value }));
  };
  const changeContactMethod = (contactMethod) => {
    setError("");
    setSaveMessage("");
    setDraft((current) => contactMethod === current.contactMethod ? current : ({
      ...current,
      contactMethod,
      contactValue: "",
      contactHolder: "",
    }));
  };
  const directContact = ["Phone", "Email", "SMS"].includes(draft.contactMethod);
  const supporterContact = draft.contactMethod === "Through a supporter";
  const staffContact = draft.contactMethod === "Staff-assisted / in person";
  const noSuitableContact = draft.contactMethod === "No suitable contact";
  const legacyContact = ![
    "Not yet discussed", "Phone", "Email", "SMS", "Through a supporter",
    "Staff-assisted / in person", "No suitable contact",
  ].includes(draft.contactMethod);
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
          displayName: reopenedPerson.nameUnknown ? "" : reopenedPerson.name,
          dob: reopenedPerson.dob || "",
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
          displayName: savedPerson.nameUnknown ? "" : savedPerson.name,
          dob: savedPerson.dob || "",
        });
      }
      setSaveMessage(successMessage || "Intake saved. This update is recorded.");
    }
    return true;
  };
  const changeOutcome = (key, value) => {
    setError("");
    setSaveMessage("");
    setOutcomeDraft((current) => ({ ...current, [key]: value }));
  };
  const recordOutcome = () => {
    if (!intakeStepComplete(intake)) {
      reportValidation("checks", "Save the required intake checks before recording an outcome.");
      return;
    }
    if (Object.keys(intakeFieldErrors(draft, outcomeDraft, "outcome", "")).length) {
      reportValidation("outcome");
      return;
    }
    const checkProblem = intakeCheckFieldsError(draft);
    if (checkProblem) return reportValidation("outcome", checkProblem);
    const closedIncomplete = outcomeDraft.outcome === "Closed incomplete";
    const saved = submit({
      type: "SAVE_INTAKE",
      validatedChecks: true,
      values: {
        ...intake,
        ...draft,
        status: closedIncomplete ? "Closed incomplete" : "Completed",
        outcome: closedIncomplete ? "" : outcomeDraft.outcome,
        decisionAt: closedIncomplete ? "" : new Date().toISOString(),
        assessmentOwner: outcomeDraft.outcome === "Proceed" ? intake.owner : "",
        changeReason: `Intake outcome recorded: ${outcomeDraft.outcome}.`,
      },
    }, undefined, "outcome");
    if (saved) {
      setOutcomeDraft({ outcome: "" });
      navigate(`/people/${person.id}`, { scroll: false });
    }
  };
  const saveIntake = (validateChecks) => {
    if (validateChecks) {
      if (Object.keys(intakeFieldErrors(draft, outcomeDraft, "checks", "")).length)
        return reportValidation("checks");
      const problem = intakeCheckFieldsError(draft);
      if (problem) return reportValidation("checks", problem);
    }
    setValidationMode("");
    submit({
      type: "SAVE_INTAKE",
      validatedChecks: validateChecks,
      values: {
        ...draft,
        status: intake.status,
        owner: intake.owner,
        reviewDate: intake.reviewDate,
        waitingReason: intake.waitingReason,
        waitingOn: intake.waitingOn,
        communication: intake.communication,
        summary: intake.summary,
        checkEvidence: intake.checkEvidence,
        outcome: intake.outcome,
        decisionAt: intake.decisionAt,
        assessmentOwner: intake.assessmentOwner,
        changeReason: validateChecks
          ? "Required intake checks and entered details saved."
          : "Intake draft saved.",
      },
    }, validateChecks
      ? "Required intake checks and entered details saved. The intake state is unchanged."
      : "Draft saved. The intake state is unchanged.", validateChecks ? "checks" : "");
  };
  if (finalised)
    return (
      <div className="stack">
        <div className="section-toolbar">
          <div>
            <h2>Intake information</h2>
            <p>Review the saved intake and assessment decision.</p>
          </div>
          <Badge>{intake.status}</Badge>
        </div>
        <Notice>{intake.status === "Completed"
          ? "Intake completed. Review the saved details below and plan the initial assessment when ready."
          : "Intake closed incomplete. Review the saved details and recorded decision below."}</Notice>
        <div className="intake-sections">
          <Panel title="Saved intake">
            <div className="panel-body stack intake-detail-body">
              <dl className="metadata">
                <div><dt>Preferred / supplied name</dt><dd>{person.name || "Not recorded"}</dd></div>
                <div><dt>Contact received</dt><dd>{intake.receivedAt ? formatTimestamp(intake.receivedAt) : "Not recorded"}</dd></div>
                <div><dt>Source / referring service</dt><dd>{intake.source || "Not recorded"}</dd></div>
                <div><dt>Reason for contact</dt><dd>{intake.reason || "Not recorded"}</dd></div>
                <div><dt>Safe contact method</dt><dd>{intake.contactMethod || "Not recorded"}</dd></div>
                <div><dt>Safe contact restrictions</dt><dd>{intake.safeContact || "Not recorded"}</dd></div>
                <div><dt>Consent for assessment participation</dt><dd>{intake.consentRecorded ? "Recorded" : "Not recorded"}</dd></div>
                {intake.consentReference && <div><dt>Consent source / reference</dt><dd>{intake.consentReference}</dd></div>}
                <div><dt>Initial assessment respondent</dt><dd>{intake.respondentPreference || "Not recorded"}</dd></div>
                {intake.respondentPreference === "Family respondent" && <div><dt>Family respondent name</dt><dd>{intake.respondentName || "Not recorded"}</dd></div>}
              </dl>
            </div>
          </Panel>
          <div className="stack intake-assessment-sidebar">
            <IntakeAssessmentPanel
              person={person}
              intake={intake}
              navigate={navigate}
              onReopen={() => submit({ type: "REOPEN_INTAKE" })}
              reopenError={error}
            />
          </div>
        </div>
      </div>
    );
  return (
    <ValidatedForm
      className="stack intake-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (intakeStepComplete(intake)) recordOutcome();
        else saveIntake(true);
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
          <Panel title="Registration & referral origin">
            <div className="panel-body stack">
              <div className="form-grid">
                {field("displayName", "Preferred / supplied name", {
                  hint: "Leave blank if still unknown.",
                })}
                {field("dob", "Date of birth (if known)", { type: "date" })}
              </div>
              <div className="form-grid">
                {field("receivedAt", "Contact received (if known)", {
                  type: "datetime-local",
                })}
                {field("source", "Source / referring service", {
                  hint: "Self-contact, referring service or Unknown.",
                })}
              </div>
              {field("reason", "Reason for contact", { multiline: true })}
              <details className="setup-disclosure">
                <summary>Identity and source details</summary>
                <div className="stack intake-disclosure-body">
                  {field("legalName", "Supplied legal name (if needed)")}
                  {field("sourceIdentifiers", "Supplied identifiers")}
                  {field("sourceReference", "Source / referral reference")}
                  <p className="muted">
                    Registered date of birth:{" "}
                    {person.dob ? formatDate(person.dob) : "Unknown"}. Resolve
                    identity from an appropriate source before confirming the
                    matching check.
                  </p>
                </div>
              </details>
            </div>
          </Panel>
          <Panel title="Contact, permission & support">
            <div className="panel-body stack">
              <Field label="Safe contact method">
                <select
                  value={draft.contactMethod}
                  onChange={(e) => changeContactMethod(e.target.value)}
                >
                  {legacyContact && <option value={draft.contactMethod}>{draft.contactMethod}</option>}
                  {[
                    "Not yet discussed",
                    "Phone",
                    "Email",
                    "SMS",
                    "Through a supporter",
                    "Staff-assisted / in person",
                    "No suitable contact",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              {(directContact || legacyContact) && (
                <div className="form-grid">
                  {field("contactValue", draft.contactMethod === "Email" ? "Email address" : draft.contactMethod === "SMS" ? "Mobile number for SMS" : draft.contactMethod === "Phone" ? "Phone number" : "Contact details", {
                    type: draft.contactMethod === "Email" ? "email" : ["Phone", "SMS"].includes(draft.contactMethod) ? "tel" : "text",
                  })}
                  <Field label="Whose contact is this?">
                    <select
                      value={draft.contactHolder || ""}
                      onChange={(event) => change("contactHolder", event.target.value)}
                    >
                      <option value="">Choose contact holder</option>
                      {["Person", "Parent / carer", "Family member", "Supporter", "Service / staff"].map((holder) => (
                        <option key={holder} value={holder}>{holder}</option>
                      ))}
                      {draft.contactHolder && !["Person", "Parent / carer", "Family member", "Supporter", "Service / staff"].includes(draft.contactHolder) && (
                        <option value={draft.contactHolder}>{draft.contactHolder}</option>
                      )}
                    </select>
                  </Field>
                </div>
              )}
              {supporterContact && (
                <>
                  {field("supporter", "Supporter and relationship")}
                  {field("contactValue", "Supporter contact details", { type: "tel" })}
                  {field("authority", "Verified authority / outstanding check", {
                    hint: "A relationship alone does not establish authority.",
                  })}
                </>
              )}
              {(directContact || legacyContact || supporterContact || staffContact || noSuitableContact) && field(
                "safeContact",
                staffContact ? "Staff contact route / location" : noSuitableContact ? "Reason no contact route is suitable / alternative staff route" : "Safe contact instructions or restrictions",
                { multiline: true },
              )}
              {field("permissionReference", "Permission source / reference")}
              <details className="setup-disclosure">
                <summary>Communication and supporter details</summary>
                <div className="stack intake-disclosure-body">
                  {field("language", "Preferred language (if known)")}
                  {field(
                    "supportNeeds",
                    "Interpreter, accessibility or assistance needs",
                    { multiline: true },
                  )}
                  {!supporterContact && field("supporter", "Supporter and relationship (if relevant)")}
                  {!supporterContact && field("authority", "Verified authority / outstanding check", {
                    hint: "A relationship alone does not establish authority.",
                  })}
                </div>
              </details>
            </div>
          </Panel>
          {mobileReferrals}
          <Panel title="Consent for assessment participation">
            <div className="panel-body stack intake-detail-body">
              <div className={`intake-check-control ${validationErrors.consentRecorded ? "has-error" : ""}`}>
                <label className="check-field">
                  <input
                    id="intake-consentRecorded"
                    type="checkbox"
                    checked={draft.consentRecorded === true}
                    aria-invalid={Boolean(validationErrors.consentRecorded) || undefined}
                    aria-describedby={validationErrors.consentRecorded ? "intake-consentRecorded-error" : undefined}
                    onChange={(event) => change("consentRecorded", event.target.checked)}
                  />
                  Consent for assessment participation has been recorded
                </label>
                {validationErrors.consentRecorded && <small id="intake-consentRecorded-error" className="intake-check-error">{validationErrors.consentRecorded}</small>}
              </div>
              <Field
                label="Consent source / reference"
                hint="For example, approved form reference or recorded discussion."
                error={validationErrors.consentReference}
              >
                <textarea
                  id="intake-consentReference"
                  rows={2}
                  value={draft.consentReference || ""}
                  aria-invalid={Boolean(validationErrors.consentReference) || undefined}
                  onChange={(event) => change("consentReference", event.target.value)}
                />
              </Field>
              <h3 className="intake-respondent-heading">Initial assessment respondent</h3>
              <Field label="Who will complete the initial assessment?" error={validationErrors.respondentPreference}>
                <select
                  id="intake-respondentPreference"
                  value={draft.respondentPreference || "Person"}
                  aria-invalid={Boolean(validationErrors.respondentPreference) || undefined}
                  onChange={(event) => change("respondentPreference", event.target.value)}
                >
                  <option value="Person">Person</option>
                  <option value="Family respondent">Family respondent</option>
                </select>
              </Field>
              {draft.respondentPreference === "Family respondent" && (
                <Field
                  label="Family respondent name"
                  hint="This identifies their own contribution; it does not establish authority."
                  error={validationErrors.respondentName}
                >
                  <input
                    id="intake-respondentName"
                    value={draft.respondentName || ""}
                    aria-invalid={Boolean(validationErrors.respondentName) || undefined}
                    onChange={(event) => change("respondentName", event.target.value)}
                  />
                </Field>
              )}
            </div>
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Required intake checks">
            <div className="panel-body stack">
              <p className="muted">
                Sample review categories. Staff apply the approved service
                checks; this workspace makes no clinical triage decision.
              </p>
              {INTAKE_CHECKS.map(([key, label]) => (
                <div className={`intake-check-control ${validationErrors[key] ? "has-error" : ""}`} key={key}>
                  <label className="check-field">
                    <input
                      id={`intake-${key}`}
                      type="checkbox"
                      checked={draft[key] === true}
                      aria-invalid={Boolean(validationErrors[key]) || undefined}
                      aria-describedby={validationErrors[key] ? `intake-${key}-error` : undefined}
                      onChange={(e) => change(key, e.target.checked)}
                    />
                    {label}
                  </label>
                  {validationErrors[key] && <small id={`intake-${key}-error`} className="intake-check-error">{validationErrors[key]}</small>}
                </div>
              ))}
              {field("reviewer", "Assigned triage reviewer", { staff: true })}
              {field("nextAction", "Next step", { multiline: true })}
              {saveMessage && <p className="form-save-success">{saveMessage}</p>}
              <div className="stack intake-outcome-step">
                <h3>Intake outcome</h3>
                {!intakeStepComplete(intake) && (
                  <p className="muted">Save the required intake checks before recording an outcome.</p>
                )}
                {outcomeDraftError && (
                  <Notice tone="amber">This browser cannot keep an outcome draft. Keep this page open until the outcome is recorded.</Notice>
                )}
                <Field label="Outcome" error={validationErrors.outcome}>
                  <select
                    id="intake-outcome"
                    value={outcomeDraft.outcome || ""}
                    disabled={!intakeStepComplete(intake)}
                    aria-invalid={Boolean(validationErrors.outcome) || undefined}
                    onChange={(event) => changeOutcome("outcome", event.target.value)}
                  >
                    <option value="">Choose outcome</option>
                    <option value="Proceed">Proceed to assessment</option>
                    <option value="Do not proceed">Do not proceed to assessment</option>
                    <option value="Closed incomplete">Close intake incomplete</option>
                  </select>
                </Field>
              </div>
              <div className="intake-save-actions">
                {validationItems.length > 0 || error ? (
                  <FormErrorSummary
                    containerRef={errorSummaryRef}
                    title={`Intake not saved · ${validationItems.length || 1} ${validationItems.length === 1 ? "item" : "items"} to check`}
                    description={error || "Correct the highlighted fields, then select the save action again."}
                    items={validationItems}
                  />
                ) : (
                  <p className="muted">
                    {intakeStepComplete(intake) && outcomeDraft.outcome
                      ? "Recording an outcome completes this intake and saves the decision."
                      : "Save intake checks the required fields before saving."}
                  </p>
                )}
                <div className="intake-save-buttons">
                  <Button type="button" onClick={() => saveIntake(false)}>Save draft</Button>
                  <Button type="submit" variant="primary">
                    {intakeStepComplete(intake) && outcomeDraft.outcome ? "Record outcome" : "Save intake"}
                  </Button>
                </div>
              </div>
            </div>
          </Panel>
          <Notice>
            Support and referrals remain available while intake is
            pending. Use the agreed service support route when someone needs
            help.
          </Notice>
        </div>
      </div>
    </ValidatedForm>
  );
}

export function IntakeAssessmentPanel({ person, intake, navigate, onReopen, reopenError }) {
  const { state, commit } = useStore();
  const [due, setDue] = useState(TODAY);
  const [programStream, setProgramStream] = useState("");
  const [error, setError] = useState("");
  const [externalSlot, setExternalSlot] = useState(null);
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
      externalAppointment: externalSlot,
    };
    const problem = intakeActionError(state, action, currentStaff(state));
    if (problem) return setError(problem);
    const result = commit(action);
    if (result.error) return setError(result.error);
    navigate(`/people/${person.id}?tab=assessment`);
  };

  return (
    <div className="stack">
      <Panel title="Initial assessment" action={<Badge>{ready ? "Ready to plan" : "Waiting for intake"}</Badge>}>
        <div className="panel-body stack">
          <dl className="metadata">
            <div><dt>Intake decision</dt><dd>{intake.outcome || "Pending"}</dd></div>
            <div><dt>Receiving assessment owner</dt><dd>{intake.assessmentOwner || "Not assigned"}</dd></div>
            <div><dt>Respondent</dt><dd>{intake.respondentPreference || "Not recorded"}</dd></div>
          </dl>
          {ready ? (
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
                  {intake.assessmentOwner} owns the next step. Set the due date
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
                <AppointmentSlotPicker key={due} mode="assessment" dueDate={due} selectedSlot={externalSlot} onSelect={setExternalSlot} />
                {error && <p role="alert" className="field-error">{error}</p>}
                <div className="intake-assessment-actions">
                  <Button type="submit" variant="primary">Create assessment plan</Button>
                  {canReopen && onReopen && <Button type="button" onClick={onReopen}>Reopen intake</Button>}
                </div>
              </ValidatedForm>
            )
          ) : (
            <Notice tone="amber">
              {intake.status === "Closed incomplete" || intake.outcome === "Do not proceed"
                ? "This intake decision does not proceed to assessment. Review the next-care plan in Intake."
                : "Complete intake with a proceed decision and receiving assessment owner before planning assessment."}
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
  const [mobileLayout, setMobileLayout] = useState(() =>
    typeof window !== "undefined" && window.matchMedia?.("(max-width: 720px)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(max-width: 720px)");
    const updateLayout = (event) => setMobileLayout(event.matches);
    query.addEventListener("change", updateLayout);
    return () => query.removeEventListener("change", updateLayout);
  }, []);
  const showReferrals = !["Completed", "Closed incomplete"].includes(intake.status);
  const referrals = showReferrals && (
    <section className="intake-referrals-container" aria-label="Referrals">
      <Referrals person={person} intake={intake} openModal={openModal} hideEmptyState />
    </section>
  );
  const returnTo = safeReturnTo(params.get("returnTo"));
  const tabs = ["Overview", "Assessment", { value: "Events", label: "Care events" },
    "Report", { value: "Consent & respondents", label: "Consent" }];
  const requestedTab = params.get("tab")?.toLowerCase();
  const tab = tabs.find((item) => (typeof item === "string" ? item : item.value).toLowerCase() === requestedTab);
  const selectedTab = typeof tab === "string" ? tab : tab?.value || "Overview";
  const setTab = (value) => navigate(`/people/${person.id}${value === "Overview" ? "" : `?tab=${encodeURIComponent(value.toLowerCase())}`}`, { scroll: false });
  const lastUpdatedAt = [
    intake.createdAt,
    ...(intake.history || []).map((entry) => entry.timestamp),
  ]
    .filter((timestamp) => timestamp && Number.isFinite(Date.parse(timestamp)))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  return (
    <>
      <button className="back-link" onClick={() => navigate(returnTo)}>
        <ArrowLeft size={17} />
        Back to {returnTo.split("?")[0] === "/" ? "My work" : "people"}
      </button>
      <div className="person-heading">
        <div>
          <h1>{person.name || "Name not recorded"}</h1>
          <p>
            {person.id}
            <span>·</span>
            {person.dob ? `${age(person.dob)} years` : "Date of birth unknown"}
          </p>
        </div>
        <Badge>{intake.status}</Badge>
      </div>
      <div className="episode-bar intake-summary">
        <div className="intake-context">
          <strong>Intake at Northside Centre</strong>
          <small>Owner · {intake.owner}</small>
        </div>
        <div>
          <small>Last updated</small>
          <span>{lastUpdatedAt ? formatDate(lastUpdatedAt.slice(0, 10)) : "Not recorded"}</span>
        </div>
        <div>
          <small>Next action</small>
          <span>{intake.nextAction}</span>
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
                mobileReferrals={mobileLayout ? referrals : null}
              />
              {!mobileLayout && referrals}
            </div>
          )}
          {selectedTab === "Assessment" && (
            <div className="stack intake-workspace-sections">
              {intakeReady(intake)
                ? <IntakeAssessmentPanel person={person} intake={intake} navigate={navigate} />
                : <Empty title="Assessment has not started">Complete the checks and record a Proceed decision on Overview first.</Empty>}
            </div>
          )}
          {selectedTab === "Events" && <Empty title="No care events yet">Care events will appear here after an episode begins.</Empty>}
          {selectedTab === "Report" && <Empty title="No report yet">Assessment responses will inform this view after collection.</Empty>}
          {selectedTab === "Consent & respondents" && (
            <Panel title="Consent & respondents">
              <div className="panel-body stack">
                <dl className="metadata">
                  <div><dt>Assessment participation</dt><dd>{intake.consentRecorded ? "Recorded" : "Not recorded"}</dd></div>
                  <div><dt>Source or reference</dt><dd>{intake.consentReference || "Not recorded"}</dd></div>
                  <div><dt>Initial assessment respondent</dt><dd>{intake.respondentPreference || "Not recorded"}</dd></div>
                </dl>
                <p>Record the initial participation decision on Overview. Purpose-specific requests and withdrawal remain in this tab once care begins.</p>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
