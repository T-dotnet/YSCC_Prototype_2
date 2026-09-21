import { formatDate } from "../model";
import { responseDate } from "../progress";

function AnswerComparison({ row }) {
  return (
    <li className="report-change-answer">
      <p className="report-change-question">{row.question}</p>
      <dl className="report-answer-pair">
        <div>
          <dt>Earlier answer</dt>
          <dd>{row.before}</dd>
        </div>
        <div className={row.change === "Changed" ? "is-changed" : ""}>
          <dt>Latest answer</dt>
          <dd>{row.after}</dd>
        </div>
      </dl>
    </li>
  );
}

export default function ReportChanges({ evidence }) {
  if (!evidence.groups.length) {
    return (
      <p>
        There is not enough dated questionnaire evidence to describe change over
        time.
      </p>
    );
  }

  return (
    <div className="report-changes">
      {evidence.groups.map((group) => {
        const unchanged = group.comparison.rows.filter(
          (row) => row.change === "Unchanged",
        );
        const excluded = group.comparison.rows.filter(
          (row) => row.change === "Not comparable",
        );
        const contextChanged =
          group.first.channel !== group.last.channel ||
          group.first.assistance !== group.last.assistance;

        return (
          <section className="report-change-group" key={group.id}>
            <header className="report-change-header">
              <h4>{group.version || "Questionnaire version not recorded"}</h4>
              <p>
                {group.respondent} ·{" "}
                {group.role || "Respondent role not recorded"}
              </p>
              {!group.comparison.reason && (
                <dl className="report-comparison-dates">
                  <div>
                    <dt>Starting point</dt>
                    <dd>
                      <time dateTime={responseDate(group.first)}>
                        {formatDate(responseDate(group.first))}
                      </time>
                    </dd>
                  </div>
                  <div>
                    <dt>Latest response</dt>
                    <dd>
                      <time dateTime={responseDate(group.last)}>
                        {formatDate(responseDate(group.last))}
                      </time>
                    </dd>
                  </div>
                </dl>
              )}
            </header>

            {group.comparison.reason ? (
              <p className="report-comparison-note">
                {group.comparison.reason}
              </p>
            ) : (
              <>
                <p className="report-change-total">
                  <strong>
                    {group.comparison.changed}{" "}
                    {group.comparison.changed === 1
                      ? "answer changed"
                      : "answers changed"}
                  </strong>{" "}
                  out of {group.comparison.comparable} comparable answers
                </p>
                {group.sections
                  .filter((section) => section.changed.length > 0)
                  .map((section) => (
                    <section className="report-change-topic" key={section.id}>
                      <h5>{section.title}</h5>
                      <ul className="report-change-answers">
                        {section.changed.map((row) => (
                          <AnswerComparison key={row.id} row={row} />
                        ))}
                      </ul>
                    </section>
                  ))}

                {[
                  { rows: unchanged, label: "Unchanged answers" },
                  { rows: excluded, label: "Questions not comparable" },
                ].map(({ rows, label }) =>
                  rows.length > 0 ? (
                    <details className="report-change-details" key={label}>
                      <summary>
                        {label} <span>({rows.length})</span>
                      </summary>
                      {label === "Questions not comparable" && (
                        <p className="report-comparison-note">
                          These questions do not have a comparable answer in
                          both responses. They are excluded from the change
                          count.
                        </p>
                      )}
                      {group.sections.map((section) => {
                        const sectionRows = rows.filter(
                          (row) => row.section === section.id,
                        );
                        return sectionRows.length > 0 ? (
                          <section
                            className="report-change-topic"
                            key={section.id}
                          >
                            <h5>{section.title}</h5>
                            <ul className="report-change-answers">
                              {sectionRows.map((row) => (
                                <AnswerComparison key={row.id} row={row} />
                              ))}
                            </ul>
                          </section>
                        ) : null;
                      })}
                    </details>
                  ) : null,
                )}

                {contextChanged && (
                  <aside className="report-collection-change">
                    <h5>How responses were collected</h5>
                    <dl className="report-answer-pair">
                      <div>
                        <dt>Earlier</dt>
                        <dd>
                          {group.first.channel || "Method not recorded"}
                          <small>
                            {group.first.assistance ||
                              "Assistance not recorded"}
                          </small>
                        </dd>
                      </div>
                      <div>
                        <dt>Latest</dt>
                        <dd>
                          {group.last.channel || "Method not recorded"}
                          <small>
                            {group.last.assistance || "Assistance not recorded"}
                          </small>
                        </dd>
                      </div>
                    </dl>
                  </aside>
                )}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
