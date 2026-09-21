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
} from "../model";
import { Modal, Button, Badge, Field, Notice, ValidatedForm } from "./UI";
import SubmittedAnswers from "./SubmittedAnswers";
import ResponseHistory from "./ResponseHistory";
import DiscardChanges from "./DiscardChanges";

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
  const reviewNotRequired = noClinicalReviewRequired(c);
  const reviewed = c.review === "Reviewed" || reviewNotRequired;
  const canReview =
    currentStaff(state)?.role === "Clinician" &&
    c.response === "Submitted" &&
    !reviewNotRequired &&
    (!reviewed || c.needsReview);
  const canEdit =
    canEditResponses(state) &&
    !!getInstrument(c.version) &&
    c.response === "Submitted";
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
          "Clinical review saved. Assessment completion remains a separate care decision.",
        );
      }}
    >
      <div className="response-dialog-body">
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
                  ? `${c.channel}${c.assistance ? ` · ${c.assistance}` : ""}`
                  : c.reviewNote || "No review note recorded."}
              </p>
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
            <span>Answer source</span>
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
            <div>
              <dt>Collection method</dt>
              <dd>{c.channel || "Not recorded"}</dd>
            </div>
            <div>
              <dt>Assistance</dt>
              <dd>{c.assistance || "Not recorded"}</dd>
            </div>
          </dl>
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
          <Badge>{clinicalReviewStatus(c)}</Badge>
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
