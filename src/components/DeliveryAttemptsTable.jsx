import { formatDate } from "../model";
import { getInstrument, questionnaireState } from "../instruments";
import { sessionAnswerCounts, sessionContribution } from "../responseSessions";
import { Badge } from "./UI";

const headings = ["Date", "Delivery contact", "Status / outcome", "Collection method", "Contribution"];

function contactLabel(contact) {
  return contact?.contactType || contact?.appointmentType || contact?.practitionerService || "Service contact";
}

export default function DeliveryAttemptsTable({ collection, contacts = [] }) {
  const attempts = collection.attempts || [];
  if (!attempts.length) return null;

  const draft = collection.response === "Draft";
  const instrument = getInstrument(collection.version);
  const counts = sessionAnswerCounts(collection, instrument, draft);
  const totalAnswers = questionnaireState(instrument, draft ? collection.draftAnswers : collection.answers).total;
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));

  return (
    <div className="related-records-table has-contribution delivery-attempts-table" role="table" aria-label="Delivery attempts">
      <div className="related-records-header" role="row">
        {headings.map((heading) => <span role="columnheader" key={heading}>{heading}</span>)}
      </div>
      {attempts.map((attempt, index) => {
        const contactId = attempt.appointmentId ||
          (attempt.id === collection.submittedAttemptId ? collection.submittedAppointmentId : null);
        const contact = contactById.get(contactId);
        const contribution = sessionContribution(collection, attempt, counts);
        const assistance = attempt.assistance ||
          (attempt.id === collection.submittedAttemptId ? collection.assistance : null);
        const values = [
          <span className="delivery-attempt-cell-stack">
            <strong>{attempt.date ? formatDate(attempt.date) : "Date not recorded"}</strong>
            <span>Attempt {index + 1}</span>
          </span>,
          <span className="delivery-attempt-cell-stack">
            <strong>{contact ? contactLabel(contact) : "None linked"}</strong>
            {contact && <span>{formatDate(contact.actualDate || contact.plannedDate)}</span>}
            {attempt.externalAppointment && <span>
              External: {formatDate(attempt.externalAppointment.date)} · {attempt.externalAppointment.time} · {attempt.externalAppointment.practitionerService} · {attempt.externalAppointment.deliveryMode}
            </span>}
          </span>,
          collection.response === "Submitted" && attempt.id === collection.submittedAttemptId
            ? "Response submitted"
            : attempt.status || "Not recorded",
          <span className="delivery-attempt-cell-stack">
            <strong>{attempt.channel || "Not recorded"}</strong>
            {assistance && <span>Assistance: {assistance}</span>}
            {attempt.recorderName && <span>Recorded by {attempt.recorderName}</span>}
          </span>,
          <span className="related-records-contribution">
            <Badge tone={contribution.status === "Completed" ? "green" : contribution.status === "Partial" ? "amber" : "neutral"}>
              {contribution.status}
            </Badge>
            <span>{contribution.answerCount} / {totalAnswers} answers</span>
          </span>,
        ];
        return (
          <div className="related-records-row" role="row" key={attempt.id}>
            {values.map((value, cellIndex) => (
              <span className="related-records-cell" role="cell" key={headings[cellIndex]}>
                <small>{headings[cellIndex]}</small>
                <span>{value}</span>
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
