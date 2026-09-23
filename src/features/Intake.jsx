import { useState } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useStore } from "../store";
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
  Modal,
  Notice,
  Panel,
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
          navigate(`/people/${person.id}?tab=intake`);
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
                  navigate(`/people/${duplicate.id}?tab=intake`);
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

export function IntakePanel({ person, intake, navigate }) {
  const { state, commit } = useStore(),
    staff = currentStaff(state);
  const [draft, setDraft, _clearDraft, draftError] = useDraft(
    `intake:${intake.id}:${intake.revision}`,
    {
      ...intake,
      displayName: person.nameUnknown ? "" : person.name,
      dob: person.dob || "",
      respondentName: intake.respondentName || person.family || "",
    },
  );
  const [outcomeDraft, setOutcomeDraft, _clearOutcomeDraft, outcomeDraftError] = useDraft(
    `intake-outcome:${intake.id}`,
    { outcome: "" },
  );
  const [error, setError] = useState(""),
    [saveMessage, setSaveMessage] = useState("");
  const [validationMode, setValidationMode] = useState("");
  const validationErrors = intakeFieldErrors(draft, outcomeDraft, validationMode, error);
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
          value={draft[key] || ""}
          onChange={(value) => change(key, value)}
          required={required}
          invalid={Boolean(validationErrors[key])}
        />
      ) : multiline ? (
        <textarea
          rows={2}
          value={draft[key] || ""}
          required={required}
          aria-invalid={Boolean(validationErrors[key]) || undefined}
          onChange={(e) => change(key, e.target.value)}
        />
      ) : (
        <input
          type={type}
          value={draft[key] || ""}
          required={required}
          aria-invalid={Boolean(validationErrors[key]) || undefined}
          onChange={(e) => change(key, e.target.value)}
        />
      )}
    </Field>
  );
  const submit = (action, successMessage) => {
    const full = {
      ...action,
      personId: person.id,
      intakeId: intake.id,
      revision: intake.revision,
    };
    const problem = intakeActionError(state, full, staff);
    if (problem) {
      setError(problem);
      return false;
    }
    const result = commit(full);
    if (result.error) {
      setError(result.error);
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
    setValidationMode("outcome");
    if (!intakeStepComplete(intake)) {
      setError("Save the required intake checks before recording an outcome.");
      return;
    }
    if (!outcomeDraft.outcome) {
      setError("Choose an intake outcome.");
      return;
    }
    const checkProblem = intakeCheckFieldsError(draft);
    if (checkProblem) return setError(checkProblem);
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
    });
    if (saved) {
      setOutcomeDraft({ outcome: "" });
    }
  };
  const saveIntake = (validateChecks) => {
    setValidationMode(validateChecks ? "checks" : "");
    if (validateChecks) {
      const problem = intakeCheckFieldsError(draft);
      if (problem) return setError(problem);
    }
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
      : "Draft saved. The intake state is unchanged.");
  };
  if (finalised)
    return (
      <div className="stack">
        <div className="section-toolbar">
          <div>
            <h2>Intake information</h2>
            <p>Review the saved referral, contact details and required checks.</p>
          </div>
          <Badge>{intake.status}</Badge>
        </div>
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
          <Panel title="Required intake checks">
            <div className="panel-body stack intake-detail-body">
              {INTAKE_CHECKS.map(([key, label]) => (
                <p key={key}>{intake[key] ? "✓" : "○"} {label}</p>
              ))}
              <dl className="metadata">
                <div><dt>Assigned triage reviewer</dt><dd>{intake.reviewer || "Not recorded"}</dd></div>
                <div><dt>Next step</dt><dd>{intake.nextAction}</dd></div>
                <div><dt>Outcome</dt><dd>{intake.outcome || "Closed incomplete"}</dd></div>
                <div><dt>Recorded by</dt><dd>{intake.decisionBy || intake.history[0]?.actor || "Not recorded"}</dd></div>
              </dl>
              {intake.status === "Completed" && !intake.episodeId && !person.episodes.length && (
                <Button onClick={() => submit({ type: "REOPEN_INTAKE" })}>Reopen intake</Button>
              )}
              {intakeReady(intake) && intake.episodeId && (
                <Button variant="primary" onClick={() => navigate(`/people/${person.id}?episode=${intake.episodeId}&tab=assessment`)}>Open assessment plan</Button>
              )}
              {error && <p className="field-error" role="alert">{error}</p>}
            </div>
          </Panel>
        </div>
        {intakeReady(intake) && !intake.episodeId && (
          <IntakeAssessmentPanel person={person} intake={intake} navigate={navigate} />
        )}
      </div>
    );
  return (
    <ValidatedForm
      className="stack intake-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (intakeStepComplete(intake) && outcomeDraft.outcome) recordOutcome();
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
          <Panel title="Consent for assessment participation">
            <div className="panel-body stack intake-detail-body">
              {intakeStepComplete(intake) ? (
                  <>
                    <div className={`intake-check-control ${validationErrors.consentRecorded ? "has-error" : ""}`}>
                      <label className="check-field">
                        <input
                          type="checkbox"
                          checked={draft.consentRecorded === true}
                          aria-invalid={Boolean(validationErrors.consentRecorded) || undefined}
                          onChange={(event) => change("consentRecorded", event.target.checked)}
                        />
                        Consent for assessment participation has been recorded
                      </label>
                      {validationErrors.consentRecorded && <small className="intake-check-error">{validationErrors.consentRecorded}</small>}
                    </div>
                    <Field
                      label="Consent source / reference"
                      hint="For example, approved form reference or recorded discussion."
                      error={validationErrors.consentReference}
                    >
                      <textarea
                        rows={2}
                        value={draft.consentReference || ""}
                        aria-invalid={Boolean(validationErrors.consentReference) || undefined}
                        onChange={(event) => change("consentReference", event.target.value)}
                      />
                    </Field>
                    <h3 className="intake-respondent-heading">Initial assessment respondent</h3>
                    <Field label="Who will complete the initial assessment?" error={validationErrors.respondentPreference}>
                      <select
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
                          value={draft.respondentName || ""}
                          aria-invalid={Boolean(validationErrors.respondentName) || undefined}
                          onChange={(event) => change("respondentName", event.target.value)}
                        />
                      </Field>
                    )}
                  </>
              ) : (
                <Notice tone="amber">Save intake to unlock consent and respondent details.</Notice>
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
                      type="checkbox"
                      checked={draft[key] === true}
                      aria-invalid={Boolean(validationErrors[key]) || undefined}
                      onChange={(e) => change(key, e.target.checked)}
                    />
                    {label}
                  </label>
                  {validationErrors[key] && <small className="intake-check-error">{validationErrors[key]}</small>}
                </div>
              ))}
              {field("reviewer", "Assigned triage reviewer", { staff: true })}
              {field("nextAction", "Next step", { multiline: true })}
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
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
                <p className="muted">
                  {intakeStepComplete(intake) && outcomeDraft.outcome
                    ? "Recording an outcome completes this intake and saves the decision."
                    : "Save intake checks the required fields before saving."}
                </p>
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

function IntakeAssessmentPanel({ person, intake, navigate }) {
  const { state, commit } = useStore();
  const [due, setDue] = useState(TODAY);
  const [programStream, setProgramStream] = useState("");
  const [error, setError] = useState("");
  const ready = intakeReady(intake);
  const startAssessment = (event) => {
    event.preventDefault();
    const action = {
      type: "START_ASSESSMENT",
      personId: person.id,
      intakeId: intake.id,
      revision: intake.revision,
      due,
      programStream,
    };
    const problem = intakeActionError(state, action, currentStaff(state));
    if (problem) return setError(problem);
    const result = commit(action);
    if (result.error) return setError(result.error);
    navigate(`/people/${person.id}?tab=assessment`);
  };

  return (
    <div className="stack">
      <div className="section-toolbar">
        <div>
          <h2>Assessment & collection plan</h2>
          <p>Initial assessment follows the recorded intake decision.</p>
        </div>
      </div>
      <Panel title="Initial assessment" action={<Badge>{ready ? "Ready to plan" : "Waiting for intake"}</Badge>}>
        <div className="panel-body stack">
          <dl className="metadata">
            <div><dt>Intake decision</dt><dd>{intake.outcome || "Pending"}</dd></div>
            <div><dt>Receiving assessment owner</dt><dd>{intake.assessmentOwner || "Not assigned"}</dd></div>
            <div><dt>Respondent</dt><dd>{intake.respondentPreference || "Not recorded"}</dd></div>
          </dl>
          {ready ? (
            intake.episodeId ? (
              <Button
                variant="primary"
                onClick={() => navigate(`/people/${person.id}?episode=${intake.episodeId}&tab=assessment`)}
              >
                Open assessment plan
              </Button>
            ) : (
              <ValidatedForm className="stack" onSubmit={startAssessment}>
                <Notice>
                  {intake.assessmentOwner} owns the next step. Creating the plan
                  starts the assessment record; the intake decision remains in history.
                </Notice>
                <Field label="Initial assessment due date">
                  <input
                    type="date"
                    min={TODAY}
                    required
                    value={due}
                    onChange={(event) => setDue(event.target.value)}
                  />
                </Field>
                <Field label="Program stream">
                  <select required value={programStream} onChange={(event) => setProgramStream(event.target.value)}>
                    <option value="">Choose stream</option>
                    {PROGRAM_STREAMS.map((stream) => <option key={stream} value={stream}>{stream}</option>)}
                  </select>
                </Field>
                {error && <p role="alert" className="field-error">{error}</p>}
                <Button type="submit" variant="primary">Create assessment plan</Button>
              </ValidatedForm>
            )
          ) : (
            <Notice tone="amber">
              {intake.status === "Closed incomplete" || intake.outcome === "Do not proceed"
                ? "This intake decision does not proceed to assessment. Review the next-care plan in Intake."
                : "Complete intake with a proceed decision and receiving assessment owner before planning assessment."}
            </Notice>
          )}
        </div>
      </Panel>
    </div>
  );
}

export default function IntakeWorkspace({ person, navigate, openModal }) {
  const params = useSearchParams(),
    intake = person.intakes[0];
  const returnTo = safeReturnTo(params.get("returnTo"));
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
      <div className="person-content-surface">
        <div id="intake-workspace-panel" className="stack intake-workspace-sections">
          <IntakePanel person={person} intake={intake} navigate={navigate} />
          <section className="intake-referrals-container" aria-label="Referrals">
            <Referrals person={person} intake={intake} openModal={openModal} hideEmptyState />
          </section>
          <IntakeHistory intake={intake} />
        </div>
      </div>
    </>
  );
}
