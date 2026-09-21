import { useState } from "react";
import {
  ArrowLeft,
  ClipboardList,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useStore } from "../store";
import {
  TODAY,
  currentStaff,
  formatDate,
  formatTimestamp,
  age,
  displayPersonName,
} from "../model";
import {
  INTAKE_STATES,
  INTAKE_CHECKS,
  intakeReady,
  intakeActionError,
} from "../intake";
import useDraft from "../useDraft";
import { safeReturnTo } from "../workflow";
import {
  Avatar,
  Badge,
  Button,
  Field,
  Modal,
  Notice,
  Panel,
  StaffPicker,
  Tabs,
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

export function IntakeHistory({ intake }) {
  return (
    <Panel title="Intake history">
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
    </Panel>
  );
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
      changeReason: "",
    },
  );
  const [error, setError] = useState(""),
    [saveMessage, setSaveMessage] = useState(""),
    [due, setDue] = useState(TODAY);
  const finalised = ["Completed", "Closed incomplete"].includes(intake.status);
  const change = (key, value) => {
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
    <Field label={label} hint={hint}>
      {staff ? (
        <StaffPicker
          value={draft[key] || ""}
          onChange={(value) => change(key, value)}
          required={required}
        />
      ) : multiline ? (
        <textarea
          rows={2}
          value={draft[key] || ""}
          required={required}
          onChange={(e) => change(key, e.target.value)}
        />
      ) : (
        <input
          type={type}
          value={draft[key] || ""}
          required={required}
          onChange={(e) => change(key, e.target.value)}
        />
      )}
    </Field>
  );
  const submit = (action) => {
    const full = {
      ...action,
      personId: person.id,
      intakeId: intake.id,
      revision: intake.revision,
    };
    const problem = intakeActionError(state, full, staff);
    if (problem) {
      setError(problem);
      return;
    }
    const result = commit(full);
    if (result.error) {
      setError(result.error);
      return;
    }
    setError("");
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
          changeReason: "",
        });
      }
      setSaveMessage("Intake reopened. Update it before completing intake again.");
    }
    if (action.type === "SAVE_INTAKE") {
      setSaveMessage("Intake saved. This update is recorded in intake history.");
    }
    if (action.type === "START_ASSESSMENT")
      navigate(`/people/${person.id}?tab=assessment`);
  };
  if (finalised)
    return (
      <div className="stack">
        <Panel
          title={
            intakeReady(intake)
              ? "Intake complete · proceed to assessment"
              : intake.status === "Closed incomplete"
                ? "Intake closed incomplete"
                : "Intake complete · do not proceed"
          }
          action={<Badge>{intake.status}</Badge>}
        >
          <div className="panel-body stack">
            <p>{intake.summary || intake.waitingReason}</p>
            <dl className="metadata">
              <div>
                <dt>Intake decision</dt>
                <dd>{intake.outcome || "No completed decision"}</dd>
              </div>
              <div>
                <dt>Recorded by</dt>
                <dd>{intake.decisionBy || intake.history[0]?.actor}</dd>
              </div>
              <div>
                <dt>Decision time</dt>
                <dd>
                  {intake.decisionAt
                    ? formatTimestamp(intake.decisionAt)
                    : "Not applicable"}
                </dd>
              </div>
              <div>
                <dt>Next step</dt>
                <dd>{intake.nextAction}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>
                  {intakeReady(intake) ? intake.assessmentOwner : intake.owner}
                </dd>
              </div>
              <div>
                <dt>Review date</dt>
                <dd>{formatDate(intake.reviewDate)}</dd>
              </div>
            </dl>
            {intakeReady(intake) ? (
              intake.episodeId ? (
                <Button
                  variant="primary"
                  onClick={() =>
                    navigate(
                      `/people/${person.id}?episode=${intake.episodeId}&tab=assessment`,
                    )
                  }
                >
                  Open assessment plan
                </Button>
              ) : (
                <ValidatedForm
                  className="stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit({ type: "START_ASSESSMENT", due });
                  }}
                >
                  <Notice>
                    Waiting for assessment · {intake.assessmentOwner} owns the
                    next step. The intake decision does not record clinical
                    admission.
                  </Notice>
                  <Field label="Initial assessment due date">
                    <input
                      type="date"
                      min={TODAY}
                      required
                      value={due}
                      onChange={(e) => setDue(e.target.value)}
                    />
                  </Field>
                  <Button type="submit" variant="primary">
                    Create assessment plan
                  </Button>
                </ValidatedForm>
              )
            ) : (
              <Notice>
                The next-care plan and onward referrals remain available.
                Assessment cannot start from this intake outcome.
              </Notice>
            )}
            {intake.status === "Completed" &&
              !intake.episodeId &&
              !person.episodes.length && (
                <div className="stack">
                  <Button onClick={() => submit({ type: "REOPEN_INTAKE" })}>
                    Reopen intake
                  </Button>
                  <p className="muted">
                    Return to intake and triage before creating an assessment
                    plan. The completed decision remains in intake history.
                  </p>
                </div>
              )}
            {error && (
              <p role="alert" className="field-error">
                {error}
              </p>
            )}
          </div>
        </Panel>
        <IntakeHistory intake={intake} />
      </div>
    );
  return (
    <ValidatedForm
      className="stack intake-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit({ type: "SAVE_INTAKE", values: draft });
      }}
    >
      <div className="intake-intro">
        <ClipboardList size={24} />
        <div>
          <h2>Complete intake</h2>
          <p>
            Gather the information, resolve the checks and record the next care
            step.
          </p>
        </div>
        <Badge>{intake.status}</Badge>
      </div>
      {draftError && (
        <Notice tone="amber">
          This browser cannot keep an intake draft. Keep this page open until
          your changes are saved.
        </Notice>
      )}
      <div className="intake-columns">
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
                  onChange={(e) => change("contactMethod", e.target.value)}
                >
                  {[
                    "Not yet discussed",
                    "Phone",
                    "Email",
                    "Through a supporter",
                    "Staff-assisted / in person",
                    "No suitable contact",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <div className="form-grid">
                {field("contactValue", "Contact details (if available)")}
                {field("contactHolder", "Whose contact is this?")}
              </div>
              {field(
                "safeContact",
                "Safe contact restrictions / alternative staff route",
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
                  {field(
                    "supporter",
                    "Supporter and relationship (if relevant)",
                  )}
                  {field(
                    "authority",
                    "Verified authority / outstanding check",
                    {
                      hint: "A relationship alone does not establish authority.",
                    },
                  )}
                </div>
              </details>
            </div>
          </Panel>
          <Panel title="Required intake checks">
            <div className="panel-body stack">
              <p className="muted">
                Sample review categories. Staff apply the approved service
                checks; this workspace makes no clinical triage decision.
              </p>
              {INTAKE_CHECKS.map(([key, label]) => (
                <label className="check-field" key={key}>
                  <input
                    type="checkbox"
                    checked={draft[key] === true}
                    required={draft.status === "Completed"}
                    onChange={(e) => change(key, e.target.checked)}
                  />
                  {label}
                </label>
              ))}
              {field("checkEvidence", "Source and outcome of the checks", {
                multiline: true,
                required: draft.status === "Completed",
              })}
              {field("reviewer", "Assigned triage reviewer", { staff: true })}
              {field("summary", "Triage summary / exit reason", {
                multiline: true,
                required:
                  draft.status === "Completed" ||
                  draft.status === "Closed incomplete",
              })}
            </div>
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Ownership & next step">
            <div className="panel-body stack">
              <Field label="Intake state">
                <select
                  value={draft.status}
                  onChange={(e) => change("status", e.target.value)}
                >
                  {INTAKE_STATES.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              {field("owner", "YSCC intake owner", {
                required: true,
                staff: true,
              })}
              {field("nextAction", "Next action", {
                multiline: true,
                required: true,
              })}
              {field("reviewDate", "Next review date", {
                type: "date",
                required: true,
              })}
              {["Awaiting information", "Awaiting triage", "Waiting"].includes(
                draft.status,
              ) && (
                <>
                  {field(
                    "waitingReason",
                    "Waiting reason / missing information",
                    { multiline: true, required: true },
                  )}
                  {field("waitingOn", "Who owns the outstanding step?", {
                    required: true,
                  })}
                </>
              )}
              {field("communication", "Next step communicated / pending", {
                multiline: true,
              })}
              {draft.status === "Completed" && (
                <div className="stack intake-decision">
                  <h3>Record intake outcome</h3>
                  <Field label="Intake outcome">
                    <select
                      value={draft.outcome || ""}
                      required
                      onChange={(e) => change("outcome", e.target.value)}
                    >
                      <option value="">Select an outcome</option>
                      <option>Proceed</option>
                      <option>Do not proceed</option>
                    </select>
                  </Field>
                  {field("decisionAt", "Actual decision time", {
                    type: "datetime-local",
                    required: true,
                  })}
                  {draft.outcome === "Proceed" &&
                    field("assessmentOwner", "Receiving assessment owner", {
                      required: true,
                      staff: true,
                    })}
                  <p className="muted">
                    Decision recorded as {staff?.name} · {staff?.role}.
                    Finalised decisions remain in history.
                  </p>
                </div>
              )}
              {field("changeReason", "Reason for this update", {
                multiline: true,
                required: true,
              })}
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
              {saveMessage && <p className="form-save-success">{saveMessage}</p>}
              <Button type="submit" variant="primary">
                {draft.status === "Completed"
                  ? "Complete intake"
                  : draft.status === "Closed incomplete"
                    ? "Close intake incomplete"
                    : "Save intake"}
              </Button>
              <p className="muted">
                Partial information can be saved. Required unresolved checks
                prevent completion.
              </p>
            </div>
          </Panel>
          <Notice>
            Support and onward referrals remain available while intake is
            pending. Use the agreed service support route when someone needs
            help.
          </Notice>
        </div>
      </div>
      <IntakeHistory intake={intake} />
    </ValidatedForm>
  );
}

function ConsentRespondentsPanel({ person, intake }) {
  const { state, commit } = useStore(),
    staff = currentStaff(state);
  const [draft, setDraft] = useState(() => ({
    ...intake,
    consentRecorded: intake.consentRecorded === true,
    consentReference: intake.consentReference || "",
    respondentPreference: intake.respondentPreference || "Person",
    respondentName: intake.respondentName || person.family || "",
    changeReason: "",
  }));
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const change = (key, value) => {
    setError("");
    setSaveMessage("");
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const save = (event) => {
    event.preventDefault();
    const action = {
      type: "SAVE_INTAKE",
      personId: person.id,
      intakeId: intake.id,
      revision: intake.revision,
      values: draft,
    };
    const problem = intakeActionError(state, action, staff);
    if (problem) return setError(problem);
    const result = commit(action);
    if (result.error) return setError(result.error);
    setSaveMessage("Consent and respondent details saved in intake history.");
  };
  return (
    <ValidatedForm className="stack" onSubmit={save}>
      <Panel title="Consent for assessment participation">
        <div className="panel-body stack">
          <Notice>
            Record the approved consent source before completing intake. This
            is a prototype record, not the consent policy itself.
          </Notice>
          <label className="check-field">
            <input
              type="checkbox"
              checked={draft.consentRecorded}
              onChange={(event) => change("consentRecorded", event.target.checked)}
            />
            Consent for assessment participation has been recorded
          </label>
          <Field
            label="Consent source / reference"
            hint="For example, approved form reference or recorded discussion."
          >
            <textarea
              rows={2}
              value={draft.consentReference}
              required={draft.consentRecorded}
              onChange={(event) => change("consentReference", event.target.value)}
            />
          </Field>
          <p className="muted">
            Consent is required to complete intake. A decision remains
            purpose-specific and can be reviewed later.
          </p>
        </div>
      </Panel>
      <Panel title="Initial assessment respondent">
        <div className="panel-body stack">
          <Field label="Who will complete the initial assessment?">
            <select
              value={draft.respondentPreference}
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
            >
              <input
                value={draft.respondentName}
                required
                onChange={(event) => change("respondentName", event.target.value)}
              />
            </Field>
          )}
        </div>
      </Panel>
      <Panel title="Save this update">
        <div className="panel-body stack">
          <Field label="Reason for this update">
            <textarea
              rows={2}
              value={draft.changeReason}
              required
              onChange={(event) => change("changeReason", event.target.value)}
            />
          </Field>
          {error && <p className="field-error" role="alert">{error}</p>}
          {saveMessage && <p className="form-save-success">{saveMessage}</p>}
          <Button type="submit" variant="primary">Save consent & respondents</Button>
        </div>
      </Panel>
    </ValidatedForm>
  );
}

export default function IntakeWorkspace({ person, navigate, openModal }) {
  const params = useSearchParams(),
    intake = person.intakes[0];
  const tabs = ["Intake", "Consent & respondents", "Referrals", "History"];
  const tab =
    tabs.find((t) => t.toLowerCase() === params.get("tab")) || "Intake";
  const returnTo = safeReturnTo(params.get("returnTo"));
  return (
    <>
      <button className="back-link" onClick={() => navigate(returnTo)}>
        <ArrowLeft size={17} />
        Back to {returnTo.split("?")[0] === "/" ? "My work" : "people"}
      </button>
      <div className="person-heading">
        <Avatar name={person.name} large />
        <div>
          <h1>{displayPersonName(person)}</h1>
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
          <small>Next review</small>
          <span>{formatDate(intake.reviewDate)}</span>
        </div>
        <div>
          <small>Next action</small>
          <span>{intake.nextAction}</span>
        </div>
      </div>
      <Tabs
        id="intake-workspace"
        label="Person record"
        items={tabs}
        value={tab}
        onChange={(value) => {
          const next = new URLSearchParams(params);
          next.set("tab", value.toLowerCase());
          navigate(`/people/${person.id}?${next}`, { scroll: false });
        }}
      />
      <div
        role="tabpanel"
        id="intake-workspace-panel"
        aria-labelledby={`intake-workspace-tab-${tabs.indexOf(tab)}`}
      >
        {tab === "Intake" && (
          <IntakePanel
            person={person}
            intake={intake}
            navigate={navigate}
          />
        )}
        {tab === "Consent & respondents" && (
          <ConsentRespondentsPanel
            key={intake.revision}
            person={person}
            intake={intake}
          />
        )}
        {tab === "Referrals" && (
          <Referrals person={person} intake={intake} openModal={openModal} />
        )}
        {tab === "History" && <IntakeHistory intake={intake} />}
      </div>
    </>
  );
}
