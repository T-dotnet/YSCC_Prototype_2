import { useState } from "react";
import { Eye, RotateCcw } from "lucide-react";
import { Button, Notice } from "./UI";
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
  const reset = () => {
    setAnswers([]);
    setFinished(false);
    setRun((value) => value + 1);
  };
  const footer = (
    <div className="modal-footer preview-footer">
      {backLabel && (
        <Button type="button" onClick={onBack}>
          {backLabel}
        </Button>
      )}
      <Button type="button" variant="primary" onClick={onBack}>
        Done previewing
      </Button>
    </div>
  );
  if (!instrument)
    return (
      <>
        <div className="form-body">
          <Notice>
            This questionnaire version is unavailable in the workspace.
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
          <Button type="button" onClick={reset}>
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
              <Button type="button" onClick={reset}>
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
                        <ul className="preview-answer-options">
                          {question.options.map((option) => (
                            <li key={option}>{option}</li>
                          ))}
                        </ul>
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
    </>
  );
}
