import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, ArrowRight } from "lucide-react";
import { useStore } from "../store";
import {
  TODAY,
  currentStaff,
  displayPersonName,
  formatDate,
  formatTimestamp,
} from "../model";
import { REFERRAL_EVENTS, referralOpen, intakeActionError } from "../intake";
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

export default function Referrals({ person, intake, episode, openModal }) {
  const params = useSearchParams();
  const referrals = [...(person.referrals || [])].sort((a, b) =>
    a.id === params.get("referral")
      ? -1
      : b.id === params.get("referral")
        ? 1
        : 0,
  );
  return (
    <div className="stack">
      <div className="section-toolbar">
        <div>
          <h2>Onward referrals</h2>
          <p>
            Keep ownership through the receiving service’s response and
            handover.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() =>
            openModal({
              type: "new-referral",
              personId: person.id,
              intakeId: intake?.id,
              episodeId: episode?.id,
            })
          }
        >
          <Plus size={17} />
          Add referral
        </Button>
      </div>
      <Notice>
        Record events from the agreed service channel. This workspace does not
        send referrals or contact another service.
      </Notice>
      {!referrals.length && (
        <Panel title="No onward referrals">
          <div className="panel-body">
            <p>
              Add a referral when the agreed next-care plan involves another
              service. Intake can continue while referral follow-up stays owned.
            </p>
          </div>
        </Panel>
      )}
      {referrals.map((r) => (
        <Panel
          key={r.id}
          title={r.destination}
          action={<Badge>{r.handover}</Badge>}
          className={
            r.id === params.get("referral") ? "selected-collection" : ""
          }
        >
          <div className="panel-body stack">
            <p>{r.purpose}</p>
            <div className="referral-states">
              {[
                ["Preparation", r.preparation],
                ["Sending", r.transmission],
                ["Receipt", r.receipt],
                ["Service decision", r.decision],
              ].map(([label, value]) => (
                <div key={label}>
                  <small>{label}</small>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <dl className="metadata">
              <div>
                <dt>YSCC follow-up owner</dt>
                <dd>{r.owner}</dd>
              </div>
              <div>
                <dt>Receiving service responsibility</dt>
                <dd>{r.receivingResponsibility || "Not confirmed"}</dd>
              </div>
              <div>
                <dt>Receiving responsible person / team</dt>
                <dd>{r.externalOwner || "Not confirmed"}</dd>
              </div>
              {r.handoverConfirmedAt && (
                <div>
                  <dt>Handover confirmed</dt>
                  <dd>{formatTimestamp(r.handoverConfirmedAt)}</dd>
                </div>
              )}
              {r.handoverEvidence && (
                <div>
                  <dt>Confirmation evidence</dt>
                  <dd>{r.handoverEvidence}</dd>
                </div>
              )}
              {r.closureReconciliation && (
                <div>
                  <dt>Closure reconciliation</dt>
                  <dd>
                    {r.closureReconciliation.action} · {r.closureReconciliation.owner} · due {formatDate(r.closureReconciliation.due)}
                  </dd>
                </div>
              )}
              <div>
                <dt>Next action</dt>
                <dd>{r.nextAction}</dd>
              </div>
              <div>
                <dt>Follow-up date</dt>
                <dd>{formatDate(r.reviewDate)}</dd>
              </div>
              <div>
                <dt>Sending attempts</dt>
                <dd>{r.attempts.length}</dd>
              </div>
              <div>
                <dt>Linked care period</dt>
                <dd>
                  {r.episodeId
                    ? person.episodes.find((e) => e.id === r.episodeId)
                        ?.status || "Retained record"
                    : "Intake / person"}
                </dd>
              </div>
            </dl>
            {referralOpen(r) && (
              <Button
                onClick={() =>
                  openModal({
                    type: "referral-event",
                    personId: person.id,
                    referralId: r.id,
                  })
                }
              >
                Record referral event
                <ArrowRight size={17} />
              </Button>
            )}
            <details className="setup-disclosure">
              <summary>Referral history ({r.history.length})</summary>
              <ol className="intake-history">
                {r.history.map((h) => (
                  <li key={h.id}>
                    <strong>
                      {h.title}
                      {h.result ? ` · ${h.result}` : ""}
                    </strong>
                    <p>{h.detail}</p>
                    {h.occurredAt && (
                      <small>
                        Occurred {formatTimestamp(h.occurredAt)} · {h.system}
                      </small>
                    )}
                    <small>
                      Recorded {formatTimestamp(h.timestamp)} · {h.actor}
                    </small>
                    {h.plan && <p>Next-care arrangement: {h.plan}</p>}
                  </li>
                ))}
              </ol>
            </details>
          </div>
        </Panel>
      ))}
    </div>
  );
}

export function ReferralForm({ modal, onClose, notify }) {
  const { state, commit } = useStore(),
    staff = currentStaff(state);
  const person = state.people.find((p) => p.id === modal.personId);
  const referral = person?.referrals?.find((r) => r.id === modal.referralId);
  const creating = modal.type === "new-referral";
  const [requestId] = useState(() => crypto.randomUUID());
  const [kind, setKind] = useState("Sending attempt"),
    [error, setError] = useState("");
  const sending = ["Sending attempt", "Verify sending outcome"].includes(kind);
  const resolving = [
    "Handover confirmed",
    "Alternative plan",
    "Cancelled with plan",
  ].includes(kind);
  if (!person || (!creating && !referral)) return null;
  return (
    <Modal
      title={creating ? "Add onward referral" : "Record referral event"}
      subtitle={`${displayPersonName(person)}${referral ? ` · ${referral.destination}` : ""}`}
      onClose={onClose}
    >
      <ValidatedForm
        onSubmit={(event) => {
          event.preventDefault();
          const values = Object.fromEntries(new FormData(event.currentTarget));
          const action = {
            ...modal,
            type: creating ? "ADD_REFERRAL" : "REFERRAL_EVENT",
            requestId,
            revision: referral?.revision,
            values: { ...values, kind },
          };
          const problem = intakeActionError(state, action, staff);
          if (problem) return setError(problem);
          const result = commit(action);
          if (result.error) return setError(result.error);
          onClose();
          notify(
            creating
              ? "Referral draft saved. Follow-up stays with the YSCC owner."
              : "Referral event recorded. Earlier events are retained.",
          );
        }}
      >
        <div className="form-body">
          <Notice>
            {creating
              ? "Save the agreed destination and follow-up plan. No message will be sent."
              : "Record what happened through the agreed external channel. Sending, receipt, acceptance and handover are separate events."}
          </Notice>
          {creating ? (
            <>
              <Field label="Receiving service">
                <input name="destination" required />
              </Field>
              <Field label="Receiving contact (if known)">
                <input name="destinationContact" />
              </Field>
              <Field label="Referral purpose">
                <textarea name="purpose" required rows={2} />
              </Field>
              <Field label="YSCC follow-up owner">
                <StaffPicker
                  name="owner"
                  defaultValue={staff?.name || ""}
                  required
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Event">
                <select
                  value={kind}
                  onChange={(event) => setKind(event.target.value)}
                >
                  {REFERRAL_EVENTS.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </Field>
              {sending && (
                <Field label="Observed sending outcome">
                  <select name="result">
                    <option>Sent</option>
                    <option>Failed</option>
                    <option>Outcome unknown</option>
                  </select>
                </Field>
              )}
              <Field label="Actual event date and time">
                <input name="occurredAt" type="datetime-local" required />
              </Field>
              <Field label="External service / system / channel">
                <input
                  name="system"
                  required
                  placeholder="e.g. receiving service telephone confirmation"
                />
              </Field>
              <Field label="Evidence reference / observed outcome">
                <textarea
                  name="evidence"
                  rows={2}
                  required
                  placeholder="Record the permitted reference and what was confirmed."
                />
              </Field>
              <Field label="External responsible person / team">
                <input
                  name="externalOwner"
                  defaultValue={referral.externalOwner}
                  required={kind === "Handover confirmed"}
                />
              </Field>
              {kind === "Handover confirmed" && (
                <Field label="Receiving-service responsibility">
                  <select name="receivingResponsibility" defaultValue="">
                    <option value="" disabled>Choose confirmation</option>
                    <option value="Confirmed">
                      Receiving service has confirmed responsibility
                    </option>
                  </select>
                </Field>
              )}
              {resolving && (
                <Field label="Agreed next-care arrangement / alternative plan">
                  <textarea name="plan" rows={2} required />
                </Field>
              )}
            </>
          )}
          {(creating || sending) && (
            <>
              <Field label="Sharing permission reference">
                <input
                  name="permissionReference"
                  defaultValue={referral?.permissionReference || ""}
                  required={!creating}
                />
              </Field>
              <Field label="Permitted information">
                <textarea
                  name="permittedInformation"
                  defaultValue={referral?.permittedInformation || ""}
                  rows={2}
                  required={!creating}
                />
              </Field>
            </>
          )}
          <Field
            label={
              resolving
                ? "Remaining next step and owner"
                : "Next follow-up action"
            }
          >
            <textarea
              name="nextAction"
              rows={2}
              defaultValue={
                referral?.nextAction ||
                "Prepare referral and verify the receiving service response"
              }
              required
            />
          </Field>
          {!creating && (
            <Field label="YSCC follow-up owner">
              <StaffPicker name="owner" defaultValue={referral.owner} required />
            </Field>
          )}
          <Field label={resolving ? "Plan review date" : "Follow-up date"}>
            <input
              name="reviewDate"
              type="date"
              defaultValue={referral?.reviewDate || TODAY}
              required
            />
          </Field>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {creating ? "Save referral draft" : "Record event"}
          </Button>
        </div>
      </ValidatedForm>
    </Modal>
  );
}
