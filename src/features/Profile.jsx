import { useState } from "react";
import { useStore } from "../store";
import { TODAY } from "../model";
import {
  REFERRAL_SOURCES, GENDER_OPTIONS, SEXUALITY_OPTIONS, ATSI_OPTIONS,
  EDUCATION_OPTIONS, PROFILE_FIELDS, PROFILE_EPISODE_FIELDS,
  REGISTERED_CENTRE_STATES,
} from "../batch1Registration";
import { ActionGroup, Button, Field, ModalFooter, Notice, Panel, ValidatedForm } from "../components/UI";

export function initialValues(person, episode, intake) {
  const legacyDetails = person.episodes?.[0]?.id === episode.id ? person.profileDetails : null;
  return {
    name: person.nameUnknown ? "" : person.name,
    dob: person.dob || "",
    ...Object.fromEntries(PROFILE_FIELDS.map(key => [key, person[key] || intake?.[key] || ""])),
    ...Object.fromEntries(PROFILE_EPISODE_FIELDS.map(key => [key,
      key in (episode.profileDetails || {}) ? episode.profileDetails[key] :
        key === "registeredCentreName" ? intake?.service || legacyDetails?.[key] || "" :
          intake?.[key] || legacyDetails?.[key] || "",
    ])),
  };
}

function ProfileSection({ title, description, inDialog, children }) {
  if (inDialog) return <section className="profile-edit-section">
    {title && <h3>{title}</h3>}
    {description && <p>{description}</p>}
    <div className="stack profile-edit-section-fields">{children}</div>
  </section>;
  return <Panel title={title} description={description}>
    <div className="panel-body stack">{children}</div>
  </Panel>;
}

export default function Profile({ person, episode, intake, openModal, onSaved, onCancel }) {
  const { state, commit } = useStore();
  const [draft, setDraft] = useState(() => initialValues(person, episode, intake));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const change = (key, value) => {
    setDraft(current => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  };
  const field = (key, label, type = "text", hint) => (
    <Field label={label} hint={hint}>
      <input id={`profile-${key}`} type={type} value={draft[key] || ""}
        max={type === "date" ? TODAY : undefined}
        required={key === "name" || key === "dob"}
        onChange={event => change(key, event.target.value)} />
    </Field>
  );
  const select = (key, label, options) => (
    <Field label={label}>
      <select id={`profile-${key}`} value={draft[key] || ""} onChange={event => change(key, event.target.value)}>
        <option value="">Not recorded</option>
        {draft[key] && !options.includes(draft[key]) && <option value={draft[key]}>{draft[key]} (previously recorded)</option>}
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </Field>
  );
  const submit = event => {
    event.preventDefault();
    if (draft.clientPostcode && !/^\d{4}$/.test(draft.clientPostcode)) {
      setError("Enter a four-digit postcode or leave it blank.");
      return;
    }
    if (draft.registeredCentrePostcode && !/^\d{4}$/.test(draft.registeredCentrePostcode)) {
      setError("Enter a four-digit centre postcode or leave it blank.");
      return;
    }
    if (draft.commencementDate && [draft.commencementDateUhr, draft.commencementDateFep].some(date => date && date < draft.commencementDate)) {
      setError("Stream commencement dates must be on or after the service commencement date.");
      return;
    }
    const name = draft.name.trim().toLowerCase();
    if (state.people.some(other => other.id !== person.id && !other.nameUnknown && other.name.toLowerCase() === name)) {
      setError("A matching name exists. Review that record before saving.");
      return;
    }
    const result = commit({ type: "UPDATE_PROFILE", personId: person.id, episodeId: episode.id, values: draft });
    if (result.error) return setError(result.error);
    setMessage("Profile saved.");
    onSaved?.();
  };
  return (
    <ValidatedForm className={`stack profile-form${onCancel ? " profile-form-dialog" : ""}`} onSubmit={submit}>
      <ProfileSection title={onCancel ? undefined : "Profile"} inDialog={!!onCancel}
        description="Record the young person’s details and add the remaining information when it becomes available.">
          <div className="form-grid">
            {field("name", "Young person’s name")}
            {field("dob", "Date of birth", "date")}
          </div>
          <div className="form-grid">
            {field("clientPostcode", "Young person’s postcode", "text", "Four digits, if known.")}
            {select("clientGender", "Gender", GENDER_OPTIONS)}
          </div>
          <div className="form-grid">
            {select("clientSexuality", "Sexual orientation", SEXUALITY_OPTIONS)}
            {select("clientAtsiStatus", "Aboriginal and/or Torres Strait Islander", ATSI_OPTIONS)}
          </div>
          <div className="form-grid">
            {field("clientCountryOfBirth", "Country of birth")}
            {field("clientLanguageHome", "Language spoken at home")}
          </div>
          <div className="form-grid">
            {field("clientEthnicity", "Main cultural background other than Australian or Aboriginal and Torres Strait Islander")}
            {select("clientEducationLevel", "Highest education level at episode", EDUCATION_OPTIONS)}
          </div>
      </ProfileSection>
      <ProfileSection title="Registered centre" inDialog={!!onCancel}
        description="The centre associated with this record; leave unknown details blank.">
          <div className="form-grid">
            {field("registeredCentreName", "Centre name")}
            {select("registeredCentreState", "Centre state or territory", REGISTERED_CENTRE_STATES)}
          </div>
          <div className="form-grid">
            {field("registeredCentrePostcode", "Centre postcode", "text", "Four digits, if known.")}
          </div>
      </ProfileSection>
      <ProfileSection title="Episode dates and referral" inDialog={!!onCancel}
        description={`Current episode · ${episode.programStream || "General"} stream`}>
          <div className="form-grid">
            {field("commencementDate", "Service commencement date", "date")}
            {field("referralDate", "Referral date", "date")}
          </div>
          <div className="form-grid">
            {select("source", "Referral source", REFERRAL_SOURCES)}
          </div>
          <div className="form-grid">
            {field("commencementDateUhr", "Clinician-recorded UHR commencement date", "date")}
            {field("commencementDateFep", "Clinician-recorded FEP commencement date", "date")}
          </div>
      </ProfileSection>
      <ProfileSection title="Participation and contact" inDialog={!!onCancel}>
          <p>Assessment participation: <strong>{person.consent}</strong> · Contact suitability: <strong>{person.contact}</strong></p>
          <ActionGroup className="button-row"><Button type="button" onClick={() => openModal({ type: "consent", personId: person.id })}>Update participation & contact</Button></ActionGroup>
      </ProfileSection>
      {error && <Notice tone="amber">{error}</Notice>}
      {message && <p role="status" className="form-save-success">{message}</p>}
      {onCancel ? <ModalFooter>
        <Button type="button" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={person.archivedAt || person.readOnly || episode.readOnly}>Save profile</Button>
      </ModalFooter> :
        <ActionGroup className="button-row"><Button variant="primary" type="submit" disabled={person.archivedAt || person.readOnly || episode.readOnly}>Save profile</Button></ActionGroup>}
    </ValidatedForm>
  );
}
