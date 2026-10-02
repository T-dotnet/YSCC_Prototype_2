import { useState } from "react";
import { Eye, RotateCcw } from "lucide-react";
import { ActionGroup, Button, Modal, Notice } from "./UI";
import QuestionnaireFlow from "./QuestionnaireFlow";
import {
  describeRule,
  questionTitle,
  questionnaireState,
} from "../instruments";

export default function InstrumentPreview({
  instrument,
  respondent,
  onBack,
  backLabel,
}) {
  const [mode, setMode] = useState("path");
  const [answers, setAnswers] = useState([]);
  const [run, setRun] = useState(0);
  const [finished, setFinished] = useState(false);
  const [search, setSearch] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const reset = () => {
    setAnswers([]);
    setFinished(false);
    setRun((value) => value + 1);
    setConfirmReset(false);
  };
  const footer = (
    <ActionGroup className="modal-footer preview-footer">
      {backLabel && (
        <Button type="button" onClick={onBack}>
          {backLabel}
        </Button>
      )}
      <Button type="button" variant="primary" onClick={onBack}>
        Done previewing
      </Button>
    </ActionGroup>
  );
  if (!instrument)
    return (
      <>
        <div className="form-body">
          <Notice>
            This instrument version is unavailable in the workspace.
          </Notice>
        </div>
        {footer}
      </>
    );
  return (
    <>
      <div className="questionnaire-preview-body">
        <div className="preview-context">
          <Eye size={18} aria-hidden="true" />
          <p>
            Practice only. Try answers to explore different paths. Nothing is
            saved to a care record.
          </p>
        </div>
        <div className="preview-mode" role="group" aria-label="Preview mode">
          <Button
            type="button"
            aria-pressed={mode === "path"}
            onClick={() => setMode("path")}
          >
            Try a path
          </Button>
          <Button
            type="button"
            aria-pressed={mode === "all"}
            onClick={() => setMode("all")}
          >
            All questions ({instrument.questions.length})
          </Button>
          <Button type="button" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={15} />
            Reset answers
          </Button>
        </div>
        {mode === "path" ? (
          finished ? (
            <div className="practice-complete">
              <h3>Practice complete</h3>
              <p>
                {questionnaireState(instrument, answers).answered} questions
                answered on this path. No response was submitted.
              </p>
              <Button type="button" onClick={() => setConfirmReset(true)}>
                Try another path
              </Button>
            </div>
          ) : (
            <QuestionnaireFlow
              key={run}
              instrument={instrument}
              respondent={respondent}
              answers={answers}
              onChange={setAnswers}
              onSubmit={() => setFinished(true)}
              preview
            />
          )
        ) : (
          <>
            <label className="catalogue-search">
              Find a question
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search all questions"
              />
            </label>
            <p className="muted">
              All possible questions, including conditional follow-ups. Open a
              section to inspect its rules and answer options.
            </p>
            {instrument.sections.map((section) => {
              const questions = instrument.questions.filter(
                (question) =>
                  question.section === section.id &&
                  questionTitle(question, respondent)
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              );
              return (
                questions.length > 0 && (
                  <details
                    className="question-section"
                    key={`${section.id}-${!!search}`}
                    open={search ? true : undefined}
                  >
                    <summary>
                      {section.title}
                      <span>{questions.length} questions</span>
                    </summary>
                    {questions.map((question) => (
                      <article className="catalogue-question" key={question.id}>
                        <h4>{questionTitle(question, respondent)}</h4>
                        <p className="branch-rule">
                          <strong>{question.when ? "Shown when: " : ""}</strong>
                          {describeRule(instrument, question.when, respondent)}
                        </p>
                        <p className="muted">{question.hint}</p>
                        {question.scale && (
                          <p className="scale-summary">
                            <strong>{question.scale.label}:</strong>{" "}
                            {question.scale.instruction}
                          </p>
                        )}
                        {question.responseType === 'number' || question.responseType === 'date' || question.responseType === 'text'
                          ? <p className="muted">{question.responseType === 'number'
                            ? `Whole number${question.min != null && question.max != null ? ` (${question.min}–${question.max})` : ''}`
                            : question.responseType === 'date' ? 'Date' : 'Text response'}</p>
                          : <ul className="preview-answer-options">
                            {question.options.map((option) => <li key={option}>{option}</li>)}
                          </ul>}
                      </article>
                    ))}
                  </details>
                )
              );
            })}
            {!instrument.questions.some((question) =>
              questionTitle(question, respondent)
                .toLowerCase()
                .includes(search.toLowerCase()),
            ) && <p>No questions match your search.</p>}
          </>
        )}
      </div>
      {footer}
      {confirmReset && <Modal title="Reset preview answers?" onClose={() => setConfirmReset(false)}>
        <div className="form-body"><p>Your practice answers for this instrument will be cleared.</p></div>
        <ActionGroup className="modal-footer">
          <Button type="button" onClick={() => setConfirmReset(false)}>Cancel</Button>
          <Button type="button" variant="primary" onClick={reset}>Reset answers</Button>
        </ActionGroup>
      </Modal>}
    </>
  );
}
