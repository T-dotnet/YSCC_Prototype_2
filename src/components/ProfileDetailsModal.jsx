import { useState } from "react";
import { formatDate } from "../model";
import { ageAtCommencement, derivedEpisodeStatus, derivedEpisodeStream } from "../batch1Registration";
import { patientIdentifier } from "../patientIdentity";
import Profile, { initialValues } from "../features/Profile";
import { useStore } from "../store";
import { ActionGroup, Button, EditAction, Field, Modal, ModalFooter } from "./UI";

const recorded = value => value || "Not recorded";
const date = value => value ? formatDate(value) : "Not recorded";

function SummarySection({ title, rows }) {
  return <section className="intake-details-section">
    {title && <h3>{title}</h3>}
    <dl className="intake-details-grid">
      {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
  </section>;
}

export default function ProfileDetailsModal({ person, episode, intake, settings, openModal, onClose }) {
  const { commit } = useStore();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [archiveMode, setArchiveMode] = useState(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const values = initialValues(person, episode, intake);
  const context = { ...values, status: intake?.status };
  const canEdit = !person.archivedAt && !person.readOnly && !episode.readOnly;
  const canChangeArchive = !person.readOnly;
  const beginArchive = mode => {
    setReason("");
    setError("");
    setArchiveMode(mode);
  };
  const changeArchive = () => {
    const archived = archiveMode === "archive";
    const result = commit({
      type: archived ? "ARCHIVE_PERSON" : "RESTORE_PERSON",
      personId: person.id,
      reason: reason.trim(),
    });
    if (result.error) return setError(result.error);
    setNotice(archived
      ? "Person archived. The record is available in the Archived People filter."
      : "Person restored to active People and work views.");
    setArchiveMode(null);
    setReason("");
    setError("");
  };

  return <Modal title={editing ? "Edit profile" : "Profile information"}
    subtitle={patientIdentifier(person)} onClose={onClose} wide className="profile-details-dialog">
    {archiveMode ? <div className="intake-confirmation">
      <div className="form-body">
        <h3>{archiveMode === "archive" ? "Archive this patient?" : "Restore this patient?"}</h3>
        <p>{archiveMode === "archive"
          ? `${patientIdentifier(person)} will leave active People and work views. Contacts, assessments and intake history will remain in the record, which can be restored from the Archived filter.`
          : `${patientIdentifier(person)} will return to active People and work views with the existing care record preserved.`}</p>
        <Field label={archiveMode === "archive" ? "Reason for archiving" : "Reason for restoring"}>
          <textarea rows={3} required value={reason} onChange={event => setReason(event.target.value)} />
        </Field>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
      <ModalFooter className="intake-details-actions">
        <Button type="button" onClick={() => { setError(""); setArchiveMode(null); }}>Back</Button>
        <Button type="button" variant="primary" className={archiveMode === "archive" ? "intake-confirm-archive-button" : ""}
          disabled={!reason.trim()} onClick={changeArchive}>
          {archiveMode === "archive" ? "Confirm archive" : "Confirm restore"}
        </Button>
      </ModalFooter>
    </div> : editing ? <div className="form-body profile-edit-body">
      <Profile key={`${person.id}:${episode.id}`} person={person} episode={episode} intake={intake}
        openModal={openModal} onSaved={() => { setSaved(true); setEditing(false); }}
        onCancel={() => setEditing(false)} />
    </div> : <>
      <div className="form-body intake-details-body">
        {saved && <p className="form-save-success" role="status">Profile saved.</p>}
        {notice && <p className="form-save-success" role="status">{notice}</p>}
        <SummarySection rows={[
          ["Name", recorded(values.name)],
          ["Date of birth", date(values.dob)],
          ["Gender", recorded(values.clientGender)],
          ["Postcode", recorded(values.clientPostcode)],
          ["Aboriginal and/or Torres Strait Islander", recorded(values.clientAtsiStatus)],
          ["Language spoken at home", recorded(values.clientLanguageHome)],
          ["Sexual orientation", recorded(values.clientSexuality)],
          ["Country of birth", recorded(values.clientCountryOfBirth)],
          ["Main cultural background other than Australian or Aboriginal and Torres Strait Islander", recorded(values.clientEthnicity)],
          ["Highest education level at episode", recorded(values.clientEducationLevel)],
        ]} />
        <SummarySection title="Care episode" rows={[
          ["Person record ID", person.id],
          ["Episode number", recorded(episode.number)],
          ["Current status", derivedEpisodeStatus(context, episode, settings)],
          ["Calculated program stream", derivedEpisodeStream(context, episode)],
          ["Age at service commencement", ageAtCommencement(values.dob, values.commencementDate) ?? "Not available"],
          ["Service commencement date", date(values.commencementDate)],
          ["Clinician-recorded UHR commencement date", date(values.commencementDateUhr)],
          ["Clinician-recorded FEP commencement date", date(values.commencementDateFep)],
          ["Referral date", date(values.referralDate)],
          ["Referral source", recorded(values.source)],
        ]} />
        <SummarySection title="Registered centre" rows={[
          ["Centre name", recorded(values.registeredCentreName)],
          ["State or territory", recorded(values.registeredCentreState)],
          ["Centre postcode", recorded(values.registeredCentrePostcode)],
        ]} />
        <SummarySection title="Participation and contact" rows={[
          ["Assessment participation", recorded(person.consent)],
          ["Contact suitability", recorded(person.contact)],
        ]} />
      </div>
      <ModalFooter className="intake-details-actions">
        {canChangeArchive && (person.archivedAt
          ? <Button type="button" className="intake-restore-button" onClick={() => beginArchive("restore")}>Restore patient</Button>
          : <Button type="button" className="intake-archive-button" onClick={() => beginArchive("archive")}>Archive patient</Button>)}
        <ActionGroup>
          {canEdit && <EditAction onClick={() => { setSaved(false); setEditing(true); }}>Edit profile</EditAction>}
          <Button onClick={onClose}>Close</Button>
        </ActionGroup>
      </ModalFooter>
    </>}
  </Modal>;
}
