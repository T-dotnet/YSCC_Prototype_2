import { collectionStatus, formatDate } from "../model";
import { getInstrument } from "../instruments";
import { contactContribution } from "../responseSessions";
import { Badge } from "./UI";
import { useStore } from "../store";
import { assessmentContactLinkingEnabled, assessmentSchedulingEnabled, assessmentSmsEnabled } from "../assessmentFeatures";

const contactName = (contact) =>
  contact.contactType || contact.appointmentType || contact.practitionerService || "Service contact";

const contributionCell = (contribution) => (
  <span className="related-records-contribution">
    <Badge tone={contribution.status === "Completed" ? "green" : contribution.status === "Partial" ? "amber" : "neutral"}>
      {contribution.status}
    </Badge>
    <span>{contribution.answerCount} / {contribution.totalAnswers} answers</span>
  </span>
);

export default function RelatedRecordsAccordion({ kind, records = [], collection, contactId, showEmpty = false, inline = false }) {
  const { state } = useStore();
  if (!assessmentContactLinkingEnabled(state.settings)) return null;
  const visibleRecords = records.filter((record) =>
    assessmentSmsEnabled(state.settings) || record.deliveryMode !== "SMS");
  if (!visibleRecords.length && !showEmpty) return null;
  const contacts = kind === "contacts";
  const title = contacts ? "Related contacts" : "Linked assessments";
  const headings = contacts
    ? ["Date", "Name", "Status / outcome", "Collection method", ...(collection ? ["Contribution"] : [])]
    : ["Name", assessmentSchedulingEnabled(state.settings) ? "Response / due date" : "Response", "Status / outcome", "Contribution"];
  const instrument = collection ? getInstrument(collection.version) : null;
  const orderedRecords = [...visibleRecords].sort((a, b) => {
    const date = (record) => contacts
      ? record.actualDate || record.plannedDate || ""
      : record.submittedAt?.slice(0, 10) || record.due || "";
    return date(a).localeCompare(date(b));
  });
  const fieldsForRecord = (record) => {
    const contribution = contacts && collection
      ? contactContribution(collection, record.id, instrument)
      : !contacts && contactId
        ? contactContribution(record, contactId, getInstrument(record.version))
        : null;
    const values = contacts
      ? [
          formatDate(record.actualDate || record.plannedDate),
          contactName(record),
          record.attendance || "Not recorded",
          contribution?.methods.join(", ") || "No delivery attempt",
          ...(contribution ? [contributionCell(contribution)] : []),
        ]
      : [
          record.label,
          record.submittedAt
            ? `Response ${formatDate(record.submittedAt.slice(0, 10))}`
            : assessmentSchedulingEnabled(state.settings) && record.due ? `Due ${formatDate(record.due)}` : "Not completed",
          assessmentSchedulingEnabled(state.settings) ? collectionStatus(record) : record.response === "Submitted" ? "Completed" : record.response === "Draft" ? "Draft" : "Created",
          contribution ? contributionCell(contribution) : "—",
        ];
    return headings.map((heading, index) => ({ heading, value: values[index] }));
  };

  const table = visibleRecords.length ? (
        <div className={`related-records-table${contacts && collection ? " has-contribution" : ""}${!contacts ? " linked-assessments-table" : ""}`} role="table" aria-label={title}>
          <div className="related-records-header" role="row">
            {headings.map((heading) => <span role="columnheader" key={heading}>{heading}</span>)}
          </div>
          {orderedRecords.map((record) => {
            return (
              <div className="related-records-row" role="row" key={record.id}>
                {fieldsForRecord(record).map(({ heading, value }) => (
                  <span className="related-records-cell" role="cell" key={heading}>
                    <small>{heading}</small>
                    <span>{value}</span>
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      ) : <p className="related-records-empty">None linked.</p>;

  if (inline) return (
    <section className="history-associated-details related-records-inline" aria-label={title}>
      <h5>{title} · {visibleRecords.length}</h5>
      {table}
    </section>
  );

  return (
    <details className="appointment-more-detail history-associated-details related-records-accordion">
      <summary>{title} · {visibleRecords.length}</summary>
      {table}
    </details>
  );
}
