import { displayMeasureVersion } from '../terminology.js';
import { episodeWithVisibleContacts } from "../assessmentFeatures.js";
import { PLANNED_COLLECTION_METHOD_LABEL } from "../terminology.js";
import {
  formatDate,
  clinicalReviewStatus,
  displayPersonName,
  displayCollectionActor,
  canCollectInEpisode,
  TODAY,
} from "../model";
import { assessmentDueLabel } from "../assessmentDue";
import { canAssess } from "../intake";
import { collectionSetupLabel } from "../overview";
import { ActionGroup, Modal, Button, Badge, AlertLabel } from "./UI";
import { contactsForAssessment } from "../assessmentContacts";
import { ChevronDown } from "lucide-react";
import { getInstrument } from "../instruments";
import { sessionAnswerCounts } from "../responseSessions";
import DeliveryAttemptsTable from "./DeliveryAttemptsTable";
import RelatedRecordsAccordion from "./RelatedRecordsAccordion";

export default function CollectionDetails({
  person,
  episode,
  collection,
  onClose,
  onAction,
  canCompleteAsClinician = false,
  simpleAssessments = false,
  scheduleAssessments = true,
  showDueDates = scheduleAssessments,
  showDueLabels = false,
  linkAssessmentAppointments = true,
  assessmentSms = true,
}) {
  episode = episodeWithVisibleContacts(episode, { scheduleAssessments });
  const c = collection;
  const dueLabel = showDueLabels ? assessmentDueLabel(c, TODAY) : null;
  const visibleAttempts = (c.attempts || []).filter((attempt) => assessmentSms || attempt.channel !== "SMS link");
  const linkedContacts = contactsForAssessment(episode, c.id)
    .filter((contact) => assessmentSms || contact.deliveryMode !== "SMS")
    .sort((a, b) =>
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
          aria-label="Measure status"
        >
          <div className="collection-details-summary-heading">
            <div>
              <h3>Response status</h3>
              <Badge>{simpleAssessments ? submitted ? "Completed" : c.response === "Draft" ? "Draft" : "Not started" : c.response}</Badge>
            </div>
          </div>
          {!submitted && (
            <p>
              {c.response === "Draft"
                ? `${savedAnswerCount} ${savedAnswerCount === 1 ? "answer is" : "answers are"} saved. Start another session to continue on the same or a different collection method.`
                : simpleAssessments
                  ? "No draft has been saved yet. Start the measure when ready."
                  : "No response has been submitted. Check delivery activity and contact arrangements before deciding whether another attempt is needed."}
            </p>
          )}
          <dl className="collection-details-status-facts">
            {showDueDates && <div>
              <dt>Due date</dt>
              <dd className="assessment-record-due">{c.due ? formatDate(c.due) : "Not set"}
                {dueLabel && <AlertLabel tone={dueLabel === "Past due" ? "danger" : "attention"}>{dueLabel}</AlertLabel>}
              </dd>
            </div>}
            {linkAssessmentAppointments && c.externalAppointment && <div>
              <dt>External contact</dt>
              <dd>{formatDate(c.externalAppointment.date)} at {c.externalAppointment.time} · {c.externalAppointment.practitionerService}</dd>
            </div>}
            {!simpleAssessments && <div>
              <dt>Assignment</dt>
              <dd>
                <Badge>{c.assignment}</Badge>
              </dd>
            </div>}
            {!simpleAssessments && <div>
              <dt>Clinical review</dt>
              <dd>
                <Badge>{clinicalReviewStatus(c)}</Badge>
              </dd>
            </div>}
            {simpleAssessments && <div><dt>Created</dt><dd>{c.createdAt ? formatDate(c.createdAt.slice(0, 10)) : "Recorded"}</dd></div>}
            {simpleAssessments && <div><dt>Draft</dt><dd>{c.response === "Draft" ? "Saved" : "—"}</dd></div>}
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
            <span>Measure and respondent</span>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <div className="collection-details-accordion-body">
            <dl className="metadata">
              <div>
                <dt>Measure</dt>
                <dd>{displayMeasureVersion(c.version)}</dd>
              </div>
              {c.bundleId && <>
                <div><dt>Collection Occasion</dt><dd>{c.bundleName}</dd></div>
                <div><dt>Requirement</dt><dd>{c.bundleRequirement}</dd></div>
              </>}
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
        {!simpleAssessments && <details className="collection-details-accordion" open>
          <summary>
            <span>Delivery attempts</span>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <div className="collection-details-accordion-body">
            {visibleAttempts.length ? (
              <DeliveryAttemptsTable collection={{ ...c, attempts: visibleAttempts }} contacts={linkAssessmentAppointments ? (episode.appointments || []).filter((contact) => assessmentSms || contact.deliveryMode !== "SMS") : []} />
            ) : <p className="muted">No delivery attempts recorded.</p>}
            {!visibleAttempts.length && ((assessmentSms || c.channel !== "SMS link") && c.channel || linkAssessmentAppointments && c.externalAppointment) && (
              <dl className="metadata">
                {(assessmentSms || c.channel !== "SMS link") && c.channel && <div><dt>{PLANNED_COLLECTION_METHOD_LABEL}</dt><dd>{c.channel}</dd></div>}
                {linkAssessmentAppointments && c.externalAppointment && <div>
                  <dt>External contact</dt>
                  <dd>{c.externalAppointment.date} at {c.externalAppointment.time} · {c.externalAppointment.practitionerService} · {c.externalAppointment.deliveryMode}</dd>
                </div>}
              </dl>
            )}
          </div>
        </details>}
        {linkAssessmentAppointments && <RelatedRecordsAccordion kind="contacts" records={linkedContacts} collection={c} />}
      </div>
      <ActionGroup className="modal-footer">
        <Button onClick={onClose}>Close</Button>
        {linkAssessmentAppointments && episode.status === "Active" && !["Cancelled", "Paused"].includes(c.assignment) &&
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
      </ActionGroup>
    </Modal>
  );
}
