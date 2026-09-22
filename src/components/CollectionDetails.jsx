import {
  formatDate,
  clinicalReviewStatus,
  displayPersonName,
  displayCollectionActor,
} from "../model";
import { canAssess } from "../intake";
import { collectionSetupLabel } from "../overview";
import { Modal, Button, Badge, Notice } from "./UI";
import { ChevronDown, Calendar } from "lucide-react";

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
              {(() => {
                const linkedApptId = c.submittedAppointmentId || c.appointmentId;
                const linkedAppt =
                  (episode.appointments || []).find((a) => a.id === linkedApptId) ||
                  (episode.appointments || []).find(
                    (a) =>
                      (a.actualDate || a.plannedDate) === c.due ||
                      (a.actualDate || a.plannedDate) ===
                        (c.submittedAt ? c.submittedAt.slice(0, 10) : null),
                  );
                return linkedAppt ? (
                  <div>
                    <dt>Linked appointment</dt>
                    <dd
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        flexWrap: "wrap",
                      }}
                    >
                      <Calendar
                        size={14}
                        style={{ color: "var(--accent, #2563eb)", flexShrink: 0 }}
                        aria-hidden="true"
                      />
                      {onAction ? (
                        <button
                          type="button"
                          className="link-button"
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            color: "var(--accent, #2563eb)",
                            cursor: "pointer",
                            textDecoration: "underline",
                            fontSize: "inherit",
                            fontWeight: 500,
                          }}
                          onClick={() => {
                            onClose();
                            onAction({
                              type: "appointment-outcome",
                              appointmentId: linkedAppt.id,
                              episodeId: episode.id,
                              personId: person.id,
                              collectionId: c.id,
                            });
                          }}
                        >
                          {formatDate(linkedAppt.actualDate || linkedAppt.plannedDate)}{" "}
                          · {linkedAppt.plannedTime || linkedAppt.actualTime} ·{" "}
                          {linkedAppt.deliveryMode}
                        </button>
                      ) : (
                        <span>
                          {formatDate(linkedAppt.actualDate || linkedAppt.plannedDate)}{" "}
                          · {linkedAppt.plannedTime || linkedAppt.actualTime} ·{" "}
                          {linkedAppt.deliveryMode}
                        </span>
                      )}
                      <Badge>{linkedAppt.attendance}</Badge>
                    </dd>
                  </div>
                ) : null;
              })()}
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
