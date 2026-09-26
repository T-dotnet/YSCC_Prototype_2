import { collectionStatus, formatDate } from "../model";
import { getInstrument } from "../instruments";
import { contactContribution } from "../responseSessions";
import { Badge } from "./UI";

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

export default function RelatedRecordsAccordion({ kind, records = [], collection, contactId, showEmpty = false }) {
  if (!records.length && !showEmpty) return null;
  const contacts = kind === "contacts";
  const title = contacts ? "Related contacts" : "Linked assessments";
  const headings = contacts
    ? ["Date", "Name", "Status / outcome", "Collection method", ...(collection ? ["Contribution"] : [])]
    : ["Name", "Response / due date", "Status / outcome", "Contribution"];
  const instrument = collection ? getInstrument(collection.version) : null;
  const orderedRecords = [...records].sort((a, b) => {
    const date = (record) => contacts
      ? record.actualDate || record.plannedDate || ""
      : record.submittedAt?.slice(0, 10) || record.due || "";
    return date(a).localeCompare(date(b));
  });

  return (
    <details className="appointment-more-detail history-associated-details related-records-accordion">
      <summary>{title} · {records.length}</summary>
      {records.length ? (
        <div className={`related-records-table${contacts && collection ? " has-contribution" : ""}${!contacts ? " linked-assessments-table" : ""}`} role="table" aria-label={title}>
          <div className="related-records-header" role="row">
            {headings.map((heading) => <span role="columnheader" key={heading}>{heading}</span>)}
          </div>
          {orderedRecords.map((record) => {
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
                    : `Due ${formatDate(record.due)}`,
                  collectionStatus(record),
                  contribution ? contributionCell(contribution) : "—",
                ];
            return (
              <div className="related-records-row" role="row" key={record.id}>
                {values.map((value, index) => (
                  <span className="related-records-cell" role="cell" key={headings[index]}>
                    <small>{headings[index]}</small>
                    <span>{value}</span>
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      ) : <p className="related-records-empty">None linked.</p>}
    </details>
  );
}
