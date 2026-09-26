import {
  formatDate,
  clinicalReviewStatus,
  displayPersonName,
  displayCollectionActor,
  canCollectInEpisode,
} from "../model";
import { canAssess } from "../intake";
import { collectionSetupLabel } from "../overview";
import { Modal, Button, Badge, Notice } from "./UI";
import { contactsForAssessment } from "../assessmentContacts";
import { ChevronDown } from "lucide-react";

export default function CollectionDetails({
  person,
  episode,
  collection,
  onClose,
  onAction,
  canCompleteAsClinician = false,
}) {
  const c = collection;
  const linkedContacts = contactsForAssessment(episode, c.id);
  const submitted = c.response === "Submitted";
  const collectionOpen =
    canCollectInEpisode(episode, c) &&
    !["Paused", "Cancelled"].includes(c.assignment) &&
    canAssess(person, episode);

  return (
    <Modal
      title={c.label}
      subtitle={`${displayPersonName(person)} · Care episode ${episode.number}`}
      onClose={onClose}
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
                ? "A draft is in progress. This sample draft cannot be resumed; check the collection arrangements before starting another attempt."
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
              {(submitted || c.attempts.length > 0) && (
                <>
                  <div>
                    <dt>Recorder</dt>
                    <dd>{displayCollectionActor(person, c, "recorder")}</dd>
                  </div>
                  <div>
                    <dt>Assistance</dt>
                    <dd>{c.assistance || "Not recorded"}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>
        </details>
        <details className="collection-details-accordion" open>
          <summary>
            <span>Delivery and contact</span>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <div className="collection-details-accordion-body">
            <dl className="metadata">
              <div>
                <dt>Channel</dt>
                <dd>
                  {c.channel || (submitted ? "Not recorded" : "Not selected")}
                </dd>
              </div>
              {c.externalAppointment && <div>
                <dt>External appointment</dt>
                <dd>{c.externalAppointment.date} at {c.externalAppointment.time} · {c.externalAppointment.practitionerService} · {c.externalAppointment.deliveryMode}</dd>
              </div>}
              <div>
                <dt>Related contacts</dt>
                <dd>
                  {linkedContacts.length ? linkedContacts.map((contact) => (
                    <div key={contact.id} className="assessment-related-contact-row">
                      {formatDate(contact.actualDate || contact.plannedDate)} · {contact.contactType || contact.appointmentType || "Service contact"} · {contact.attendance}
                      {c.submittedAppointmentId === contact.id && <Badge>Response source</Badge>}
                    </div>
                  )) : "None linked"}
                </dd>
              </div>
              {!submitted && (
                <>
                  <div>
                    <dt>Link / session</dt>
                    <dd>{c.link || "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Participation</dt>
                    <dd>{person.consent}</dd>
                  </div>
                  <div>
                    <dt>Contact suitability</dt>
                    <dd>{person.contact}</dd>
                  </div>
                </>
              )}
            </dl>
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
