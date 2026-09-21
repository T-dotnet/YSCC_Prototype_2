import { useEffect, useState } from "react";
import { useStore } from "../store";
import { canAssess } from "../intake";
import { collectionActor, currentStaff } from "../model";
import { getInstrument } from "../instruments";
import { Modal, Button, Notice, Success } from "./UI";
import QuestionnaireFlow from "./QuestionnaireFlow";
import DiscardChanges from "./DiscardChanges";

export default function ClinicianQuestionnaire({
  person,
  episode,
  collection,
  onClose,
}) {
  const { state, commit } = useStore();
  const [answers, setAnswers] = useState([]);
  const [discard, setDiscard] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");
  // Pin this form to the attempt that opened it. Reissued sessions cannot
  // silently submit answers against a different respondent or recorder.
  const [attemptId] = useState(collection.attempts.at(-1)?.id);
  const c = collection;
  const staff = currentStaff(state);
  const instrument = getInstrument(c.version);
  const available =
    canAssess(person, episode) &&
    episode.status === "Active" &&
    c.response !== "Submitted" &&
    c.assignment === "Active" &&
    c.link === "Active" &&
    c.channel === "Clinician entry" &&
    staff?.role === "Clinician" &&
    c.recorderId === staff.id &&
    c.attempts.at(-1)?.id === attemptId &&
    !!instrument;
  const dirty = answers.some(Boolean) && !finished;
  const respondent = collectionActor(person, c, "respondent");
  const requestClose = () => (dirty ? setDiscard(true) : onClose());

  useEffect(() => {
    if (!dirty) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const submit = (finalAnswers) => {
    if (!available) return;
    const result = commit({
      type: "SUBMIT",
      personId: person.id,
      episodeId: episode.id,
      collectionId: c.id,
      channel: "Clinician entry",
      attemptId,
      answers: finalAnswers,
    });
    if (result.error) {
      setError(result.error);
      return;
    }
    setError("");
    setFinished(true);
    setAnswers([]);
  };

  return (
    <Modal
      title={
        finished
          ? "Questionnaire submitted"
          : "Complete questionnaire as clinician"
      }
      subtitle={`${person.name} · ${c.label} · ${c.version}`}
      onClose={requestClose}
      wide
    >
      <div className="form-body">
        {finished ? (
          <Success
            title="Response saved"
            action={
              <Button variant="primary" onClick={onClose}>
                  Back to record
              </Button>
            }
          >
            {respondent}’s answers were recorded by {c.recorderName}. No
            separate clinical review is required.
          </Success>
        ) : (
          <>
            <section
              className="setup-summary"
              aria-label="Answer source and recorder"
            >
              <dl className="metadata">
                <div>
                  <dt>Answers supplied by</dt>
                  <dd>{respondent}</dd>
                </div>
                <div>
                  <dt>Recorded by</dt>
                  <dd>{c.recorderName} · Clinician</dd>
                </div>
                <div>
                  <dt>Completion method</dt>
                  <dd>{c.assistance}</dd>
                </div>
              </dl>
            </section>
            <Notice>
              Enter {respondent}’s answers using the questionnaire wording
              below. Review them before submitting. Unsaved answers are cleared
              when you leave or refresh.
            </Notice>
            {!available ? (
              <Notice tone="amber">
                This collection is no longer available for clinician completion.
                Close it and check the assessment record.
              </Notice>
            ) : (
              <div hidden={discard}>
                <QuestionnaireFlow
                  instrument={instrument}
                  respondent={c.respondent}
                  answers={answers}
                  onChange={(value) => {
                    setAnswers(value);
                    setError("");
                  }}
                  onSubmit={submit}
                  headingLevel="h3"
                  clinicianEntry
                />
              </div>
            )}
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </div>
      {discard ? (
        <DiscardChanges
          onKeepEditing={() => setDiscard(false)}
          onDiscard={onClose}
        />
      ) : (
        !finished && (
          <div className="modal-footer">
            <Button onClick={requestClose}>Cancel</Button>
          </div>
        )
      )}
    </Modal>
  );
}
