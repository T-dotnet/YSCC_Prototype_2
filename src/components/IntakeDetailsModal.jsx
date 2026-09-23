import { useState } from "react";
import { INTAKE_CHECKS, INTAKE_DETAIL_FIELDS, intakeActionError } from "../intake";
import { currentStaff, formatDate, formatTimestamp, TODAY } from "../model";
import { IntakeHistory } from "../features/Intake";
import { useStore } from "../store";
import { Badge, Button, Field, Modal } from "./UI";

const recorded = (value) => value === true ? "Yes" : value === false ? "No" : value || "Not recorded";
const date = (value) => value ? formatDate(value) : "Not recorded";
const timestamp = (value) => value ? formatTimestamp(value) : "Not recorded";
const missing = (value) => value == null || value === "" || value === "Not recorded";

const editGroups = [
  ["Registration and referral origin", [
    ["name", "Preferred or supplied name"],
    ["dob", "Date of birth", "date"],
    ["pronouns", "Pronouns"],
    ["legalName", "Supplied legal name"],
    ["sourceIdentifiers", "Supplied identifiers"],
    ["receivedAt", "Contact received", "datetime-local"],
    ["source", "Source or referring service"],
    ["sourceReference", "Source or referral reference"],
    ["reason", "Reason for contact", "textarea"],
  ]],
  ["Contact, permission and support", [
    ["contactMethod", "Safe contact method"],
    ["contactValue", "Contact details"],
    ["contactHolder", "Contact holder"],
    ["safeContact", "Safe contact restrictions or alternative route", "textarea"],
    ["permissionReference", "Permission source or reference"],
    ["language", "Preferred language"],
    ["supportNeeds", "Interpreter, accessibility or assistance needs", "textarea"],
    ["supporter", "Supporter and relationship"],
    ["authority", "Verified authority or outstanding check"],
  ]],
  ["Ownership and next step", [
    ["nextAction", "Next action", "textarea"],
    ["reviewDate", "Next review date", "date"],
    ["waitingReason", "Waiting reason or missing information", "textarea"],
    ["waitingOn", "Owner of outstanding step"],
    ["communication", "Next step communicated or pending", "textarea"],
  ]],
];

function IntakeSection({ title, rows }) {
  const present = rows.filter(([, value]) => !missing(value));
  const unrecorded = rows.filter(([, value]) => missing(value));
  const facts = (items) => (
    <dl className="intake-details-grid">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{recorded(value)}</dd>
        </div>
      ))}
    </dl>
  );
  return (
    <section className="intake-details-section">
      <h3>{title}</h3>
      {present.length ? facts(present) : <p className="muted">No details recorded in this section.</p>}
      {unrecorded.length > 0 && (
        <details className="intake-unrecorded">
          <summary>Show {unrecorded.length} unrecorded {unrecorded.length === 1 ? "field" : "fields"}</summary>
          {facts(unrecorded)}
        </details>
      )}
    </section>
  );
}

function EditField({ field, draft, onChange }) {
  const [key, label, type = "text"] = field;
  const value = draft[key] ?? "";
  return (
    <Field label={label}>
      {type === "textarea" ? (
        <textarea rows={3} value={value} onChange={(event) => onChange(key, event.target.value)} />
      ) : (
        <input
          type={type}
          value={type === "datetime-local" ? value.slice(0, 16) : value}
          max={type === "date" && key === "dob" ? TODAY : undefined}
          required={["name", "nextAction", "reviewDate"].includes(key)}
          onChange={(event) => onChange(key, event.target.value)}
        />
      )}
    </Field>
  );
}

const draftFrom = (person, intake) => ({
  name: person.nameUnknown ? "" : person.name,
  dob: person.dob || "",
  pronouns: person.pronouns || "",
  ...Object.fromEntries(INTAKE_DETAIL_FIELDS.map((key) => [key, intake?.[key] || ""])),
});

export default function IntakeDetailsModal({ person, intake, onClose }) {
  const { state, commit } = useStore();
  const [mode, setMode] = useState("view");
  const [draft, setDraft] = useState(() => draftFrom(person, intake));
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const editAction = {
    type: "UPDATE_INTAKE_DETAILS",
    personId: person.id,
    intakeId: intake?.id,
    revision: intake?.revision,
    values: draft,
    reason,
  };
  const begin = (nextMode) => {
    setDraft(draftFrom(person, intake));
    setReason("");
    setError("");
    setNotice("");
    setMode(nextMode);
  };
  const confirmEdit = (event) => {
    event.preventDefault();
    const problem = intakeActionError(state, editAction, currentStaff(state));
    if (problem) return setError(problem);
    const changed = ["name", "dob", "pronouns"].some((key) =>
      (draft[key] || "") !== (key === "name" ? person.name : person[key] || ""),
    ) || INTAKE_DETAIL_FIELDS.some((key) => (draft[key] || "") !== (intake?.[key] || ""));
    if (!changed) return setError("Change at least one field before continuing.");
    setError("");
    setMode("confirm-edit");
  };
  const saveEdit = () => {
    const result = commit(editAction);
    if (result.error) {
      setError(result.error);
      setMode("edit");
      return;
    }
    setNotice("Intake information updated. The change and reason were added to intake history.");
    setMode("view");
  };
  const changeArchive = (archived) => {
    const result = commit({
      type: archived ? "ARCHIVE_PERSON" : "RESTORE_PERSON",
      personId: person.id,
      reason,
    });
    if (result.error) return setError(result.error);
    setNotice(archived ? "Person archived. The record is available in the Archived People filter." : "Person restored to active People and work views.");
    setReason("");
    setError("");
    setMode("view");
  };

  return (
    <Modal
      title="Intake information"
      subtitle={`${person.name || "Name not recorded"} · ${person.id}`}
      onClose={onClose}
      wide
      className="intake-details-dialog"
    >
      {mode === "view" && (
        <>
          <div className="form-body intake-details-body">
            <div className="intake-details-overview">
              <div>
                <small>Intake outcome</small>
                <strong>{intake?.outcome || "Not recorded"}</strong>
                {intake?.status && <Badge>{intake.status}</Badge>}
              </div>
              <div>
                <small>Decision recorded</small>
                <strong>{date(intake?.decisionAt?.slice(0, 10))}</strong>
              </div>
              <div>
                <small>Intake owner</small>
                <strong>{recorded(intake?.owner)}</strong>
              </div>
            </div>
            {person.archivedAt && <p className="intake-archived-note">Archived {timestamp(person.archivedAt)} by {recorded(person.archivedBy)}. The care record is retained.</p>}
            {notice && <p className="form-save-success" role="status">{notice}</p>}
            <section className="intake-details-section" aria-label="Person tags">
              <h3>Tags</h3>
              {(person.tags || []).length ? (
                <div className="person-heading-tags">
                  {person.tags.map((tag) => <span className="person-tag" key={tag}>{tag}</span>)}
                </div>
              ) : <p className="muted">No tags added.</p>}
            </section>
            <IntakeSection title="Registration and referral origin" rows={[
              ["Preferred or supplied name", person.name],
              ["Supplied legal name", intake?.legalName],
              ["Date of birth", date(person.dob)],
              ["Pronouns", person.pronouns],
              ["Supplied identifiers", intake?.sourceIdentifiers],
              ["Intake ID", intake?.id],
              ["Service", intake?.service],
              ["Registered at", timestamp(intake?.createdAt)],
              ["Registered by", intake?.createdBy],
              ["Contact received", timestamp(intake?.receivedAt)],
              ["Source or referring service", intake?.source],
              ["Source or referral reference", intake?.sourceReference],
              ["Reason for contact", intake?.reason],
            ]} />
            {intake ? (
              <>
                <IntakeSection title="Contact, permission and support" rows={[
                  ["Safe contact method", intake.contactMethod],
                  ["Contact details", intake.contactValue],
                  ["Contact holder", intake.contactHolder],
                  ["Safe contact restrictions or alternative route", intake.safeContact],
                  ["Permission source or reference", intake.permissionReference],
                  ["Preferred language", intake.language],
                  ["Interpreter, accessibility or assistance needs", intake.supportNeeds],
                  ["Supporter and relationship", intake.supporter],
                  ["Verified authority or outstanding check", intake.authority],
                  ["Consent for assessment participation recorded", intake.consentRecorded],
                  ["Consent source or reference", intake.consentReference],
                  ["Initial assessment respondent", intake.respondentPreference],
                  ["Respondent name", intake.respondentName],
                ]} />
                <IntakeSection title="Required checks" rows={[
                  ...INTAKE_CHECKS.map(([key, label]) => [label, intake[key]]),
                  ["Source and outcome of checks", intake.checkEvidence],
                  ["Assigned triage reviewer", intake.reviewer],
                ]} />
                <IntakeSection title="Decision, ownership and next step" rows={[
                  ["Intake state", intake.status],
                  ["Intake outcome", intake.outcome],
                  ["Triage summary or exit reason", intake.summary],
                  ["Decision recorded by", intake.decisionBy],
                  ["Decision time", timestamp(intake.decisionAt)],
                  ["YSCC intake owner", intake.owner],
                  ["Receiving assessment owner", intake.assessmentOwner],
                  ["Next action", intake.nextAction],
                  ["Next review date", date(intake.reviewDate)],
                  ["Waiting reason or missing information", intake.waitingReason],
                  ["Owner of outstanding step", intake.waitingOn],
                  ["Next step communicated or pending", intake.communication],
                ]} />
                <details className="intake-details-history">
                  <summary>Intake history <span>{intake.history.length} {intake.history.length === 1 ? "entry" : "entries"}</span></summary>
                  <IntakeHistory intake={intake} bare />
                </details>
              </>
            ) : <p>No intake record is linked to this care period.</p>}
          </div>
          <div className="modal-footer intake-details-actions">
            {person.archivedAt ? (
              <Button className="intake-restore-button" onClick={() => begin("confirm-restore")}>Restore patient</Button>
            ) : (
              <Button className="intake-archive-button" onClick={() => begin("confirm-archive")}>Archive patient</Button>
            )}
            {intake && !person.archivedAt && <Button onClick={() => begin("edit")}>Edit information</Button>}
            <Button variant="primary" onClick={onClose}>Close</Button>
          </div>
        </>
      )}
      {mode === "edit" && (
        <form onSubmit={confirmEdit}>
          <div className="form-body intake-details-body intake-edit-body">
            <p>Update recorded identity, referral, contact and follow-up details. The completed intake decision and required checks stay in the history.</p>
            {editGroups.map(([title, fields]) => (
              <section className="intake-details-section" key={title}>
                <h3>{title}</h3>
                <div className="intake-edit-grid">
                  {fields.map((field) => (
                    <EditField key={field[0]} field={field} draft={draft} onChange={(key, value) => setDraft((current) => ({ ...current, [key]: value }))} />
                  ))}
                </div>
              </section>
            ))}
            <Field label="Reason for this update">
              <textarea rows={3} required value={reason} onChange={(event) => setReason(event.target.value)} />
            </Field>
            {error && <p className="field-error" role="alert">{error}</p>}
          </div>
          <div className="modal-footer intake-details-actions">
            <Button type="button" onClick={() => setMode("view")}>Cancel</Button>
            <Button type="submit" variant="primary">Review changes</Button>
          </div>
        </form>
      )}
      {mode.startsWith("confirm-") && (
        <div className="intake-confirmation">
          <div className="form-body">
            <h3>{mode === "confirm-edit" ? "Save intake changes?" : mode === "confirm-archive" ? "Archive this patient?" : "Restore this patient?"}</h3>
            <p>{mode === "confirm-edit"
              ? `The updated details for ${person.name} will be saved. The reason will appear in intake history.`
              : mode === "confirm-archive"
                ? `${person.name} will leave active People and work views. Appointments, assessments and intake history will remain in the record, which can be restored from the Archived filter.`
                : `${person.name} will return to active People and work views with the existing care record preserved.`}</p>
            {mode !== "confirm-edit" && (
              <Field label={mode === "confirm-archive" ? "Reason for archiving" : "Reason for restoring"}>
                <textarea rows={3} required value={reason} onChange={(event) => setReason(event.target.value)} />
              </Field>
            )}
            {error && <p className="field-error" role="alert">{error}</p>}
          </div>
          <div className="modal-footer intake-details-actions">
            <Button onClick={() => { setError(""); setMode(mode === "confirm-edit" ? "edit" : "view"); }}>Back</Button>
            <Button variant="primary" className={mode === "confirm-archive" ? "intake-confirm-archive-button" : ""} disabled={!reason.trim()} onClick={mode === "confirm-edit" ? saveEdit : () => changeArchive(mode === "confirm-archive")}>
              {mode === "confirm-edit" ? "Confirm and save" : mode === "confirm-archive" ? "Confirm archive" : "Confirm restore"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
