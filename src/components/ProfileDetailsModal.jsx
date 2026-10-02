import { useState } from "react";
import { formatDate } from "../model";
import { ageAtCommencement, derivedEpisodeStatus, derivedEpisodeStream } from "../batch1Registration";
import { patientIdentifier } from "../patientIdentity";
import Profile, { initialValues } from "../features/Profile";
import { Button, EditAction, Modal, ModalFooter } from "./UI";

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

export default function ProfileDetailsModal({ person, episode, intake, openModal, onClose }) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const values = initialValues(person, episode, intake);
  const context = { ...values, status: intake?.status };
  const canEdit = !person.archivedAt && !person.readOnly && !episode.readOnly;

  return <Modal title={editing ? "Edit profile" : "Profile information"}
    subtitle={patientIdentifier(person)} onClose={onClose} wide className="profile-details-dialog">
    {editing ? <div className="form-body profile-edit-body">
      <Profile key={`${person.id}:${episode.id}`} person={person} episode={episode} intake={intake}
        openModal={openModal} onSaved={() => { setSaved(true); setEditing(false); }}
        onCancel={() => setEditing(false)} />
    </div> : <>
      <div className="form-body intake-details-body">
        {saved && <p className="form-save-success" role="status">Profile saved.</p>}
        <SummarySection rows={[
          ["Name", recorded(values.name)],
          ["Date of birth", date(values.dob)],
          ["Gender", recorded(values.clientGender)],
          ["Postcode", recorded(values.clientPostcode)],
          ["Aboriginal and/or Torres Strait Islander", recorded(values.clientAtsiStatus)],
          ["Language spoken at home", recorded(values.clientLanguageHome)],
        ]} />
        <SummarySection title="Care episode" rows={[
          ["Person record ID", person.id],
          ["Episode number", recorded(episode.number)],
          ["Current status", derivedEpisodeStatus(context, episode)],
          ["Calculated program stream", derivedEpisodeStream(context, episode)],
          ["Age at service commencement", ageAtCommencement(values.dob, values.commencementDate) ?? "Not available"],
          ["Service commencement date", date(values.commencementDate)],
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
      <ModalFooter>
        <Button onClick={onClose}>Close</Button>
        {canEdit && <EditAction onClick={() => { setSaved(false); setEditing(true); }}>Edit profile</EditAction>}
      </ModalFooter>
    </>}
  </Modal>;
}
