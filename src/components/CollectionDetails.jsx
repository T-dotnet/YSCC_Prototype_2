import {
  formatDate,
  clinicalReviewStatus,
  displayPersonName,
  displayCollectionActor,
  canCollectInEpisode,
} from "../model";
import { canAssess } from "../intake";
import { collectionSetupLabel } from "../overview";
import { Modal, Button, Badge } from "./UI";
import { contactsForAssessment } from "../assessmentContacts";
import { ChevronDown } from "lucide-react";
import { getInstrument } from "../instruments";
import { sessionAnswerCounts } from "../responseSessions";
import DeliveryAttemptsTable from "./DeliveryAttemptsTable";

export default function CollectionDetails({
  person,
  episode,
  collection,
  onClose,
  onAction,
  canCompleteAsClinician = false,
}) {
  const c = collection;
  const linkedContacts = contactsForAssessment(episode, c.id).sort((a, b) =>
    (a.actualDate || a.plannedDate || "").localeCompare(b.actualDate || b.plannedDate || ""));
  const submitted = c.response === "Submitted";
  const answerCounts = sessionAnswerCounts(c, getInstrument(c.version), !submitted);
  const savedAnswerCount = [...answerCounts.values()].reduce((sum, count) => sum + count, 0);
  const collectionOpen =
    canCollectInEpisode(episode, c) &&
    !["Paused", "Cancelled"].includes(c.assignment) &&
    canAssess(person, episode);

  return (
    <Modal
      title={c.label}
      subtitle={`${displayPersonName(person)} · Care episode ${episode.number}`}
      onClose={onClose}
      wide
    >
      <div className="form-body collection-details">
        <section
          className="collection-details-summary"
          aria-label="Collection status"
        >
          <div className="collection-details-summary-heading">
            <div>
              <h3>Response status</h3>
              <Badge>{c.response}</Badge>
            </div>
          </div>
          {!submitted && (
            <p>
              {c.response === "Draft"
                ? `${savedAnswerCount} ${savedAnswerCount === 1 ? "answer is" : "answers are"} saved. Start another session to continue on the same or a different channel.`
                : "No response has been submitted. Check delivery activity and contact arrangements before deciding whether another attempt is needed."}
            </p>
          )}
          <dl className="collection-details-status-facts">
            <div>
              <dt>Due date</dt>
              <dd>{formatDate(c.due)}</dd>
            </div>
            <div>
              <dt>Assignment</dt>
              <dd>
                <Badge>{c.assignment}</Badge>
              </dd>
            </div>
            <div>
              <dt>Clinical review</dt>
              <dd>
                <Badge>{clinicalReviewStatus(c)}</Badge>
              </dd>
            </div>
            {submitted && (
              <div>
                <dt>Submitted on</dt>
                <dd>
                  {c.submittedAt ? formatDate(c.submittedAt.slice(0, 10)) : "Not recorded"}
                </dd>
              </div>
            )}
          </dl>
        </section>
        <details className="collection-details-accordion" open>
          <summary>
            <span>Questionnaire and respondent</span>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <div className="collection-details-accordion-body">
            <dl className="metadata">
              <div>
                <dt>Instrument</dt>
                <dd>{c.version}</dd>
              </div>
              <div>
                <dt>Respondent</dt>
                <dd>{displayCollectionActor(person, c, "respondent")}</dd>
              </div>
              {submitted && (
                <>
                  <div>
                    <dt>Recorder</dt>
                    <dd>{displayCollectionActor(person, c, "recorder")}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>
        </details>
        <details className="collection-details-accordion" open>
          <summary>
            <span>Delivery attempts</span>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <div className="collection-details-accordion-body">
            {c.attempts?.length ? (
              <DeliveryAttemptsTable collection={c} contacts={episode.appointments || []} />
            ) : <p className="muted">No delivery attempts recorded.</p>}
            {!c.attempts?.length && (c.channel || c.externalAppointment) && (
              <dl className="metadata">
                {c.channel && <div><dt>Planned channel</dt><dd>{c.channel}</dd></div>}
                {c.externalAppointment && <div>
                  <dt>External contact</dt>
                  <dd>{c.externalAppointment.date} at {c.externalAppointment.time} · {c.externalAppointment.practitionerService} · {c.externalAppointment.deliveryMode}</dd>
                </div>}
              </dl>
            )}
          </div>
        </details>
      </div>
      <div className="modal-footer">
        <Button onClick={onClose}>Close</Button>
        {episode.status === "Active" && !["Cancelled", "Paused"].includes(c.assignment) &&
          (episode.appointments || []).length > linkedContacts.length && (
            <Button onClick={() => onAction("link-assessment-contact")}>Link existing contact</Button>
          )}
        {!submitted && collectionOpen && (
          <>
            {canCompleteAsClinician && (
              <Button
                disabled={
                  !canCollectInEpisode(episode, c) ||
                  ["Paused", "Cancelled"].includes(c.assignment)
                }
                onClick={() => onAction("clinician-entry")}
              >
                Complete as clinician
              </Button>
            )}
            <Button variant="primary" onClick={() => onAction("collection")}>
              {collectionSetupLabel(c)}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
