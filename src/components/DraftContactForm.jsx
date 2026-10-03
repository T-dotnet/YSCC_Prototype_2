import { LABELS } from "../terminology.js";
import { useState } from "react";
import {
  DRAFT_CONTACT_DELIVERY_MODES,
  CONTACT_RECIPIENTS,
  CONTACT_TYPES,
} from "../appointments";
import { formatDate, TODAY } from "../model";
import { ActionGroup, Button, Field, Notice, RadioInput, ValidatedForm } from "./UI";
import CollectionMethodChoice from "./CollectionMethodChoice";
import TabletAssistanceChoice from "./TabletAssistanceChoice";

export default function DraftContactForm({ episode, collection, error, onCancel, onSave, showContactChoice = true, confirmTabletAssistance = false }) {
  const [choice, setChoice] = useState("");
  const [existingId, setExistingId] = useState("");
  const [recipient, setRecipient] = useState("Young person");
  const [method, setMethod] = useState(collection.channel === "SMS link" ? "SMS link" : "");
  const [assistance, setAssistance] = useState("");
  const showTabletAssistance = confirmTabletAssistance && method === "Clinic tablet";
  const confirmedMethod = ["Clinic tablet", "Clinician entry"].includes(method) ? method : undefined;
  const [choiceError, setChoiceError] = useState("");
  const existingContacts = (episode.appointments || [])
    .filter((contact) => contact.attendance === "Attended" &&
      contact.actualDate && contact.actualDate <= TODAY)
    .sort((a, b) => b.actualDate.localeCompare(a.actualDate));

  const selectChoice = (value) => {
    setChoice(value);
    setChoiceError("");
  };

  return (
    <ValidatedForm
      className="draft-contact-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!confirmedMethod && collection.channel !== "SMS link") {
          setChoiceError("Choose how these answers were completed before saving the draft.");
          return;
        }
        if (showTabletAssistance && !assistance) {
          setChoiceError("Choose whether the tablet answers were completed independently or with assistance.");
          return;
        }
        const confirmedAssistance = showTabletAssistance ? assistance : undefined;
        if (!showContactChoice) {
          onSave({ kind: "none" }, confirmedMethod, confirmedAssistance);
          return;
        }
        if (!choice || (choice === "existing" && !existingId)) {
          setChoiceError("Choose a contact option before saving the draft.");
          return;
        }
        if (choice === "existing") {
          onSave({ kind: "existing", appointmentId: existingId }, confirmedMethod, confirmedAssistance);
          return;
        }
        if (choice === "none") {
          onSave({ kind: "none" }, confirmedMethod, confirmedAssistance);
          return;
        }
        const values = Object.fromEntries(new FormData(event.currentTarget));
        onSave({
          kind: "new",
          contact: {
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
          },
        }, confirmedMethod, confirmedAssistance);
      }}
    >
      <div className="form-body">
        <p>Save the answers as a draft for <strong>{collection.label}</strong>.{showContactChoice && " If a contact supplied these answers, link the contact so its contribution appears under Related contacts."}</p>
        <CollectionMethodChoice method={method} onChange={(value) => { setMethod(value); setAssistance(""); setChoiceError(""); }} />
        {showTabletAssistance && <TabletAssistanceChoice assistance={assistance} onChange={(value) => { setAssistance(value); setChoiceError(""); }} />}
        {showContactChoice && <>
        <fieldset className="draft-contact-choices">
          <legend>Which contact supplied these answers?</legend>
          <label><RadioInput name="draftContactChoice" checked={choice === "existing"} onChange={() => selectChoice("existing")} /> Link an existing attended contact</label>
          <label><RadioInput name="draftContactChoice" checked={choice === "new"} onChange={() => selectChoice("new")} /> Record a new attended contact</label>
          <label><RadioInput name="draftContactChoice" checked={choice === "none"} onChange={() => selectChoice("none")} /> No contact took place</label>
        </fieldset>
        {choice === "existing" && (
          <Field label="Attended contact">
            <select value={existingId} onChange={(event) => setExistingId(event.target.value)} required>
              <option value="">Choose a contact</option>
              {existingContacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {formatDate(contact.actualDate)} · {contact.contactType || contact.appointmentType || "Contact"} · {contact.practitionerService}
                </option>
              ))}
            </select>
          </Field>
        )}
        {choice === "existing" && !existingContacts.length && (
          <Notice>No attended contact is recorded in this care episode. Record a new one if a contact took place.</Notice>
        )}
        {choice === "new" && (
          <>
            <Notice>Record a new contact only if it actually happened. This saves an attended contact alongside the draft.</Notice>
            <div className="form-grid">
              <Field label="Contact date"><input type="date" name="contactDate" min={episode.start} max={episode.end && episode.end < TODAY ? episode.end : TODAY} required /></Field>
              <Field label="Time"><input type="time" name="contactTime" required /></Field>
              <Field label="Duration (minutes)"><input type="number" name="duration" min="1" max="600" required /></Field>
              <Field label={LABELS.contactMethod}>
                <select name="deliveryMode" defaultValue="" required>
                  <option value="">Choose a contact method</option>
                  {DRAFT_CONTACT_DELIVERY_MODES.filter((value) => !["SMS", "Clinic tablet", "Clinician entry"].includes(value)).map((value) => <option key={value}>{value}</option>)}
                </select>
              </Field>
              <Field label={LABELS.recipient}>
                <select name="recipientType" value={recipient} onChange={(event) => setRecipient(event.target.value)} required>
                  {CONTACT_RECIPIENTS.map((value) => <option key={value}>{value}</option>)}
                </select>
              </Field>
              {recipient === "Related person" && <Field label="Related person name"><input name="relatedPersonName" required /></Field>}
              <Field label="Direct contact type">
                <select name="contactType" defaultValue="" required>
                  <option value="">Choose a type</option>
                  {CONTACT_TYPES.map((value) => <option key={value}>{value}</option>)}
                </select>
              </Field>
              <Field label="Practitioner or service"><input name="practitionerService" required /></Field>
              <Field label="Primary practitioner"><input name="primaryPractitioner" required /></Field>
            </div>
          </>
        )}
        {choice === "none" && (
          <Notice>The draft will stay on the measure record. Related contacts will remain unchanged.</Notice>
        )}
        </>}
        {(choiceError || error) && <p className="field-error" role="alert">{choiceError || error}</p>}
      </div>
      <ActionGroup className="modal-footer">
        <Button type="button" onClick={onCancel}>Back to answers</Button>
        <Button type="submit" variant="primary">Save draft and leave</Button>
      </ActionGroup>
    </ValidatedForm>
  );
}
