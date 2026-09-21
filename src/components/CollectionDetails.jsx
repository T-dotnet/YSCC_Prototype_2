import {
  formatDate,
  clinicalReviewStatus,
  displayPersonName,
  displayCollectionActor,
} from "../model";
import { canAssess } from "../intake";
import { collectionSetupLabel } from "../overview";
import { Modal, Button, Badge, Notice } from "./UI";
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
  const submitted = c.response === "Submitted";
  const collectionOpen =
    episode.status === "Active" &&
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
                  {c.submittedAt ? formatDate(c.submittedAt) : "Not recorded"}
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
        <details className="collection-details-accordion" open>
          <summary>
            <span>Delivery attempts</span>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <div className="collection-details-accordion-body">
            {c.attempts.length ? (
              c.attempts.map((a, i) => (
                <div className="attempt" key={a.id}>
                  <div>
                    <strong>
                      Attempt {i + 1} · {a.channel}
                    </strong>
                    <small>{formatDate(a.date)}</small>
                  </div>
                  <Badge>{a.status}</Badge>
                </div>
              ))
            ) : (
              <p className="muted">
                {submitted
                  ? "Delivery history was not recorded for this response."
                  : "No delivery attempts recorded."}
              </p>
            )}
            <Notice>
              Reissuing a link adds an attempt to this assignment. It does not
              create a new time point.
            </Notice>
          </div>
        </details>
      </div>
      <div className="modal-footer">
        <Button onClick={onClose}>Close</Button>
        {!submitted && collectionOpen && (
          <>
            {canCompleteAsClinician && (
              <Button
                disabled={
                  episode.status !== "Active" ||
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
