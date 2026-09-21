import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, MessagesSquare } from "lucide-react";
import { getInstrument } from "../instruments";
import SubmittedAnswers from "../components/SubmittedAnswers";
import ReportEvidenceCard from "../components/ReportEvidenceCard";
import { formatDate, collectionActor } from "../model";
import {
  compareResponses,
  questionnaireProgress,
  responseDate,
} from "../progress";
import { Badge, Notice, Select, TextLink } from "../components/UI";

const dateLabel = (c) =>
  responseDate(c)
    ? formatDate(responseDate(c))
    : "Submission date not recorded";

export default function QuestionnaireEvidence({
  person,
  episode,
  openModal,
  questionnaireVersion,
  initialLatestId = null,
}) {
  const [latestId, setLatestId] = useState(initialLatestId);
  const [earlierId, setEarlierId] = useState(null);
  const [questionSearch, setQuestionSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [changesOnly, setChangesOnly] = useState(false);
  useEffect(() => {
    setLatestId(null);
    setEarlierId(null);
    setQuestionSearch("");
    setSectionFilter("all");
    setChangesOnly(false);
  }, [person.id, episode.id, questionnaireVersion, initialLatestId]);
  const progress = questionnaireProgress(
    person,
    episode,
    questionnaireVersion,
    latestId,
  );
  const { latest, earlier, undated } = progress;
  const selected =
    earlierId === ""
      ? null
      : earlier.find((c) => c.id === earlierId) || null;
  const hasComparison = !!selected;
  const comparison = compareResponses(person, selected, latest);
  const instrument = getInstrument(latest?.version);
  const qualitativeQuestions =
    instrument?.questions.filter(
      (question) => question.responseType !== "likert",
    ) || [];
  const qualitativeQuestionIds = new Set(
    qualitativeQuestions.map((question) => question.id),
  );
  const qualitativeRows = comparison.rows.filter((row) =>
    qualitativeQuestionIds.has(row.id),
  );
  const qualitativeChanged = qualitativeRows.filter(
    (row) => row.change === "Changed",
  ).length;
  const qualitativeComparable = qualitativeRows.filter(
    (row) => row.change !== "Not comparable",
  ).length;
  const qualitativeSignalRow = qualitativeRows.find(
    (row) => row.change === "Changed",
  );
  const qualitativeResponsesRecorded = qualitativeQuestions.filter(
    (question) => {
      const questionIndex = instrument.questions.findIndex(
        (item) => item.id === question.id,
      );
      const answer = latest?.answers?.[questionIndex];
      return answer !== "" && answer != null;
    },
  ).length;
  const comparisonRows = comparison.rows.filter(
    (row) =>
      (sectionFilter === "all" || sectionFilter === row.section) &&
      (!changesOnly || row.change === "Changed") &&
      `${row.question} ${row.before} ${row.after}`
        .toLowerCase()
        .includes(questionSearch.toLowerCase()),
  );
  const changeCountLabel =
    comparison.changed === 1 ? "1 change" : `${comparison.changed} changes`;
  const show = (type, collection) =>
    openModal({
      type,
      personId: person.id,
      episodeId: episode.id,
      collectionId: collection?.id,
    });
  return (
    <div className="stack patient-progress questionnaire-details">
      <details className="report-accordion questionnaire-comparison-panel" open>
        <summary>
          <span>Questionnaire comparison and details</span>
          {latest && hasComparison && !comparison.reason && (
            <Badge>{changeCountLabel}</Badge>
          )}
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <div className="panel-body progress-comparison">
          {latest && hasComparison && comparison.reason && (
            <div className="report-accordion-action">
              <TextLink onClick={() => show("review", latest)}>
                View latest response
              </TextLink>
            </div>
          )}
          {latest ? (
            <>
              {qualitativeQuestions.length > 0 && (
                <ReportEvidenceCard
                  variant="qualitative"
                  title="Overall signal"
                  metric={
                    hasComparison &&
                    !comparison.reason &&
                    qualitativeChanged > 0 &&
                    qualitativeSignalRow ? (
                      <div
                        className="report-evidence-metric qualitative"
                        aria-label={`Latest changed answer: ${qualitativeSignalRow.after}`}
                      >
                        <q>{qualitativeSignalRow.after}</q>
                        <small>Latest changed answer</small>
                      </div>
                    ) : null
                  }
                >
                  {!hasComparison || comparison.reason ? (
                    <>
                      <strong className="report-evidence-signal">
                        Latest response recorded
                      </strong>
                      <span className="report-evidence-detail">
                        {qualitativeResponsesRecorded} of{" "}
                        {qualitativeQuestions.length} responses recorded.
                        {hasComparison &&
                          comparison.reason &&
                          " A second submitted response is needed to compare change."}
                      </span>
                    </>
                  ) : qualitativeChanged > 0 ? (
                    <span className="report-evidence-detail">
                      {qualitativeChanged} answer
                      {qualitativeChanged === 1 ? "" : "s"} changed across{" "}
                      {qualitativeComparable} comparable questions.
                    </span>
                  ) : (
                    <>
                      <strong className="report-evidence-signal">
                        No changes noted
                      </strong>
                      <span className="report-evidence-detail">
                        {qualitativeComparable} comparable answers match the
                        earlier response.
                      </span>
                    </>
                  )}
                </ReportEvidenceCard>
              )}
              {progress.latestOptions.length > 1 && (
                <div className="progress-comparison-heading">
                  <label className="progress-compare-control">
                    <span>Response on latest date</span>
                    <Select
                      label="Response on latest date"
                      value={latest.id}
                      onChange={(event) => {
                        setLatestId(event.target.value);
                        setEarlierId(null);
                      }}
                    >
                      {progress.latestOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label} · {collectionActor(person, c, "respondent")}
                        </option>
                      ))}
                    </Select>
                  </label>
                </div>
              )}
              {progress.latestOptions.length > 1 && (
                <Notice>
                  Multiple responses share the latest submission date. Their
                  order within that day is not established. Choose which
                  response to view above.
                </Notice>
              )}
              {earlier.length > 0 && (
                <div className="answer-tools comparison-tools comparison-picker-only">
                  <label className="progress-compare-control">
                    <span>Compare latest with</span>
                    <Select
                      label="Compare latest with"
                      value={selected?.id || ""}
                      onChange={(event) => setEarlierId(event.target.value)}
                    >
                      <option value="">None</option>
                      {earlier.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label} · {dateLabel(c)}
                        </option>
                      ))}
                    </Select>
                  </label>
                </div>
              )}
              {!hasComparison ? (
                <SubmittedAnswers
                  key={latest.id}
                  person={person}
                  collection={latest}
                />
              ) : comparison.reason ? (
                <>
                  <Notice>{comparison.reason}</Notice>
                  <SubmittedAnswers
                    key={latest.id}
                    person={person}
                    collection={latest}
                  />
                  {selected && (
                    <TextLink onClick={() => show("review", selected)}>
                      View earlier response
                    </TextLink>
                  )}
                </>
              ) : (
                <>
                  <div className="answer-tools comparison-tools">
                    <label>
                      Find a question
                      <input
                        type="search"
                        placeholder="Search questions or answers"
                        value={questionSearch}
                        onChange={(event) =>
                          setQuestionSearch(event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Section
                      <select
                        value={sectionFilter}
                        onChange={(event) =>
                          setSectionFilter(event.target.value)
                        }
                      >
                        <option value="all">All sections</option>
                        {instrument?.sections.map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={changesOnly}
                        onChange={(event) =>
                          setChangesOnly(event.target.checked)
                        }
                      />
                      Changed answers only
                    </label>
                  </div>
                  <p className="muted">
                    Showing {comparisonRows.length} of {comparison.rows.length}{" "}
                    questions. Questions not asked on both paths are not
                    comparable.
                  </p>
                  <div
                    className="progress-table-scroll"
                    role="region"
                    aria-label="Questionnaire response comparison"
                    tabIndex={0}
                  >
                    <table className="progress-table">
                      <caption className="sr-only">
                        {selected.label} compared with {latest.label}. Changes
                        describe answers, not a clinical score.
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Question</th>
                          <th scope="col">
                            <span>{selected.label}</span>
                            <small>{dateLabel(selected)}</small>
                            <TextLink onClick={() => show("review", selected)}>
                              View earlier response
                            </TextLink>
                          </th>
                          <th scope="col">
                            <span>{latest.label}</span>
                            <small>{dateLabel(latest)} · Latest</small>
                            <TextLink onClick={() => show("review", latest)}>
                              View latest response
                            </TextLink>
                          </th>
                          <th scope="col">Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonRows.map((row) => (
                          <tr key={row.question}>
                            <th scope="row">{row.question}</th>
                            <td
                              data-label={`${selected.label} · ${dateLabel(selected)}`}
                            >
                              {row.before}
                            </td>
                            <td
                              data-label={`${latest.label} · ${dateLabel(latest)} · Latest`}
                              className={
                                row.change === "Changed"
                                  ? "progress-answer-changed"
                                  : ""
                              }
                            >
                              {row.after}
                            </td>
                            <td data-label="Change">
                              <span
                                className={`progress-change ${row.change === "Changed" ? "changed" : ""}`}
                              >
                                {row.change === "Changed" && (
                                  <ArrowRight size={14} aria-hidden="true" />
                                )}
                                {row.change}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {!comparisonRows.length && (
                          <tr>
                            <td colSpan={4}>
                              No questions match these filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="progress-comparison-footer">
                    <span className="muted">
                      {comparison.comparable < comparison.rows.length
                        ? "Questions not asked, missing, declined or invalid answers are excluded from change counts."
                        : "Changes are shown per answer; there is no combined clinical score."}
                    </span>
                  </div>
                  {(selected.channel !== latest.channel ||
                    selected.assistance !== latest.assistance) && (
                    <p className="progress-source-note">
                      Collection context changed:{" "}
                      {selected.channel || "Method not recorded"} /{" "}
                      {selected.assistance || "Assistance not recorded"} →{" "}
                      {latest.channel || "Method not recorded"} /{" "}
                      {latest.assistance || "Assistance not recorded"}. Consider
                      this when reviewing responses.
                    </p>
                  )}
                </>
              )}
              {(latest.needsReview || selected?.needsReview) && (
                <Notice tone="amber">
                  Answers changed after clinical review. This view uses the
                  current saved answers; re-review is required.
                </Notice>
              )}
              {undated.length > 0 && (
                <Notice>
                  {undated.length} submitted{" "}
                  {undated.length === 1 ? "response has" : "responses have"} no
                  recorded submission date and{" "}
                  {undated.length === 1 ? "is" : "are"} excluded from the
                  comparison. Open Assessment to review all responses.
                </Notice>
              )}
            </>
          ) : (
            <div className="progress-empty">
              <MessagesSquare size={26} aria-hidden="true" />
              <h3>
                {progress.responses.length
                  ? "Dates are needed to show change"
                  : "A starting point for understanding progress"}
              </h3>
              <p>
                {progress.responses.length
                  ? "Open Assessment to review submitted responses and collection history."
                  : "Once the first questionnaire is submitted, its answers will appear here. Follow-ups will add new points for comparison."}
              </p>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
