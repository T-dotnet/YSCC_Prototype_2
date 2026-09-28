import { contactVisible } from "../assessmentFeatures.js";
import { LABELS } from "../terminology.js";
import { collectionStatus, formatDate } from "../model";
import { getInstrument } from "../instruments";
import { contactContribution } from "../responseSessions";
import { ActionGroup, Badge, Button, Modal, TextLink } from "./UI";
import { useStore } from "../store";
import { assessmentContactLinkingEnabled, assessmentSchedulingEnabled, assessmentSmsEnabled } from "../assessmentFeatures";
import { useState } from "react";
import RelatedRecordsTable from "./RelatedRecordsTable";

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
  const [open, setOpen] = useState(false);
  const { state } = useStore();
  if (!assessmentContactLinkingEnabled(state.settings)) return null;
  const visibleRecords = records.filter((record) =>
    (kind !== "contacts" || contactVisible(record, state.settings)) && (assessmentSmsEnabled(state.settings) || record.deliveryMode !== "SMS"));
  if (!visibleRecords.length && !showEmpty) return null;
  const contacts = kind === "contacts";
  const title = contacts ? "Related contacts" : "Linked assessments";
  const headings = contacts
    ? ["Date", "Name", "Status / outcome", LABELS.collectionMethod, ...(collection ? ["Contribution"] : [])]
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
            ? formatDate(record.submittedAt.slice(0, 10))
            : assessmentSchedulingEnabled(state.settings) && record.due ? `Due ${formatDate(record.due)}` : "Not completed",
          assessmentSchedulingEnabled(state.settings) ? collectionStatus(record) : record.response === "Submitted" ? "Completed" : record.response === "Draft" ? "Draft" : "Not started",
          contribution ? contributionCell(contribution) : "—",
        ];
    return headings.map((heading, index) => ({ heading, value: values[index] }));
  };

  const table = visibleRecords.length ? (
        <RelatedRecordsTable label={title}>
            <thead>
              <tr>{headings.map((heading) => <th scope="col" key={heading}>{heading}</th>)}</tr>
            </thead>
            <tbody>
              {orderedRecords.map((record) => (
                <tr key={record.id}>
                  {fieldsForRecord(record).map(({ heading, value }) => <td key={heading}>{value}</td>)}
                </tr>
              ))}
            </tbody>
        </RelatedRecordsTable>
      ) : <p className="related-records-empty">None linked.</p>;

  return (
    <section className={`history-associated-details related-records-link${inline ? " related-records-inline" : ""}`} aria-label={title}>
      <TextLink type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {title} · {visibleRecords.length}
      </TextLink>
      {open && (
        <Modal title={title} subtitle={`${visibleRecords.length} ${visibleRecords.length === 1 ? "record" : "records"}`} onClose={() => setOpen(false)} wide className="related-records-dialog">
          <div className="form-body related-records-dialog-body">{table}</div>
          <ActionGroup className="modal-footer"><Button type="button" onClick={() => setOpen(false)}>Close</Button></ActionGroup>
        </Modal>
      )}
    </section>
  );
}
