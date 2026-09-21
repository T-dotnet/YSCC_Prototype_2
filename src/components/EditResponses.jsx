import useDraft from "../useDraft";
import { useRef, useState } from "react";
import { Pencil, ArrowLeft } from "lucide-react";
import { useStore } from "../store";
import { currentStaff, displayPersonName, responseEditError } from "../model";
import { Modal, Button, Field, Notice, ValidatedForm } from "./UI";
import SubmittedAnswers from "./SubmittedAnswers";
import DiscardChanges from "./DiscardChanges";

export default function EditResponses({
  person,
  episode,
  collection,
  onClose,
  notify,
}) {
  const { state, dispatch } = useStore();
  const [draft, setDraft, clearDraft, draftError] = useDraft(
    `answers:${collection.id}:${collection.version}:${currentStaff(state)?.id}`,
    {
      originalAnswers: [...(collection.answers || [])],
      answers: [...(collection.answers || [])],
      expectedRevision: collection.revision ?? 0,
      reason: "",
      source: "",
    },
  );
  const { originalAnswers, answers, expectedRevision, reason, source } = draft;
  const update = (key, value) =>
    setDraft((draft) => ({ ...draft, [key]: value }));
  const setAnswers = (value) => update("answers", value);
  const setReason = (value) => update("reason", value);
  const setSource = (value) => update("source", value);
  const [error, setError] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);
  const [discard, setDiscard] = useState(false);
  const reasonField = useRef(null);
  const returnFocus = useRef(null);
  const staff = currentStaff(state);
  const changedCount = answers.filter(
    (answer, index) => answer !== originalAnswers[index],
  ).length;
  const dirty = changedCount > 0 || !!reason.trim() || !!source.trim();
  const conflict = expectedRevision !== (collection.revision ?? 0);
  const missingReason = reasonTouched && !reason.trim();
  const requestClose = () => {
    if (!dirty) {
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
  const changeLabel = `${changedCount} ${changedCount === 1 ? "answer" : "answers"} changed`;

  return (
    <Modal
      title="Edit answers"
      subtitle={`${displayPersonName(person)} · ${collection.label} · ${collection.version}`}
      onClose={requestClose}
      wide
      className="response-dialog"
    >
      <ValidatedForm
        hidden={discard}
        onSubmit={(event) => {
          event.preventDefault();
          const action = {
            type: "EDIT_RESPONSE",
            personId: person.id,
            episodeId: episode.id,
            collectionId: collection.id,
            expectedRevision,
            answers,
            reason,
            source,
          };
          const problem = responseEditError(state, action);
          if (problem) {
            setError(problem);
            return;
          }
          dispatch(action);
          clearDraft();
          onClose();
          notify(
            `${changedCount === 1 ? "Answer change" : "Answer changes"} saved. ${collection.review === "Reviewed" ? "A new clinical review is required." : "The changes are recorded in history."}`,
          );
        }}
      >
        <div className="response-dialog-body">
          <div className="edit-introduction">
            <span className="edit-mode-icon">
              <Pencil size={20} aria-hidden="true" />
            </span>
            <div>
              <h3>Update the answers that need correcting</h3>
              <p>
                Editing as {staff?.name}. Your changes and reason will be saved
                in history.
              </p>
            </div>
          </div>
          {collection.review === "Reviewed" && (
            <Notice tone="amber">
              Saving changes will request a new clinical review. The earlier
              review will stay in the record.
            </Notice>
          )}
          {conflict && (
            <div role="alert" className="error-banner">
              These answers were updated while you were editing. Return to the
              review and reopen the editor to see the latest answers.
            </div>
          )}
          <SubmittedAnswers
            person={person}
            collection={{ ...collection, answers }}
            originalAnswers={originalAnswers}
            onAnswersChange={setAnswers}
            disabled={conflict}
          />
          <section
            className="edit-reason-section"
            aria-label="Reason for changes"
          >
            <div className="response-section-heading">
              <div>
                <h3>Reason for changes</h3>
                <p className="muted">
                  Help the care team understand this correction.
                </p>
              </div>
            </div>
            <Field
              label="Why are you changing these answers?"
              hint="Required. Original answers and earlier reviews stay in the record."
            >
              <textarea
                ref={reasonField}
                required
                rows={3}
                value={reason}
                aria-invalid={missingReason || undefined}
                aria-describedby={
                  missingReason ? "edit-reason-error" : undefined
                }
                onBlur={() => setReasonTouched(true)}
                onChange={(event) => setReason(event.target.value)}
                placeholder="For example, correcting a transcription from the session notes…"
              />
            </Field>
            {missingReason && (
              <p id="edit-reason-error" className="field-error" role="alert">
                Add a reason before saving your changes.
              </p>
            )}
            <Field label="Source or reference (optional)">
              <input
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="For example, a session note or confirmed correction"
              />
            </Field>
          </section>
          <p className="response-footnote">
            {draftError
              ? "Draft storage is unavailable. Save before leaving this dialog."
              : "Unsaved changes are kept in this browser tab until you save or discard them."}
          </p>
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="modal-footer response-dialog-footer">
          <div className="edit-save-status">
            <strong role="status">
              {changedCount ? changeLabel : "No changes yet"}
            </strong>
            {changedCount > 0 && !reason.trim() && (
              <button
                className="inline-link"
                type="button"
                onClick={() => reasonField.current?.focus()}
              >
                Add a reason to save
              </button>
            )}
          </div>
          <Button type="button" onClick={requestClose}>
            <ArrowLeft size={16} aria-hidden="true" />
            Back to review
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!changedCount || !reason.trim() || conflict}
          >
            Save changes
          </Button>
        </div>
      </ValidatedForm>
      {discard && (
        <DiscardChanges
          onKeepEditing={keepEditing}
          onDiscard={() => {
            clearDraft();
            onClose();
          }}
        />
      )}
    </Modal>
  );
}
