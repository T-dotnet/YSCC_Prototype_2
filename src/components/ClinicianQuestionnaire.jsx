import { useEffect, useState } from "react";
import { useStore } from "../store";
import { canAssess } from "../intake";
import { collectionActor, currentStaff, formatDate } from "../model";
import { getInstrument } from "../instruments";
import { Modal, Button, Notice, Success } from "./UI";
import QuestionnaireFlow from "./QuestionnaireFlow";
import QuestionnaireAppointmentConfirmation from "./QuestionnaireAppointmentConfirmation";
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
  const [pendingAnswers, setPendingAnswers] = useState(null);
  const [returnToReview, setReturnToReview] = useState(false);
  // Pin this form to the attempt that opened it. Reissued sessions cannot
  // silently submit answers against a different respondent or recorder.
  const [attemptId] = useState(collection.attempts.at(-1)?.id);
  const c = collection;
  const staff = currentStaff(state);
  const instrument = getInstrument(c.version);
  const linkedAppointmentId =
    c.appointmentId || c.attempts.at(-1)?.appointmentId;
  const linkedAppointment = episode.appointments?.find(
    (item) => item.id === linkedAppointmentId && item.attendance === "Planned",
  );
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

  const submit = (finalAnswers, confirmation) => {
    if (!available) return;
    const result = commit({
      type: "SUBMIT",
      personId: person.id,
      episodeId: episode.id,
      collectionId: c.id,
      channel: "Clinician entry",
      attemptId,
      answers: finalAnswers,
      ...(confirmation || {}),
    });
    if (result.error) {
      setError(result.error);
      return;
    }
    setError("");
    setFinished(true);
    setAnswers([]);
  };
  const completeQuestions = (finalAnswers) => {
    setPendingAnswers(finalAnswers);
    setError("");
  };

  return (
    <Modal
      title={
        finished
          ? "Questionnaire submitted"
          : pendingAnswers
            ? "Completion details"
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
            {respondent}’s answers were recorded by {c.recorderName}.{" "}
            {c.review === "Not required"
              ? "No separate clinical review is required."
              : "Clinical review is pending."}
          </Success>
        ) : (
          <>
            {!pendingAnswers && (
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
            )}
            {!pendingAnswers && (
              <Notice>
                Enter {respondent}’s answers using the questionnaire wording
                below. Review them before submitting. Unsaved answers are
                cleared when you leave or refresh.
              </Notice>
            )}
            {!available ? (
              <Notice tone="amber">
                This collection is no longer available for clinician completion.
                Close it and check the assessment record.
              </Notice>
            ) : (
              <div hidden={discard}>
                {pendingAnswers ? (
                  <QuestionnaireAppointmentConfirmation
                    appointment={linkedAppointment}
                    collection={c}
                    episode={episode}
                    error={error}
                    onBack={() => {
                      setReturnToReview(true);
                      setPendingAnswers(null);
                      setError("");
                    }}
                    onConfirm={(confirmation) => submit(pendingAnswers, confirmation)}
                  />
                ) : (
                  <QuestionnaireFlow
                    instrument={instrument}
                    respondent={c.respondent}
                    answers={answers}
                    onChange={(value) => {
                      setAnswers(value);
                      setError("");
                    }}
                    onSubmit={completeQuestions}
                    submitLabel="Continue to completion details"
                    completionNote={
                      linkedAppointment
                        ? `Next, review the linked appointment on ${formatDate(linkedAppointment.plannedDate)} at ${linkedAppointment.plannedTime}, confirm the collection method and record its outcome. Your answers have not been submitted yet.`
                        : "Next, confirm whether the answers were completed on a tablet or by a clinician. Your answers have not been submitted yet."
                    }
                    initialReview={returnToReview}
                    headingLevel="h3"
                    clinicianEntry
                  />
                )}
              </div>
            )}
            {error && !pendingAnswers && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </div>
      {discard && (
        <DiscardChanges
          onKeepEditing={() => setDiscard(false)}
          onDiscard={onClose}
        />
      )}
    </Modal>
  );
}
