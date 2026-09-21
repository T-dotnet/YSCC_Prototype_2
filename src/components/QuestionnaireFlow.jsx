import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ListChecks } from "lucide-react";
import {
  questionnaireState,
  questionTitle,
  setQuestionAnswer,
} from "../instruments";
import { Button, Notice } from "./UI";

export default function QuestionnaireFlow({
  instrument,
  respondent,
  answers,
  onChange,
  onSubmit,
  preview = false,
  headingLevel,
  clinicianEntry = false,
}) {
  const path = questionnaireState(instrument, answers);
  const [currentId, setCurrentId] = useState(instrument.questions[0].id);
  const [review, setReview] = useState(false);
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [branchMessage, setBranchMessage] = useState("");
  const heading = useRef(null);
  const id = useId();
  const current =
    path.visible.find((entry) => entry.question.id === currentId) ||
    path.missing[0] ||
    path.visible[0];
  const position = path.visible.indexOf(current);
  const section = path.sections.find((s) => s.id === current?.question.section);
  const scale = current?.question.scale;
  const scaleOptions = scale?.options || [];
  const nonResponseOptions = scale
    ? current.question.options.filter(
        (option) => !scaleOptions.includes(option),
      )
    : [];
  const Heading = headingLevel || (preview ? "h3" : "h1");
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "nearest" });
  }, [current?.question.id, review]);
  const choose = (value) => {
    const next = setQuestionAnswer(instrument, answers, current.index, value);
    const nextPath = questionnaireState(instrument, next);
    const removed = path.visible.filter(
      (entry) =>
        entry.answer &&
        !nextPath.visible.some(
          (nextEntry) => nextEntry.question.id === entry.question.id,
        ),
    ).length;
    const added =
      nextPath.total -
      path.total +
      path.visible.filter(
        (entry) =>
          !nextPath.visible.some(
            (nextEntry) => nextEntry.question.id === entry.question.id,
          ),
      ).length;
    setBranchMessage(
      removed
        ? `${removed} previous ${removed === 1 ? "answer no longer applies and has" : "answers no longer apply and have"} been cleared. Check your updated questions.`
        : added
          ? `${added} follow-up ${added === 1 ? "question added" : "questions added"} based on this answer.`
          : nextPath.total !== path.total
            ? "Your question path has been updated."
            : "",
    );
    onChange(next);
  };
  const go = (entry) => {
    setCurrentId(entry.question.id);
    setReview(false);
  };
  const edit = (entry) => {
    setEditing(true);
    go(entry);
  };
  return (
    <div className="adaptive-flow">
      <div className="adaptive-progress">
        <div className="question-progress">
          <strong>
            {path.answered} of {path.total} answered
          </strong>
          <span>{path.percent}% of current path</span>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-label="Questions answered on current path"
          aria-valuemin={0}
          aria-valuemax={path.total}
          aria-valuenow={path.answered}
        >
          <span style={{ width: `${path.percent}%` }} />
        </div>
        <p className="muted">
          Questions and progress adjust to your answers.{" "}
          {path.pending > 0
            ? "More follow-up questions may appear."
            : "Only questions that apply are included."}
        </p>
      </div>
      <details className="section-navigator">
        <summary>
          <ListChecks size={18} aria-hidden="true" /> Sections{" "}
          <span>
            {
              path.sections.filter(
                (s) =>
                  s.items.length > 0 &&
                  s.answered === s.items.length &&
                  !s.pending,
              ).length
            }{" "}
            of {path.sections.length} complete
          </span>
        </summary>
        <nav aria-label="Questionnaire sections">
          {path.sections.map((s) => (
            <button
              type="button"
              key={s.id}
              disabled={!s.items.length}
              aria-current={!review && s.id === section.id ? "step" : undefined}
              onClick={() => {
                setEditing(false);
                go(s.items.find((item) => !item.answer) || s.items[0]);
              }}
            >
              <span>{s.title}</span>
              <small>
                {s.answered}/{s.items.length}
                {s.pending ? " · may expand" : ""}
              </small>
            </button>
          ))}
        </nav>
      </details>
      <p className="branch-update" role="status" aria-live="polite">
        {branchMessage}
      </p>
      {review ? (
        <>
          <Heading tabIndex={-1} ref={heading}>
            {path.complete
              ? clinicianEntry
                ? "Review before submitting"
                : "Ready to share?"
              : "Check your answers"}
          </Heading>
          <p className="question-hint">
            {path.complete
              ? "Review each section. You can change any answer before finishing."
              : `${path.missing.length} ${path.missing.length === 1 ? "question still needs" : "questions still need"} an answer. Choose “Prefer not to answer” if you wish.`}
          </p>
          <div className="answer-tools">
            <label>
              Find a question
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search questions or answers"
              />
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={missingOnly}
                onChange={(event) => setMissingOnly(event.target.checked)}
              />{" "}
              Unanswered only
            </label>
          </div>
          {path.sections.map((s) => {
            const items = s.items.filter(
              (entry) =>
                (!missingOnly || !entry.answer) &&
                `${questionTitle(entry.question, respondent)} ${entry.answer || ""}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
            );
            return (
              items.length > 0 && (
                <details className="question-section" key={s.id} open>
                  <summary>
                    {s.title}
                    <span>
                      {s.answered} of {s.items.length} answered
                    </span>
                  </summary>
                  <div className="answer-review">
                    {items.map((entry) => (
                      <div key={entry.question.id}>
                        <span>
                          <small>
                            {questionTitle(entry.question, respondent)}
                          </small>
                          <strong>{entry.answer || "Not answered"}</strong>
                        </span>
                        <button
                          type="button"
                          className="inline-link"
                          onClick={() => edit(entry)}
                        >
                          {entry.answer ? "Change" : "Answer"}
                          <span className="sr-only">
                            {" "}
                            {questionTitle(entry.question, respondent)}
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                </details>
              )
            );
          })}
          {!path.visible.some(
            (entry) =>
              (!missingOnly || !entry.answer) &&
              `${questionTitle(entry.question, respondent)} ${entry.answer || ""}`
                .toLowerCase()
                .includes(search.toLowerCase()),
          ) && <p className="muted">No questions match these filters.</p>}
          <Notice>
            {path.hidden} questions did not apply to your answers.{" "}
            {preview
              ? "This is a practice path. No care record is updated."
              : clinicianEntry
                ? "These answers will be saved with you as recorder. No separate clinical review is required."
                : "Your response will be submitted once, then be ready for the care team’s review."}
          </Notice>
          <div className="question-controls">
            <Button
              type="button"
              onClick={() => {
                setEditing(false);
                go(path.visible.at(-1));
              }}
            >
              <ArrowLeft size={17} />
              Back
            </Button>
            {!path.complete ? (
              <Button
                type="button"
                variant="primary"
                onClick={() => edit(path.missing[0])}
              >
                Answer remaining questions
                <ArrowRight size={17} />
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                onClick={() => onSubmit(path.answers)}
              >
                {preview ? "Finish practice" : "Submit response"}
                <Check size={17} />
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="adaptive-position">
            <span>
              {section.title} · Question {position + 1} of {path.total}
            </span>
            <button
              type="button"
              className="inline-link"
              onClick={() => setReview(true)}
            >
              Review answers
            </button>
          </div>
          <Heading ref={heading} tabIndex={-1} id={`${id}-question`}>
            {questionTitle(current.question, respondent)}
          </Heading>
          <p className="question-hint" id={`${id}-hint`}>
            {current.question.hint}
          </p>
          {scale && (
            <p className="likert-instruction" id={`${id}-scale`}>
              <strong>{scale.label}</strong>
              <span>{scale.instruction}</span>
            </p>
          )}
          <fieldset
            className={`answer-options ${scale ? "likert-options" : ""}`}
            aria-describedby={`${id}-hint${scale ? ` ${id}-scale` : ""}`}
          >
            <legend className="sr-only">
              {questionTitle(current.question, respondent)}
            </legend>
            {(scale ? scaleOptions : current.question.options).map((option) => (
              <AnswerOption
                key={option}
                option={option}
                name={`${id}-${current.question.id}`}
                selected={current.answer === option}
                onChoose={choose}
                likert={!!scale}
              />
            ))}
            {scale && nonResponseOptions.length > 0 && (
              <div className="likert-nonresponse">
                <p>If the scale does not fit</p>
                {nonResponseOptions.map((option) => (
                  <AnswerOption
                    key={option}
                    option={option}
                    name={`${id}-${current.question.id}`}
                    selected={current.answer === option}
                    onChoose={choose}
                  />
                ))}
              </div>
            )}
          </fieldset>
          <div className="question-controls">
            <Button
              type="button"
              disabled={!position && !editing}
              onClick={() =>
                editing ? setReview(true) : go(path.visible[position - 1])
              }
            >
              <ArrowLeft size={17} />
              {editing ? "Back to review" : "Back"}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!current.answer}
              onClick={() => {
                if (editing || position === path.total - 1) {
                  setReview(true);
                  setEditing(false);
                } else go(path.visible[position + 1]);
              }}
            >
              {editing
                ? "Return to review"
                : position === path.total - 1
                  ? "Check answers"
                  : "Continue"}
              <ArrowRight size={17} />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function AnswerOption({ option, name, selected, onChoose, likert = false }) {
  return (
    <label
      className={`answer-option ${likert ? "likert-option" : ""} ${selected ? "chosen" : ""}`}
    >
      <input
        type="radio"
        name={name}
        value={option}
        checked={selected}
        onChange={() => onChoose(option)}
      />
      <span className="radio-dot" />
      <span>{option}</span>
      {selected && <Check size={19} aria-hidden="true" />}
    </label>
  );
}
