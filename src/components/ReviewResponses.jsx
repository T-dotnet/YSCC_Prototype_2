import { getInstrument } from "../instruments";
import useDraft from "../useDraft";
import { useRef, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Pencil,
  ChevronDown,
  Clock3,
  ArrowLeft,
  Calendar,
} from "lucide-react";
import { useStore } from "../store";
import {
  canEditResponses,
  currentStaff,
  formatDate,
  clinicalReviewStatus,
  noClinicalReviewRequired,
  displayPersonName,
  displayCollectionActor,
  TODAY,
} from "../model";
import { Modal, Button, Badge, Field, Notice, ValidatedForm } from "./UI";
import SubmittedAnswers from "./SubmittedAnswers";
import ResponseHistory from "./ResponseHistory";
import DiscardChanges from "./DiscardChanges";
import DeliveryAttemptsTable from "./DeliveryAttemptsTable";

export default function ReviewResponses({
  person,
  episode,
  collection,
  initialNote = "",
  onClose,
  onEdit,
  notify,
  fullPage = false,
  analysis,
}) {
  const { state, commit } = useStore();
  const [saveError, setSaveError] = useState("");
  const [draft, setDraft, clearDraft, draftError] = useDraft(
    `review:${collection.id}:${collection.revision ?? 0}:${currentStaff(state)?.id}`,
    { note: initialNote, confirmed: false },
  );
  const { note, confirmed } = draft;
  const setNote = (note) => setDraft((value) => ({ ...value, note }));
  const setConfirmed = (confirmed) =>
    setDraft((value) => ({ ...value, confirmed }));
  const [discard, setDiscard] = useState(false);
  const noteField = useRef(null);
  const returnFocus = useRef(null);
  const c = collection;
  const submissionSession = c.attempts?.find((attempt) => attempt.id === c.submittedAttemptId);
  const reviewNotRequired = noClinicalReviewRequired(c);
  const reviewed = c.review === "Reviewed" || reviewNotRequired;
  const canReview =
    currentStaff(state)?.role === "Clinician" &&
    c.response === "Submitted" &&
    !c.readOnly &&
    !reviewNotRequired &&
    (!reviewed || c.needsReview);
  const canEdit =
    canEditResponses(state) &&
    !c.readOnly &&
    !!getInstrument(c.version) &&
    c.response === "Submitted";

  const assessmentDate = c.submittedAt ? c.submittedAt.slice(0, 10) : TODAY;
  const plannedAppointments = (episode?.appointments || []).filter(
    (a) => a.attendance === "Planned",
  );
  const recordedAppointments = (episode?.appointments || []).filter(
    (a) => a.attendance !== "Planned",
  );
  const sameDayRecordedAppointments = recordedAppointments.filter(
    (a) =>
      a.actualDate === assessmentDate || a.plannedDate === assessmentDate,
  );

  const defaultAppt =
    plannedAppointments.find((a) => a.plannedDate === assessmentDate) ||
    plannedAppointments[0];

  const [selectedAppointmentId, setSelectedAppointmentId] = useState(
    defaultAppt?.id || "",
  );

  const activeAppointment =
    plannedAppointments.find((a) => a.id === selectedAppointmentId) ||
    defaultAppt;

  const [appointmentAttendance, setAppointmentAttendance] =
    useState("Attended");
  const [actualDate, setActualDate] = useState(
    assessmentDate || activeAppointment?.plannedDate || TODAY,
  );
  const [actualTime, setActualTime] = useState(
    activeAppointment?.plannedTime || "10:00",
  );
  const [actualDuration, setActualDuration] = useState(
    activeAppointment?.plannedDurationMinutes || 60,
  );
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const actualLatestDate =
    episode?.end && episode.end < TODAY ? episode.end : TODAY;

  const requestClose = () => {
    if (!canReview || (!note.trim() && !confirmed)) {
      clearDraft();
      return onClose();
    }
    if (!discard) returnFocus.current = document.activeElement;
    setDiscard(true);
  };
  const keepEditing = () => {
    setDiscard(false);
    requestAnimationFrame(() => returnFocus.current?.focus());
  };
  const ReviewIcon = c.needsReview ? Clock3 : CheckCircle2;
  const title = c.needsReview
    ? "Review updated answers"
    : reviewNotRequired
      ? "Response recorded"
      : reviewed
        ? "Review recorded"
        : "Review questionnaire";

  const record = (
    <ValidatedForm
      hidden={discard}
      onSubmit={(event) => {
        event.preventDefault();
        if (!canReview || !note.trim() || !confirmed) return;

        if (activeAppointment && appointmentAttendance !== "Planned") {
          const outcomeResult = commit({
            type: "RECORD_APPOINTMENT_OUTCOME",
            personId: person.id,
            episodeId: episode.id,
            appointmentId: activeAppointment.id,
            attendance: appointmentAttendance,
            actualDate:
              appointmentAttendance === "Attended" ? actualDate : null,
            actualTime:
              appointmentAttendance === "Attended" ? actualTime : null,
            actualDurationMinutes:
              appointmentAttendance === "Attended"
                ? Number(actualDuration) || 60
                : null,
            outcomeNotes: outcomeNotes.trim() || null,
          });
          if (outcomeResult.error) {
            setSaveError(outcomeResult.error);
            return;
          }
        }

        const result = commit({
          type: "REVIEW",
          personId: person.id,
          episodeId: episode.id,
          collectionId: c.id,
          note,
        });
        if (result.error) {
          setSaveError(result.error);
          return;
        }
        clearDraft();
        onClose();
        notify(
          activeAppointment && appointmentAttendance !== "Planned"
            ? "Clinical review and associated contact outcome saved."
            : "Clinical review saved. Assessment completion remains a separate care decision.",
        );
      }}
    >
      <div className="response-dialog-body">
        {c.readOnly && <Notice>This historical assessment is view only. Its submitted answers and recorded review remain available.</Notice>}
        {saveError && (
          <p className="form-error" role="alert">
            {saveError}
          </p>
        )}
        <div className="response-status-line">
          <Badge>{clinicalReviewStatus(c)}</Badge>
          <span>
            {c.submittedAt
              ? `Submitted ${formatDate(c.submittedAt.slice(0, 10))}`
              : "Submission date not recorded"}
          </span>
          {c.needsReview && canReview && (
            <button
              type="button"
              className="inline-link"
              onClick={() => noteField.current?.focus()}
            >
              Add new review
            </button>
          )}
        </div>
        {reviewed ? (
          <section
            className={`recorded-review-card ${c.needsReview ? "outdated" : ""}`}
            aria-label={
              c.needsReview
                ? "Earlier clinical review"
                : "Recorded clinical review"
            }
          >
            <ReviewIcon size={23} aria-hidden="true" />
            <div>
              <h3>
                {reviewNotRequired
                  ? "Clinical review not required"
                  : c.needsReview
                    ? "Earlier clinical review"
                    : "Clinical review"}
              </h3>
              {reviewNotRequired ? (
                <p className="review-author">
                  This response used a completion method that does not need a
                  separate clinical review.
                </p>
              ) : (
                <p className="review-author">
                  {c.reviewActor || "Reviewer not recorded"}
                  {c.reviewDate && ` · ${formatDate(c.reviewDate)}`}
                </p>
              )}
              <p className="recorded-review-text">
                {reviewNotRequired
                  ? `${submissionSession?.channel || c.channel}${submissionSession?.assistance || c.assistance ? ` · ${submissionSession?.assistance || c.assistance}` : ""}`
                  : c.reviewNote || "No review note recorded."}
              </p>
              {sameDayRecordedAppointments.length > 0 && (
                <p
                  style={{
                    marginTop: "8px",
                    paddingTop: "8px",
                    borderTop: "1px solid var(--line-soft)",
                    fontSize: "0.83rem",
                    color: "var(--muted)",
                  }}
                >
                  <strong>Associated contact:</strong>{" "}
                  {sameDayRecordedAppointments
                    .map(
                      (a) =>
                        `${a.attendance} (${a.actualDate || a.plannedDate} at ${a.actualTime || a.plannedTime}) · ${a.practitionerService}`,
                    )
                    .join("; ")}
                </p>
              )}
              {c.needsReview && (
                <p className="review-impact">
                  Answers have changed since this review. The updated answers
                  need a new review.
                </p>
              )}
            </div>
          </section>
        ) : (
          <div className="review-introduction">
            <ClipboardCheck size={22} aria-hidden="true" />
            <p>
              {reviewNotRequired
                ? "This response does not require a separate clinical review."
                : canReview
                  ? "Read the answers, then record your observations and next care step."
                  : "Awaiting clinical review. A clinician can review these answers and record the next care step."}
            </p>
          </div>
        )}
        {analysis || (
          <SubmittedAnswers
            person={person}
            collection={c}
            headerAction={
              canEdit && (
                <Button type="button" onClick={() => onEdit(note)}>
                  <Pencil size={16} aria-hidden="true" />
                  Edit answers
                </Button>
              )
            }
          />
        )}
        <details className="response-disclosure">
          <summary>
            <span>Respondent and delivery</span>
            <ChevronDown size={17} aria-hidden="true" />
          </summary>
          <dl className="response-source-grid">
            <div>
              <dt>Answered by</dt>
              <dd>{displayCollectionActor(person, c, "respondent")}</dd>
            </div>
            <div>
              <dt>Recorded by</dt>
              <dd>{displayCollectionActor(person, c, "recorder")}</dd>
            </div>
          </dl>
          {!!c.attempts?.length && <div className="response-delivery-attempts">
            <h4>Delivery attempts</h4>
            <DeliveryAttemptsTable collection={c} contacts={episode.appointments || []} />
          </div>}
        </details>
        {canReview && (
          <section
            className="clinical-review-input"
            aria-label="Your clinical review"
          >
            <div>
              <h3>
                {c.needsReview ? "New clinical review" : "Your clinical review"}
              </h3>
              <p className="muted">
                Record what the answers mean for the next care step.
              </p>
            </div>
            <Field
              label="Review note"
              hint="Required. Saved with your name and review date."
            >
              <textarea
                ref={noteField}
                required
                rows={4}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Observations and agreed next steps…"
              />
            </Field>

            {plannedAppointments.length > 0 && (
              <div
                style={{
                  background: "var(--surface-subtle)",
                  border: "1px solid var(--control-border)",
                  borderRadius: "8px",
                  padding: "16px",
                  marginTop: "16px",
                  marginBottom: "16px",
                }}
                aria-label="Associated contact outcome"
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    marginBottom: "6px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Calendar size={18} style={{ color: "var(--category-assessment-ink)" }} />
                    <strong style={{ fontSize: "0.95rem", color: "var(--ink)" }}>
                      Associated contact outcome
                    </strong>
                  </div>
                  <Badge>
                    {activeAppointment?.attendance === "Planned"
                      ? "Outcome pending"
                      : activeAppointment?.attendance}
                  </Badge>
                </div>
                <p
                  style={{
                    margin: "0 0 12px 0",
                    fontSize: "0.83rem",
                    color: "var(--muted)",
                  }}
                >
                  Capture the service contact outcome alongside your clinical
                  assessment review.
                </p>

                {plannedAppointments.length > 1 && (
                  <Field label="Associated planned contact">
                    <select
                      value={selectedAppointmentId}
                      onChange={(ev) => {
                        const id = ev.target.value;
                        setSelectedAppointmentId(id);
                        const found = plannedAppointments.find(
                          (a) => a.id === id,
                        );
                        if (found) {
                          setActualTime(found.plannedTime || "10:00");
                          setActualDuration(found.plannedDurationMinutes || 60);
                          if (found.plannedDate)
                            setActualDate(found.plannedDate);
                        }
                      }}
                    >
                      {plannedAppointments.map((appt) => (
                        <option key={appt.id} value={appt.id}>
                          {formatDate(appt.plannedDate)} at {appt.plannedTime} ·{" "}
                          {appt.practitionerService} ({appt.deliveryMode})
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                {activeAppointment && (
                  <div>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        marginBottom: "12px",
                        padding: "8px 12px",
                        background: "var(--surface)",
                        borderRadius: "6px",
                        border: "1px solid var(--line)",
                        color: "var(--ink-soft)",
                      }}
                    >
                      <strong>Planned:</strong>{" "}
                      {formatDate(activeAppointment.plannedDate)} at{" "}
                      {activeAppointment.plannedTime} (
                      {activeAppointment.plannedDurationMinutes} min) ·{" "}
                      {activeAppointment.practitionerService} ·{" "}
                      {activeAppointment.deliveryMode}
                    </div>

                    <div className="form-grid" style={{ marginBottom: "12px" }}>
                      <Field label="Contact outcome">
                        <select
                          value={appointmentAttendance}
                          onChange={(ev) =>
                            setAppointmentAttendance(ev.target.value)
                          }
                        >
                          <option value="Attended">
                            Attended (Contact completed)
                          </option>
                          <option value="Did not attend">
                            Did not attend
                          </option>
                          <option value="Cancelled">Cancelled</option>
                          <option value="Planned">
                            Leave as planned (record later)
                          </option>
                        </select>
                      </Field>

                      {appointmentAttendance === "Attended" && (
                        <>
                          <Field label="Actual contact date">
                            <input
                              type="date"
                              min={episode.start}
                              max={actualLatestDate}
                              value={actualDate}
                              onChange={(ev) => setActualDate(ev.target.value)}
                              required
                            />
                          </Field>
                          <Field label="Actual time">
                            <input
                              type="time"
                              value={actualTime}
                              onChange={(ev) => setActualTime(ev.target.value)}
                              required
                            />
                          </Field>
                          <Field label="Actual duration (min)">
                            <input
                              type="number"
                              min="1"
                              max="600"
                              value={actualDuration}
                              onChange={(ev) =>
                                setActualDuration(ev.target.value)
                              }
                              required
                            />
                          </Field>
                        </>
                      )}
                    </div>

                    {appointmentAttendance !== "Planned" && (
                      <Field label="Contact outcome notes (optional)">
                        <input
                          type="text"
                          value={outcomeNotes}
                          onChange={(ev) => setOutcomeNotes(ev.target.value)}
                          placeholder="Factual notes regarding the contact or outcome…"
                        />
                      </Field>
                    )}
                  </div>
                )}
              </div>
            )}

            {sameDayRecordedAppointments.length > 0 && (
              <div
                style={{
                  background: "var(--status-success-bg)",
                  border: "1px solid var(--status-success-border)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  margin: "12px 0",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "var(--status-success-ink)",
                }}
              >
                <CheckCircle2
                  size={16}
                  style={{ color: "var(--status-success-mark)", flexShrink: 0 }}
                />
                <span>
                  <strong>
                    Recorded contact on {formatDate(assessmentDate)}:
                  </strong>{" "}
                  {sameDayRecordedAppointments
                    .map(
                      (a) =>
                        `${a.attendance} (${a.actualDate || a.plannedDate} at ${a.actualTime || a.plannedTime}) · ${a.practitionerService}`,
                    )
                    .join("; ")}
                </span>
              </div>
            )}

            <label className="check-field">
              <input
                type="checkbox"
                required
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>I have reviewed these answers and their source.</span>
            </label>
            <p className="response-footnote">
              {draftError
                ? "Draft storage is unavailable. Keep this dialog open until you save your review."
                : "Draft kept in this browser tab until you save or discard it. It is not part of the saved clinical record."}
            </p>
          </section>
        )}
        {c.reviewHistory?.length > 0 && (
          <details className="response-disclosure">
            <summary>
              <span>
                Earlier clinical reviews <small>{c.reviewHistory.length}</small>
              </span>
              <ChevronDown size={17} aria-hidden="true" />
            </summary>
            <div className="previous-reviews">
              {[...c.reviewHistory].reverse().map((review, index) => (
                <article key={index}>
                  <strong>
                    {review.actor || "Reviewer not recorded"}
                    {review.date && ` · ${formatDate(review.date)}`}
                  </strong>
                  <p>{review.note}</p>
                  <small>Answer revision {review.revision}</small>
                </article>
              ))}
            </div>
          </details>
        )}
        <ResponseHistory person={person} collection={c} />
      </div>
      <div className="modal-footer response-dialog-footer">
        <p className="response-footer-note">
          {reviewNotRequired
            ? "No separate clinical review required · Answers remain available above"
            : canReview
              ? "Review stays separate from assessment completion."
              : reviewed && !c.needsReview
                ? "Saved review · Answers remain available above"
                : "Awaiting a clinician’s review."}
        </p>
        <Button type="button" onClick={requestClose}>
          {canReview ? "Cancel" : "Close"}
        </Button>
        {canReview && (
          <Button
            type="submit"
            variant="primary"
            disabled={!note.trim() || !confirmed}
          >
            Save review
          </Button>
        )}
      </div>
    </ValidatedForm>
  );

  const discardPrompt = discard && (
    <DiscardChanges
      onKeepEditing={keepEditing}
      onDiscard={() => {
        clearDraft();
        onClose();
      }}
    />
  );

  if (fullPage)
    return (
      <section className="assessment-review-record">
        <header className="assessment-review-header">
          <div>
            <button className="back-link" type="button" onClick={requestClose}>
              <ArrowLeft size={17} aria-hidden="true" />
              Back to Assessment
            </button>
            <h1>{title}</h1>
            <p>{`${displayPersonName(person)} · ${c.label} · ${c.version}`}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {canEdit && onEdit && (
              <Button type="button" onClick={() => onEdit(note)}>
                <Pencil size={16} aria-hidden="true" />
                Edit answers
              </Button>
            )}
            <Badge>{clinicalReviewStatus(c)}</Badge>
          </div>
        </header>
        <div className="assessment-review-surface">
          {record}
          {discardPrompt}
        </div>
      </section>
    );

  return (
    <Modal
      title={title}
      subtitle={`${displayPersonName(person)} · ${c.label} · ${c.version}`}
      onClose={requestClose}
      wide
      className="response-dialog"
    >
      {record}
      {discardPrompt}
    </Modal>
  );
}
