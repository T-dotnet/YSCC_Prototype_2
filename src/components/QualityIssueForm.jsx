import { useState } from "react";
import { QUALITY_STATUSES, getQualityIssues } from "../dataQuality";
import { TODAY, displayPersonName, formatTimestamp, qualityWorkflowError } from "../model";
import { Badge, Button, Field, Modal, Notice, StaffPicker, ValidatedForm } from "./UI";

const workflowTabs = {
  Intake: "intake",
  Referrals: "referrals",
  Contact: "appointments",
  "Consent & respondents": "consent & respondents",
};

export default function QualityIssueForm({
  modal,
  state,
  person,
  onClose,
  openModal,
  navigate,
  save,
}) {
  const [error, setError] = useState("");
  const issue = getQualityIssues(state, TODAY).find(
    (item) => item.id === modal.issueId && item.personId === modal.personId,
  );
  if (!issue || !person) return null;

  const canCorrect = state.issues.some(
    (item) => item.id === issue.id && item.field,
  );
  const workflowTab = workflowTabs[issue.workflow];
  const workflowPath = workflowTab ? `?tab=${encodeURIComponent(workflowTab)}` : "";

  const submit = (event) => {
    event.preventDefault();
    const action = {
      type: "UPDATE_QUALITY_ISSUE",
      personId: person.id,
      issueId: issue.id,
      ...Object.fromEntries(new FormData(event.currentTarget)),
    };
    const problem = qualityWorkflowError(state, action);
    if (problem) {
      setError(problem);
      return;
    }
    save(action, "Issue assignment and history updated.", setError);
  };

  return (
    <Modal
      title="Manage data quality issue"
      subtitle={`${displayPersonName(person)} · ${issue.id}`}
      onClose={onClose}
      wide
    >
      <ValidatedForm onSubmit={submit}>
        <div className="form-body quality-issue-dialog">
          <div className="quality-issue-summary">
            <div>
              <span className="quality-issue-label">{issue.type}</span>
              <h3>{issue.title}</h3>
            </div>
            <Badge tone={issue.severity === "High" || issue.severity === "Critical" ? "coral" : "amber"}>
              {issue.severity}
            </Badge>
          </div>
          <p>{issue.description}</p>
          <Notice>
            <strong>What to do:</strong> {issue.remediation}
          </Notice>
          <dl className="quality-issue-facts">
            <div><dt>Workflow</dt><dd>{issue.workflow}</dd></div>
            <div><dt>Detected</dt><dd>{formatTimestamp(issue.detectedAt)}</dd></div>
            <div><dt>Last updated</dt><dd>{formatTimestamp(issue.lastUpdated)}</dd></div>
            {issue.resolvedAt && (
              <div>
                <dt>Resolved</dt>
                <dd>{formatTimestamp(issue.resolvedAt)} · {issue.resolvedBy}</dd>
              </div>
            )}
          </dl>
          <div className="form-grid">
            <Field label="Assigned owner">
              <StaffPicker name="owner" defaultValue={issue.owner} required />
            </Field>
            <Field label="Status">
              <select name="status" defaultValue={issue.status}>
                {QUALITY_STATUSES.map((status) => <option key={status}>{status}</option>)}
              </select>
            </Field>
            <Field label="Due date (optional)">
              <input name="dueDate" type="date" defaultValue={issue.dueDate || ""} />
            </Field>
          </div>
          <Field label="Comment" hint="Explain the status, assignment or information needed.">
            <textarea
              name="comment"
              rows={3}
              required
              placeholder="For example, requested a verified referral copy from the intake team."
            />
          </Field>
          <Notice tone="amber">
            A workflow status does not resolve a detected data problem. Correct
            the underlying record before selecting Resolved.
          </Notice>
          <div className="quality-issue-history">
            <h3>History</h3>
            {issue.history?.length ? (
              <ol>
                {issue.history.map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.title}</strong>
                    <p>{entry.detail}</p>
                    <small>
                      {formatTimestamp(entry.timestamp)} · {entry.actor}
                      {entry.status ? ` · ${entry.status}` : ""}
                    </small>
                  </li>
                ))}
              </ol>
            ) : <p className="muted">No workflow updates have been recorded.</p>}
          </div>
        </div>
        <div className="modal-footer quality-issue-footer">
          {error && <p className="field-error form-save-error" role="alert">{error}</p>}
          <Button type="button" onClick={() => navigate(`/people/${person.id}${workflowPath}`)}>
            Open {issue.workflow}
          </Button>
          {canCorrect && !["Resolved", "Closed"].includes(issue.status) && (
            <Button
              type="button"
              onClick={() => openModal({ type: "correct", personId: person.id, issueId: issue.id })}
            >
              Correct source field
            </Button>
          )}
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">Save workflow update</Button>
        </div>
      </ValidatedForm>
    </Modal>
  );
}
