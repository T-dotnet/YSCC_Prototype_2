import { canAssess } from "../intake";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  Check,
  HeartHandshake,
  Clock3,
  ShieldCheck,
  LifeBuoy,
} from "lucide-react";
import { useStore } from "../store";
import { displayFamilyName, displayPersonName } from "../model";
import {
  DEMO_INSTRUMENT,
  getInstrument,
  questionnaireState,
} from "../instruments";
import QuestionnaireFlow from "../components/QuestionnaireFlow";
import { Logo, Button, Success, Modal, Notice } from "../components/UI";
export default function Questionnaire({ session, navigate, onEnd }) {
  const { state, commit, storageError } = useStore();
  const p = state.people.find((p) => p.id === session?.personId),
    e = p?.episodes.find((e) => e.id === session?.episodeId),
    c = e?.collections.find((c) => c.id === session?.collectionId);
  const [step, setStep] = useState(-1),
    [answers, setAnswers] = useState([]),
    [help, setHelp] = useState(false),
    [finished, setFinished] = useState(false),
    [ended, setEnded] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const answeredCount = answers.filter(Boolean).length;
  const instrument = session ? getInstrument(c?.version) : DEMO_INSTRUMENT;
  const preview = !session,
    unavailable =
      !preview &&
      (!canAssess(p, e) ||
        !c ||
        !instrument ||
        c.channel === "Clinician entry" ||
        c.assignment !== "Active" ||
        c.link !== "Active" ||
        (session.attemptId && session.attemptId !== c.attempts.at(-1)?.id) ||
        e.status !== "Active" ||
        ["Revoked", "Expired"].includes(c.link) ||
        c.response === "Submitted");
  const end = () => {
    setAnswers([]);
    setEnded(true);
    onEnd();
  };
  const requestEnd = () =>
    answers.some(Boolean) && !finished ? setConfirmLeave(true) : end();
  const submit = (finalAnswers) => {
    if (!questionnaireState(instrument, finalAnswers).complete || unavailable)
      return;
    if (session) {
      const result = commit({
        ...session,
        type: "SUBMIT",
        answers: finalAnswers,
      });
      if (result.error) {
        setSubmitError(result.error);
        return;
      }
    }
    setSubmitError("");
    setFinished(true);
    setStep(4);
  };
  useEffect(() => {
    document.querySelector(".questionnaire h1")?.focus();
  }, [step, ended, finished, unavailable]);
  useEffect(() => {
    if (!answeredCount || finished || ended) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [answeredCount, finished, ended]);
  return (
    <div className="participant">
      <header className="participant-header">
        <Logo />
        <span>
          {preview
            ? "Sample questionnaire · practice only"
            : "Questionnaire · sample content"}
        </span>
      </header>
      <main className="questionnaire">
        {ended ? (
          <Success
            heading="h1"
            title="This session has ended"
            action={
              <Button
                variant="primary"
                onClick={() =>
                  navigate(
                    session?.personId ? `/people/${session.personId}` : "/",
                  )
                }
              >
                Return to staff demo
                <ArrowRight size={18} />
              </Button>
            }
          >
            The participant view has been cleared. In a live service, staff
            would sign in again before opening the workspace.
          </Success>
        ) : finished ? (
          <Success
            heading="h1"
            title={
              preview
                ? "Practice complete. Thank you."
                : "Thank you. Your response is received."
            }
            action={
              <Button variant="primary" onClick={end}>
                End session
                <Check size={18} />
              </Button>
            }
          >
            {storageError
              ? "Your sample response is held in this open tab; browser storage is unavailable."
              : preview
                ? "You’ve completed the sample questionnaire. This preview is separate from a care record."
                : "Your sample answers have been added to the record for the care team to review."}{" "}
            This does not mean that a clinical review has taken place.
          </Success>
        ) : unavailable ? (
          <Success
            heading="h1"
            title="This request is unavailable"
            action={
              <Button variant="primary" onClick={end}>
                End session
              </Button>
            }
          >
            This sample link may have ended, expired, or already been completed.
            Ask the care team for the appropriate next step.
          </Success>
        ) : (
          <>
            {step === -1 ? (
              <>
                <span className="participant-symbol">
                  <HeartHandshake size={35} />
                </span>
                <h1 tabIndex={-1}>
                  {session?.respondent === "Family respondent"
                    ? "Your perspective matters."
                    : "A little check-in, at your pace."}
                </h1>
                <p className="intro-copy">
                  {session?.respondent === "Family respondent"
                    ? "Share your own experience as a family respondent. Your answers are a separate contribution."
                    : instrument.introduction ||
                      `Your care team would like to hear your perspective. ${instrument.description}`}
                </p>
                <div className="request-facts">
                  <span>
                    <Clock3 size={20} />
                    <strong>
                      Up to {instrument.questions.length} questions ·{" "}
                      {instrument.sections.length} sections
                    </strong>
                  </span>
                  <span>
                    <ShieldCheck size={20} />
                    <strong>
                      {session?.channel === "Clinician entry"
                        ? "Recorded with staff"
                        : "No account needed"}
                    </strong>
                  </span>
                </div>
                <div className="participant-info">
                  <h2>Before you begin</h2>
                  <p>
                    <strong>
                      {preview
                        ? "Practice questionnaire"
                        : "Requested by Northside Centre"}
                    </strong>
                    {p
                      ? ` · ${session?.respondent === "Family respondent" ? displayFamilyName(p) : displayPersonName(p)} · ${session?.respondent === "Family respondent" ? "family contribution" : "own answers"}`
                      : " · no care record is updated"}
                  </p>
                  {instrument.timeframe && (
                    <p>
                      <strong>Questions cover:</strong> {instrument.timeframe}
                    </p>
                  )}
                  <ul>
                    <li>Use sample answers only.</li>
                    <li>
                      {preview
                        ? "This preview does not update a person’s care record."
                        : "Answers in this demo are visible to the sample care team in this browser."}
                    </li>
                    <li>
                      You can choose “Prefer not to answer” for any question.
                    </li>
                    <li>
                      Questions adapt to your answers. Work through one question
                      at a time, jump between sections, and review before
                      submitting.
                    </li>
                    <li>
                      Leaving or refreshing before submitting clears your
                      answers. This sample has no save-and-resume feature.
                    </li>
                    <li>
                      You can ask someone supporting you for help. This demo is
                      not monitored and no live support service is connected.
                    </li>
                  </ul>
                </div>
                <Button
                  variant="primary"
                  className="participant-next"
                  onClick={() => setStep(0)}
                >
                  Begin questionnaire
                  <ArrowRight size={20} />
                </Button>
                <p className="privacy-copy">
                  These are demonstration questions, not a clinical assessment.
                </p>
              </>
            ) : (
              <QuestionnaireFlow
                instrument={instrument}
                respondent={session?.respondent}
                answers={answers}
                onChange={setAnswers}
                onSubmit={submit}
                preview={preview}
                headingLevel="h1"
              />
            )}
            <div className="participant-help">
              <button onClick={() => setHelp(true)}>
                <LifeBuoy size={18} />
                Need help or a break?
              </button>
              <button onClick={requestEnd}>Leave questionnaire</button>
            </div>
            {submitError && (
              <p className="field-error" role="alert">
                {submitError}
              </p>
            )}
          </>
        )}
      </main>
      <footer className="participant-footer">YSCC · Care, connected</footer>
      {confirmLeave && (
        <Modal
          title="Leave and clear your answers?"
          onClose={() => setConfirmLeave(false)}
        >
          <div className="form-body">
            <p>
              Your answers have not been submitted. Leaving clears this sample
              session; you cannot resume it later.
            </p>
          </div>
          <div className="modal-footer">
            <Button variant="primary" onClick={() => setConfirmLeave(false)}>
              Keep answering
            </Button>
            <Button
              onClick={() => {
                setConfirmLeave(false);
                end();
              }}
            >
              Leave and clear answers
            </Button>
          </div>
        </Modal>
      )}
      {help && (
        <Modal title="Take the time you need" onClose={() => setHelp(false)}>
          <div className="form-body">
            <p>
              You can ask the person supporting you to explain a question, or
              contact your care team through your usual service contact.
            </p>
            <Notice>
              This demonstration is not monitored. No live care or support
              service is connected.
            </Notice>
            <p>
              If you leave before submitting, the answers in this sample session
              will be discarded.
            </p>
            <div className="actions">
              <Button onClick={() => setHelp(false)}>
                Continue questionnaire
              </Button>
              <Button
                onClick={() => {
                  setHelp(false);
                  requestEnd();
                }}
              >
                End this session
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
