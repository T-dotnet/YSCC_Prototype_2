import { useEffect, useRef, useState } from "react";
import { Field } from "./UI";
import {
  CONTACT_PARTICIPANTS,
  CONTACT_RECIPIENTS,
  CONTACT_TYPES,
  CONTACT_VENUES,
  CONTACT_YES_NO,
} from "../appointments";
import { DEMO_STAFF } from "../model";

function Options({ name, values, defaultValue, required, placeholder = "Choose if known" }) {
  return (
    <select name={name} defaultValue={defaultValue || ""} required={required}>
      <option value="">{placeholder}</option>
      {values.map((value) => <option key={value} value={value}>{value}</option>)}
    </select>
  );
}

export default function ContactFields({ appointment = {}, attended = false, person }) {
  const [recipient, setRecipient] = useState(appointment.recipientType || "Young person");
  const directContactRef = useRef(null);
  useEffect(() => {
    if (attended && directContactRef.current) directContactRef.current.open = true;
  }, [attended]);
  const primaryPractitioners = [...new Set([
    ...DEMO_STAFF.filter((staff) => staff.role === "Clinician").map((staff) => staff.name),
    ...(person?.episodes || []).flatMap((episode) => (episode.appointments || []).flatMap((item) => [
      item.primaryPractitioner,
      item.practitionerService?.includes(" · ") ? item.practitionerService.split(" · ")[0] : null,
    ])),
    appointment.primaryPractitioner,
  ].filter(Boolean))];
  return (
    <>
      <details className="appointment-more-detail appointment-direct-contact"
        defaultOpen={attended} ref={directContactRef}
        onInvalidCapture={() => { directContactRef.current.open = true; }}>
        <summary>Direct contact details</summary>
        <div className="appointment-actual-fields">
          <p>Record who received the contact and the practitioner who delivered it. Draft categories are not approved reporting codes.</p>
          <div className="form-grid">
            <Field label="Recipient">
              <select name="recipientType" value={recipient} onChange={(event) => setRecipient(event.target.value)} required={attended}>
                {CONTACT_RECIPIENTS.map((value) => <option key={value}>{value}</option>)}
              </select>
            </Field>
            {recipient === "Related person" && (
              <Field label="Related person name">
                <input name="relatedPersonName" defaultValue={appointment.relatedPersonName || person?.family || ""} required={attended} />
              </Field>
            )}
            <Field label="Direct contact type">
              <Options name="contactType" values={CONTACT_TYPES} defaultValue={appointment.contactType} required={attended} placeholder="Choose contact type" />
            </Field>
            <Field label="Primary practitioner">
              <select name="primaryPractitioner" defaultValue={appointment.primaryPractitioner || ""} required={attended}>
                <option value="">Choose practitioner</option>
                {primaryPractitioners.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </Field>
            <Field label="Other practitioners" hint="Separate names with commas.">
              <input name="additionalPractitioners" defaultValue={appointment.additionalPractitioners?.join(", ") || ""} />
            </Field>
            <Field label="Participants">
              <Options name="participants" values={CONTACT_PARTICIPANTS} defaultValue={appointment.participants} />
            </Field>
          </div>
        </div>
      </details>
      <details className="appointment-more-detail">
        <summary>Venue, units and reporting details</summary>
        <div className="form-grid appointment-reporting-fields">
          <Field label="Venue">
            <Options name="venue" values={CONTACT_VENUES} defaultValue={appointment.venue} />
          </Field>
          <Field label="Contact postcode">
            <input name="postcode" inputMode="numeric" pattern="[0-9]{4}" maxLength="4" defaultValue={appointment.postcode || ""} placeholder="4 digits" />
          </Field>
          <Field label="Registered unit">
            <input name="registeredUnit" defaultValue={appointment.registeredUnit || ""} placeholder="Site name" />
          </Field>
          <Field label="Servicing unit">
            <input name="servicingUnit" defaultValue={appointment.servicingUnit || ""} placeholder="Site name" />
          </Field>
          <Field label="Delivering unit">
            <input name="deliveringUnit" defaultValue={appointment.deliveringUnit || ""} placeholder="Team or pod" />
          </Field>
          <Field label="Interpreter used">
            <Options name="interpreter" values={CONTACT_YES_NO} defaultValue={appointment.interpreter} />
          </Field>
          <Field label="Co-payment">
            <Options name="copayment" values={CONTACT_YES_NO} defaultValue={appointment.copayment} />
          </Field>
          <Field label="Funding source">
            <input name="fundingSource" defaultValue={appointment.fundingSource || ""} />
          </Field>
          <Field label="Final contact">
            <Options name="finalContact" values={CONTACT_YES_NO} defaultValue={appointment.finalContact} />
          </Field>
        </div>
      </details>
    </>
  );
}
