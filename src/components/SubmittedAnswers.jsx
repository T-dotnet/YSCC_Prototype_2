import { useId, useState } from "react";
import {
  getInstrument,
  questionnaireState,
  questionTitle,
  setQuestionAnswer,
  answerLabel,
  describeRule,
} from "../instruments";
import { Notice } from "./UI";
import { collectionActor } from "../model";
import { Undo2 } from "lucide-react";

export default function SubmittedAnswers({
  person,
  collection,
  onAnswersChange,
  originalAnswers,
  headerAction,
  disabled = false,
}) {
  const id = useId();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const answers = collection.answers || [];
  const instrument = getInstrument(collection.version);
  const path = questionnaireState(instrument, answers);
  const title = (question) => questionTitle(question, collection.respondent);
  const matches = (entry) =>
    `${title(entry.question)} ${answerLabel(entry)}`
      .toLowerCase()
      .includes(search.toLowerCase()) &&
    (filter !== "missing" || !entry.answer) &&
    (filter !== "changed" ||
      (originalAnswers &&
        (answers[entry.index] ?? null) !==
          (originalAnswers[entry.index] ?? null)));
  const renderAnswer = (entry) => {
    const { question, index, answer } = entry;
    const changed =
      originalAnswers &&
      (answers[index] ?? null) !== (originalAnswers[index] ?? null);
    if (!onAnswersChange)
      return (
        <article className="answer-summary" key={question.id}>
          <h4>
            <span className="question-number">{index + 1}</span>
            {title(question)}
          </h4>
          <p className="recorded-answer">{answerLabel(entry)}</p>
          <details className="answer-options-disclosure">
            <summary>Question context & answer options</summary>
            <p>{question.hint}</p>
            {question.when && (
              <p>
                Shown when:{" "}
                {describeRule(instrument, question.when, collection.respondent)}
              </p>
            )}
            <ul>
              {question.options.map((option) => (
                <li key={option}>
                  {option}
                  {option === answer ? " · Selected answer" : ""}
                </li>
              ))}
            </ul>
          </details>
        </article>
      );
    return (
      <fieldset
        className={`submitted-question ${changed ? "answer-changed" : ""}`}
        key={question.id}
        disabled={disabled}
      >
        <legend>
          <span className="question-number">{index + 1}</span> {title(question)}
        </legend>
        <p className="muted">{question.hint}</p>
        {changed && (
          <div className="answer-change-context">
            <span>
              <strong>Changed</strong> · Previously:{" "}
              {originalAnswers[index] || "No answer recorded"}
            </span>
            <button
              type="button"
              className="undo-answer"
              aria-label={`Undo change to question ${index + 1}`}
              onClick={() =>
                onAnswersChange(
                  setQuestionAnswer(
                    instrument,
                    answers,
                    index,
                    originalAnswers[index],
                  ),
                )
              }
            >
              <Undo2 size={14} aria-hidden="true" />
              Undo
            </button>
          </div>
        )}
        <div className="submitted-options">
          {question.options.map((option) => (
            <label
              className={`submitted-option ${answer === option ? "selected" : ""}`}
              key={option}
            >
              <input
                type="radio"
                name={`${id}-${question.id}`}
                value={option}
                checked={answer === option}
                onChange={() =>
                  onAnswersChange(
                    setQuestionAnswer(instrument, answers, index, option),
                  )
                }
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
        {!answer && (
          <p className="missing-answer">Answer this question before saving.</p>
        )}
      </fieldset>
    );
  };
  return (
    <div className="submitted-questionnaire">
      <div className="response-section-heading">
        <div>
          <h3>
            {onAnswersChange ? "Questionnaire answers" : "Submitted answers"}
          </h3>
          <p className="muted">
            {collectionActor(person, collection, "respondent")} ·{" "}
            {instrument
              ? `${path.answered} of ${path.total} applicable questions answered`
              : `${answers.filter(Boolean).length} answers`}{" "}
            · {onAnswersChange ? "Editing" : "Read-only"}
          </p>
        </div>
        {headerAction}
      </div>
      {instrument ? (
        <>
          {onAnswersChange && instrument.questions.some((q) => q.when) && (
            <Notice>
              Changing an earlier answer can add questions or clear answers that
              no longer apply. Complete any new questions before saving.
              Original answers remain in edit history.
            </Notice>
          )}
          <div className="answer-tools">
            <label>
              Find a question
              <input
                type="search"
                placeholder="Search questions or answers"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label>
              Show
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                <option value="all">All applicable questions</option>
                <option value="missing">Unanswered questions</option>
                {originalAnswers && (
                  <option value="changed">Changed answers</option>
                )}
              </select>
            </label>
          </div>
          {path.sections.map((section) => {
            const items = section.items.filter(matches);
            return (
              items.length > 0 && (
                <details className="question-section" key={section.id} open>
                  <summary>
                    {section.title}
                    <span>
                      {section.answered} of {section.items.length} answered
                    </span>
                  </summary>
                  {items.map(renderAnswer)}
                </details>
              )
            );
          })}
          {!path.visible.some(matches) && (
            <p className="muted">
              No applicable questions match these filters.
            </p>
          )}
          {path.entries.some((entry) => entry.status !== "visible") && (
            <details className="question-section omitted-questions">
              <summary>
                Questions not asked<span>{path.hidden + path.pending}</span>
              </summary>
              <p className="muted">
                Excluded from completion and answer-change counts. These
                questions depend on earlier answers.
              </p>
              {path.entries
                .filter(
                  (entry) =>
                    entry.status !== "visible" &&
                    `${title(entry.question)} ${answerLabel(entry)}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                )
                .map((entry) => (
                  <article className="answer-summary" key={entry.question.id}>
                    <h4>{title(entry.question)}</h4>
                    <p>{answerLabel(entry)}</p>
                    <p className="muted">
                      Shown when:{" "}
                      {describeRule(
                        instrument,
                        entry.question.when,
                        collection.respondent,
                      )}
                    </p>
                    {originalAnswers?.[entry.index] && (
                      <p className="missing-answer">
                        Previous answer “{originalAnswers[entry.index]}” will be
                        cleared from this response.
                      </p>
                    )}
                  </article>
                ))}
            </details>
          )}
        </>
      ) : (
        <>
          <Notice>
            Question text is unavailable for this questionnaire version.
          </Notice>
          {answers.length ? (
            answers.map((answer, index) => (
              <div className="answer-row" key={index}>
                <span>Answer {index + 1}</span>
                <strong>{answer || "No answer recorded"}</strong>
              </div>
            ))
          ) : (
            <p className="muted">No answers recorded.</p>
          )}
        </>
      )}
    </div>
  );
}
