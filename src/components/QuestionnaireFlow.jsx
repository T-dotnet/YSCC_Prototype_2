import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ListChecks, Search } from "lucide-react";
import { COUNTRY_OPTIONS } from "../countryOptions";
import { LANGUAGE_OPTIONS } from "../languageOptions";
import {
  questionnaireState,
  questionTitle,
  setQuestionAnswer,
} from "../instruments";
import { Button, Notice, Checkbox, Field, ProgressBar, RadioCard, Select } from "./UI";

export default function QuestionnaireFlow({
  instrument,
  respondent,
  answers,
  onChange,
  onSubmit,
  preview = false,
  headingLevel,
  clinicianEntry = false,
  submitLabel,
  completionNote,
  initialReview = false,
  showProgress = true,
  secondaryAction,
}) {
  const path = questionnaireState(instrument, answers);
  const [currentId, setCurrentId] = useState(instrument.questions[0].id);
  const [review, setReview] = useState(initialReview);
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [branchMessage, setBranchMessage] = useState("");
  const heading = useRef(null);
  const navigationRequested = useRef(false);
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
    if (!navigationRequested.current) return;
    navigationRequested.current = false;
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
  const toggleMultiple = (option) => {
    const selected = current.answer ? current.answer.split('||') : [];
    choose(selected.includes(option)
      ? selected.filter(value => value !== option).join('||')
      : [...selected, option].join('||'));
  };
  const go = (entry) => {
    navigationRequested.current = true;
    setCurrentId(entry.question.id);
    setReview(false);
  };
  const openReview = () => {
    navigationRequested.current = true;
    setReview(true);
  };
  const edit = (entry) => {
    setEditing(true);
    go(entry);
  };
  return (
    <div className={`adaptive-flow${review ? " adaptive-flow-review" : ""}`}>
      {showProgress && <>
      <div className="adaptive-progress">
        <div className="question-progress">
          <strong>
            {path.answered} of {path.total} answered
          </strong>
          <span>{path.percent}% of current path</span>
        </div>
        <ProgressBar value={path.answered} max={path.total} label="Questions answered on current path" />
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
        <nav aria-label="Measure sections">
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
      </>}
      <p className="branch-update" role="status" aria-live="polite">
        {branchMessage}
      </p>
      {review ? (
        <>
          <div className="questionnaire-review-body">
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
            <Checkbox label="Unanswered only" checked={missingOnly}
              onChange={(event) => setMissingOnly(event.target.checked)} />
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
                          <strong>{entry.answer?.replaceAll('||', ', ') || "Not answered"}</strong>
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
          {path.complete && completionNote && (
            <div className="questionnaire-next-step">
              <strong>Next: completion details</strong>
              <p>{completionNote}</p>
            </div>
          )}
          </div>
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
            {secondaryAction}
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
                {submitLabel ||
                  (preview ? "Finish practice" : "Submit response")}
                {completionNote ? (
                  <ArrowRight size={17} />
                ) : (
                  <Check size={17} />
                )}
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="adaptive-position">
            <span>
              Question {position + 1} of {path.total}
            </span>
            <button
              type="button"
              className="inline-link"
              onClick={openReview}
            >
              Review answers
            </button>
          </div>
          <Heading ref={heading} tabIndex={-1} id={`${id}-question`}>
            {questionTitle(current.question, respondent)}
          </Heading>
          {current.question.hint && <p className="question-hint" id={`${id}-hint`}>
            {current.question.hint}
          </p>}
          {scale && (
            <p className="likert-instruction" id={`${id}-scale`}>
              <strong>{scale.label}</strong>
              <span>{scale.instruction}</span>
            </p>
          )}
          <fieldset
            className={`answer-options ${scale ? "likert-options" : ""}`}
            aria-describedby={[current.question.hint && `${id}-hint`, scale && `${id}-scale`].filter(Boolean).join(' ') || undefined}
          >
            <legend className="sr-only">
              {questionTitle(current.question, respondent)}
            </legend>
            {current.question.responseType === 'number' && <div className="answer-input-field">
              <Field label="Number"><input type="number" step="1" min={current.question.min ?? 0}
                max={current.question.max ?? undefined} value={current.answer || ''}
                onChange={event => choose(event.target.value)} /></Field>
            </div>}
            {current.question.responseType === 'date' && <div className="answer-input-field">
              <Field label="Date"><input type="date" value={current.answer || ''}
                onChange={event => choose(event.target.value)} /></Field>
            </div>}
            {current.question.id === 'clientCountryOfBirth' && <SearchListAnswer value={current.answer || ''} onChoose={choose}
              options={COUNTRY_OPTIONS} noun="country or territory" plural="countries and territories" />}
            {current.question.id === 'clientLanguageHome' && <SearchListAnswer value={current.answer || ''} onChoose={choose}
              options={LANGUAGE_OPTIONS} noun="language" plural="languages" allowCustom />}
            {current.question.responseType === 'text' && !['clientCountryOfBirth', 'clientLanguageHome'].includes(current.question.id) && <div className="answer-input-field">
              <Field label="Response"><input type="text" value={current.answer || ''}
                onChange={event => choose(event.target.value)} /></Field>
            </div>}
            {current.question.multiple && current.question.options.map(option => <Checkbox key={option}
              label={option} verbatim className={`answer-multiple-option${current.answer?.split('||').includes(option) ? ' chosen' : ''}`}
              checked={!!current.answer?.split('||').includes(option)}
              onChange={() => toggleMultiple(option)} />)}
            {!current.question.multiple && current.question.options.length > 12 && <div className="answer-select-field">
              <Field label="Choose a response">
                <Select label="Choose a response" value={current.answer === 'Not recorded' ? '' : current.answer || ''} onChange={event => choose(event.target.value)}>
                  <option value="">Select one</option>
                  {current.question.options.filter(option => option !== 'Not recorded').map(option => <option key={option} value={option}>{option}</option>)}
                </Select>
              </Field>
            </div>}
            {!current.question.multiple && current.question.options.length > 12 && current.question.options.includes('Not recorded') &&
              <AnswerOption option="Not recorded" name={`${id}-${current.question.id}`}
                selected={current.answer === 'Not recorded'} onChoose={choose} />}
            {!current.question.multiple && current.question.options.length <= 12 && (scale ? scaleOptions : current.question.options).map((option) => (
              <AnswerOption
                key={option}
                option={option}
                name={`${id}-${current.question.id}`}
                selected={current.answer === option}
                onChoose={choose}
                likert={!!scale}
              />
            ))}
            {current.question.nonResponseOptions?.length > 0 && <div className="likert-nonresponse">
              <p>If no value is available</p>
              {current.question.nonResponseOptions.map(option => <AnswerOption
                key={option} option={option} name={`${id}-${current.question.id}`}
                selected={current.answer === option} onChoose={choose} />)}
            </div>}
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
                editing ? openReview() : go(path.visible[position - 1])
              }
            >
              <ArrowLeft size={17} />
              {editing ? "Back to review" : "Back"}
            </Button>
            {secondaryAction}
            <Button
              type="button"
              variant="primary"
              disabled={!current.answer}
              onClick={() => {
                if (editing || position === path.total - 1) {
                  openReview();
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
    <RadioCard
      className={`answer-option ${likert ? "likert-option" : ""} ${selected ? "chosen" : ""}`}
      selected={selected}
      name={name}
      value={option}
      checked={selected}
      onChange={() => onChoose(option)}
    >
      <span className="radio-dot" />
      <span>{option}</span>
      {selected && <Check size={19} aria-hidden="true" />}
    </RadioCard>
  );
}

function SearchListAnswer({ value, onChoose, options, noun, plural, allowCustom = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const input = useRef(null);
  const trigger = useRef(null);
  const searchId = useId();
  const normalized = query.trim().toLocaleLowerCase();
  const matches = options.filter(({ name, code }) =>
    name.toLocaleLowerCase().includes(normalized) || code.toLowerCase().includes(normalized)
  );
  const custom = allowCustom && normalized && !options.some(({ name }) => name.toLocaleLowerCase() === normalized);
  const select = (name) => {
    onChoose(name);
    setOpen(false);
    setQuery('');
    trigger.current?.focus();
  };
  return <div className="answer-search-field">
    <span className="answer-search-label">Response</span>
    <button type="button" ref={trigger} className="answer-search-trigger"
      aria-expanded={open} aria-controls={searchId}
      onClick={() => { setOpen(!open); setQuery(''); }}>
      <span className={value && value !== 'Not recorded' ? '' : 'answer-search-placeholder'}>
        {value && value !== 'Not recorded' ? value : `Select ${noun}`}
      </span>
      <ChevronDown size={18} aria-hidden="true" />
    </button>
    {open && <div className="answer-search-panel" id={searchId}>
      <label className="answer-search-input-wrap">
        <Search size={18} aria-hidden="true" />
        <span className="sr-only">Search {plural}</span>
        <input ref={input} autoFocus type="search" value={query} placeholder={`Search ${plural}`}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
            if (event.key === 'Enter' && matches.length === 1) { event.preventDefault(); select(matches[0].name); }
            else if (event.key === 'Enter' && custom && matches.length === 0) { event.preventDefault(); select(query.trim()); }
          }} />
      </label>
      <div className="answer-search-results" role="listbox" aria-label={plural}>
        {matches.map(({ code, name }) => <button key={code} type="button" role="option"
          aria-selected={value === name} className="answer-search-option" onClick={() => select(name)}>{name}
          {value === name && <Check size={18} aria-hidden="true" />}</button>)}
        {custom && <button type="button" role="option" aria-selected={value === query.trim()}
          className="answer-search-option" onClick={() => select(query.trim())}>Use “{query.trim()}”</button>}
        {!matches.length && !custom && <p className="answer-search-empty">No matching {plural}</p>}
      </div>
    </div>}
  </div>;
}
