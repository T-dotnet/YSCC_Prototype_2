import { ChevronDown, History } from "lucide-react";
import { useStore } from "../store";
import { formatTimestamp, collectionActor } from "../model";

export default function ResponseHistory({ person, collection }) {
  const { state } = useStore();
  const edits = state.audit.filter(
    (event) =>
      event.type === "response-edit" && event.collectionId === collection.id,
  );
  if (!edits.length)
    return <p className="response-footnote">No answer edits recorded.</p>;
  return (
    <details className="response-disclosure">
      <summary>
        <span>
          <History size={17} aria-hidden="true" />
          Answer edit history <small>{edits.length}</small>
        </span>
        <ChevronDown size={17} aria-hidden="true" />
      </summary>
      <section className="response-history" aria-label="Response edit history">
        {edits.map((edit) => (
          <article className="response-edit-event" key={edit.id}>
            <div className="response-section-heading">
              <strong>{edit.actor}</strong>
              <small>{formatTimestamp(edit.timestamp)}</small>
            </div>
            <p className="muted">
              {edit.role} · {edit.changes.length}{" "}
              {edit.changes.length === 1 ? "answer changed" : "answers changed"}
            </p>
            <dl>
              {edit.changes.map((change) => (
                <div key={change.itemIndex}>
                  <dt>{change.question}</dt>
                  <dd className="history-answer-comparison">
                    <span>
                      <small>Before</small>
                      {change.priorDisplay ??
                        change.priorValue ??
                        "No answer recorded"}
                    </span>
                    <span>
                      <small>After</small>
                      {change.newDisplay ??
                        change.newValue ??
                        "No answer recorded"}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
            <p>
              <strong>Reason:</strong> {edit.reason}
            </p>
            {edit.source && (
              <p>
                <strong>Source:</strong> {edit.source}
              </p>
            )}
            <small>
              Answered by{" "}
              {collectionActor(
                person,
                { ...collection, ...edit },
                "respondent",
              )}{" "}
              · Recorded by{" "}
              {collectionActor(person, { ...collection, ...edit }, "recorder")}{" "}
              · Revision {edit.revision}
            </small>
          </article>
        ))}
      </section>
    </details>
  );
}
