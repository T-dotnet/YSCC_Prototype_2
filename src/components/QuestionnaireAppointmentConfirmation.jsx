import { episodeWithVisibleContacts } from "../assessmentFeatures.js";
import { LABELS } from "../terminology.js";
import { useEffect, useRef, useState } from "react";
import { CONTACT_RECIPIENTS, CONTACT_TYPES, DRAFT_CONTACT_DELIVERY_MODES } from "../appointments";
import { formatDate, TODAY } from "../model";
import { Button, Field, Notice, ValidatedForm } from "./UI";
import CollectionMethodChoice from "./CollectionMethodChoice";
import { useStore } from "../store";
import { assessmentSmsEnabled } from "../assessmentFeatures";

export default function QuestionnaireAppointmentConfirmation({
  appointment,
  collection,
  episode,
  error,
  onBack,
  onConfirm,
  tablet = false,
}) {
  const { state } = useStore();
  episode = episodeWithVisibleContacts(episode, state.settings);
  appointment = episode.appointments?.find(contact => contact.id === appointment?.id);
  const [method, setMethod] = useState(collection.channel);
  const [contactChoice, setContactChoice] = useState("");
  const [existingId, setExistingId] = useState("");
  const [recipient, setRecipient] = useState("Young person");
  const headingRef = useRef(null);
  const latestDate = episode.end && episode.end < TODAY ? episode.end : TODAY;
  const contacts = (episode.appointments || [])
    .filter((item) => ["Planned", "Attended"].includes(item.attendance))
    .sort((a, b) => (b.actualDate || b.plannedDate).localeCompare(a.actualDate || a.plannedDate));
  const otherContacts = contacts.filter((item) => item.id !== appointment?.id);
  const selectedContact = contactChoice === "linked"
    ? contacts.find((item) => item.id === appointment?.id)
    : contacts.find((item) => item.id === existingId);
  const Heading = tablet ? "h1" : "h3";
  const SectionHeading = tablet ? "h2" : "h4";

  useEffect(() => {
    headingRef.current?.closest(".form-body")?.scrollTo({ top: 0 });
    if (tablet) window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [tablet]);

  const submit = (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const contact = {
      attendance: "Attended",
      plannedDate: values.contactDate,
      plannedTime: values.contactTime,
      plannedDurationMinutes: values.duration,
      actualDate: values.contactDate,
      actualTime: values.contactTime,
      actualDurationMinutes: values.duration,
      practitionerService: values.practitionerService,
      primaryPractitioner: values.primaryPractitioner,
      deliveryMode: values.deliveryMode,
      recipientType: values.recipientType,
      relatedPersonName: values.relatedPersonName,
      contactType: values.contactType,
    };
    onConfirm({
      completionMethod: values.completionMethod,
      contactLink: contactChoice === "new"
        ? { kind: "new", contact }
        : { kind: "existing", appointmentId: selectedContact?.id },
      ...(contactChoice !== "new" && selectedContact?.attendance === "Planned"
        ? { appointmentOutcome: {
            appointmentId: selectedContact.id,
            attendance: "Attended",
            recipientType: values.outcomeRecipient,
            relatedPersonName: values.outcomeRelatedPerson,
            contactType: values.outcomeContactType,
            primaryPractitioner: values.outcomePractitioner,
            actualDate: values.outcomeDate,
            actualTime: values.outcomeTime,
            actualDurationMinutes: values.outcomeDuration,
          } }
        : {}),
    });
  };

  return (
    <ValidatedForm onSubmit={submit}>
      <section className="questionnaire-appointment-confirmation" aria-labelledby="appointment-confirmation-heading">
        <Heading id="appointment-confirmation-heading" tabIndex={-1} ref={headingRef}>
          Confirm completion and contact
        </Heading>
        <p>The {collection.label.toLowerCase()} answers are complete. Confirm how they were collected and which contact supplied them before submitting.</p>
        {tablet && <Notice>Pass the tablet to a clinician to confirm the contact details.</Notice>}
        <CollectionMethodChoice method={method} onChange={setMethod} headingLevel={tablet ? "h2" : "h4"} />
        <section className="questionnaire-confirmation-panel" aria-labelledby="response-contact-heading">
          <SectionHeading id="response-contact-heading">Related contact</SectionHeading>
          <p>Use the appointment linked when collection started, choose another contact, or record a new one.</p>
          <fieldset className="draft-contact-choices">
            <legend>Which contact supplied these answers?</legend>
            {appointment && <label><input type="radio" name="contactChoice" value="linked" checked={contactChoice === "linked"}
              onChange={() => setContactChoice("linked")} required /> Use the appointment linked to this instrument · {formatDate(appointment.actualDate || appointment.plannedDate)} · {appointment.attendance}</label>}
            <label><input type="radio" name="contactChoice" value="existing" checked={contactChoice === "existing"}
              onChange={() => setContactChoice("existing")} required /> Choose another existing contact</label>
            <label><input type="radio" name="contactChoice" value="new" checked={contactChoice === "new"}
              onChange={() => setContactChoice("new")} required /> Record a new attended contact</label>
          </fieldset>
          {contactChoice === "existing" && (
            <Field label="Existing contact">
              <select value={existingId} onChange={(event) => setExistingId(event.target.value)} required>
                <option value="">Choose a contact</option>
                {otherContacts.map((item) => <option value={item.id} key={item.id}>
                  {formatDate(item.actualDate || item.plannedDate)} · {item.contactType || item.appointmentType || "Contact"} · {item.attendance}
                </option>)}
              </select>
            </Field>
          )}
          {contactChoice === "existing" && !otherContacts.length && <Notice>No other eligible contact is recorded. Record a new one if a contact took place.</Notice>}
          {["linked", "existing"].includes(contactChoice) && selectedContact?.attendance === "Planned" && (
            <>
              <Notice>This contact is still planned. Enter what actually happened before linking it to the completed response.</Notice>
              <div className="form-grid">
                <Field label="Actual date"><input name="outcomeDate" type="date" min={episode.start} max={latestDate} required /></Field>
                <Field label="Actual time"><input name="outcomeTime" type="time" required /></Field>
                <Field label="Actual duration (minutes)"><input name="outcomeDuration" type="number" min="1" max="600" required /></Field>
                <Field label="Contact recipient"><select name="outcomeRecipient" value={recipient} onChange={(event) => setRecipient(event.target.value)} required>
                  {CONTACT_RECIPIENTS.map((value) => <option key={value}>{value}</option>)}
                </select></Field>
                {recipient === "Related person" && <Field label="Related person name"><input name="outcomeRelatedPerson" required /></Field>}
                <Field label="Direct contact type"><select name="outcomeContactType" defaultValue={selectedContact.contactType || "Assessment"} required>
                  {CONTACT_TYPES.map((value) => <option key={value}>{value}</option>)}
                </select></Field>
                <Field label="Primary practitioner"><input name="outcomePractitioner" defaultValue={selectedContact.primaryPractitioner || ""} required /></Field>
              </div>
            </>
          )}
          {contactChoice === "new" && (
            <>
              <Notice>Record a new contact only if it actually happened. This saves an attended contact with the response.</Notice>
              <div className="form-grid">
                <Field label="Contact date"><input type="date" name="contactDate" min={episode.start} max={latestDate} required /></Field>
                <Field label="Time"><input type="time" name="contactTime" required /></Field>
                <Field label="Duration (minutes)"><input type="number" name="duration" min="1" max="600" required /></Field>
                <Field label={LABELS.contactMethod}><select name="deliveryMode" defaultValue="" required>
                  <option value="">Choose a contact method</option>
                  {DRAFT_CONTACT_DELIVERY_MODES.filter((value) => assessmentSmsEnabled(state.settings) || value !== "SMS").map((value) => <option key={value}>{value}</option>)}
                </select></Field>
                <Field label={LABELS.recipient}><select name="recipientType" value={recipient} onChange={(event) => setRecipient(event.target.value)} required>
                  {CONTACT_RECIPIENTS.map((value) => <option key={value}>{value}</option>)}
                </select></Field>
                {recipient === "Related person" && <Field label="Related person name"><input name="relatedPersonName" required /></Field>}
                <Field label="Direct contact type"><select name="contactType" defaultValue="" required>
                  <option value="">Choose a type</option>
                  {CONTACT_TYPES.map((value) => <option key={value}>{value}</option>)}
                </select></Field>
                <Field label="Practitioner or service"><input name="practitionerService" required /></Field>
                <Field label="Primary practitioner"><input name="primaryPractitioner" required /></Field>
              </div>
            </>
          )}
        </section>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="question-controls">
          <Button type="button" onClick={onBack}>Back to answer review</Button>
          <Button type="submit" variant="primary">Save response and contact</Button>
        </div>
      </section>
    </ValidatedForm>
  );
}
