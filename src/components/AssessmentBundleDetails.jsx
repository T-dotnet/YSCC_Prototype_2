import { SortableHeader, useQueueSort } from "./QueueControls";
import { cloneElement, useId, useState } from 'react';
import { episodeWithVisibleContacts } from "../assessmentFeatures.js";
import { contactsForAssessments } from '../assessmentContacts';
import { earliestPendingAssessment } from '../assessmentDue';
import { INSTRUMENTS, getInstrument } from '../instruments';
import { formatDate } from '../model';
import { responseDate } from '../progress';
import { LABELS } from '../terminology';
import RelatedRecordsTable from './RelatedRecordsTable';
import { RecordFacts } from './RecordItem';
import { ActionGroup, Badge, Button, EditAction, Field, Modal, ModalFooter, Select, Tabs } from './UI';

export default function AssessmentBundleDetails({ group, episode, delivery, statusFor, showDueDates,
  canEdit, onEdit, onClose, scheduleAssessments = true, assessmentEditor, onAddInstrument, onArchive, onNotRequired, embedded = false }) {
  const { sort, toggleSort } = useQueueSort({ key: null, direction: 'asc' });
  const [reasonMode, setReasonMode] = useState(false);
  const [archiveConfirmation, setArchiveConfirmation] = useState(false);
  const [reason, setReason] = useState('');
  const [addVersion, setAddVersion] = useState('');
  const [activeTab, setActiveTab] = useState('assessments');
  const tabsId = useId();
  episode = episodeWithVisibleContacts(episode, { scheduleAssessments });
  const dates = [...new Set(group.records.map(record => record.due).filter(Boolean))].sort();
  const bundleDue = earliestPendingAssessment(group.records)?.due || dates.at(-1);
  const individual = group.key === 'individual';
  const contacts = contactsForAssessments(episode, group.records).sort((a,b) =>
    (b.contact.actualDate || b.contact.plannedDate || '').localeCompare(a.contact.actualDate || a.contact.plannedDate || ''));
  const requestArchive = onArchive ? () => setArchiveConfirmation(true) : null;
  const archiveRecord = archiveConfirmation && typeof archiveConfirmation === 'object' ? archiveConfirmation : null;
  if (archiveConfirmation) return <Modal title={archiveRecord ? 'Archive instrument?' : 'Archive assessment?'} subtitle={archiveRecord ? getInstrument(archiveRecord.version)?.name || archiveRecord.label : group.name} className="assessment-not-required-modal" wide onClose={()=>setArchiveConfirmation(false)}>
    <div className="form-body"><p>{archiveRecord ? 'This instrument will move to the archive. Saved responses will be retained.' : 'This assessment and its instruments will move to the archive. Saved responses will be retained.'}</p></div>
    <ModalFooter><Button type="button" onClick={()=>setArchiveConfirmation(false)}>Cancel</Button><Button type="button" variant="primary" onClick={()=>{onArchive(archiveRecord);setArchiveConfirmation(false);}}>{archiveRecord ? 'Archive instrument' : 'Archive assessment'}</Button></ModalFooter>
  </Modal>;
  const notRequiredAction = onNotRequired && <Button variant="ghost" className="assessment-not-required-action" onClick={()=>setReasonMode(true)}>Mark as not required</Button>;
  if (reasonMode) return <Modal title="Mark assessment as not required" subtitle={group.name} className="assessment-not-required-modal" wide onClose={onClose}>
    <form onSubmit={event=>{event.preventDefault();if(reason.trim()) onNotRequired(reason.trim());}}>
      <div className="form-body"><Field label="Reason"><textarea required rows={4} value={reason} onChange={event=>setReason(event.target.value)} /></Field>
        <p className="muted">Existing instruments and responses will be retained.</p></div>
      <ModalFooter><Button type="button" onClick={()=>setReasonMode(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={!reason.trim()}>Mark as not required</Button></ModalFooter>
    </form>
  </Modal>;
  const content = <>
    <div className="form-body new-assessment-bundle-body">
      {group.records.some(record=>record.notRequiredReason) && <p className="notice">Not required: {group.records.find(record=>record.notRequiredReason)?.notRequiredReason}</p>}
      {!embedded && <section aria-label="Collection settings">
        <RecordFacts columns={2} facts={[
          { label: LABELS.respondent, value: delivery.recipient },
          ...(showDueDates ? [{ label: 'Due date', value: bundleDue ? formatDate(bundleDue) : 'Not set' }] : []),
        ]} />
      </section>}
      <div className="assessment-bundle-details-tabs">
        <Tabs id={tabsId} label="Assessment details" items={[
          { value: 'assessments', label: 'Instruments' },
          { value: 'contacts', label: 'Contacts' },
        ]} value={activeTab} onChange={setActiveTab} />
        <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-tab-${activeTab === 'assessments' ? 0 : 1}`}>
          {assessmentEditor && <div hidden={activeTab !== 'assessments'}>{cloneElement(assessmentEditor, {assessmentAction:group,onMarkNotRequired:onNotRequired ? ()=>setReasonMode(true) : null,onArchive:requestArchive})}</div>}
          {activeTab === 'assessments' && !assessmentEditor && <>
            <RelatedRecordsTable label={`Instruments in ${group.name}`} compact className={individual ? 'individual-instruments-table' : ''}>
              <thead><tr><th scope="col">Instrument</th><SortableHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} /><th scope="col">{individual ? 'Actions' : 'Requirement'}</th></tr></thead>
              <tbody>{[...group.records].sort((a,b) => sort.key === 'status' ? (sort.direction === 'asc' ? 1 : -1) * statusFor(a).localeCompare(statusFor(b)) : 0).map(record => {
                const submitted = responseDate(record);
                return <tr key={record.id}>
                  <td>{getInstrument(record.version)?.name || record.label}
                    {submitted && <small>Completed {formatDate(submitted)}</small>}
                  </td>
                  <td><Badge>{statusFor(record)}</Badge></td>
                  <td>{individual ? <Button variant="ghost" disabled={!onArchive} aria-label={`Archive ${getInstrument(record.version)?.name || record.label}`} onClick={()=>setArchiveConfirmation(record)}>Archive</Button> : record.bundleRequirement || 'Individual'}</td>
                </tr>;
              })}</tbody>
            </RelatedRecordsTable>
            {onAddInstrument && <ActionGroup className="assessment-group-add-instrument">
              <div className="field"><Select label="Instrument to add" value={addVersion} onChange={event=>setAddVersion(event.target.value)}>
                <option value="">Choose an instrument</option>
                {INSTRUMENTS.filter(instrument=>!group.records.some(record=>record.version === instrument.version)).map(instrument=><option key={instrument.version} value={instrument.version}>{instrument.name}</option>)}
              </Select></div>
              <Button disabled={!addVersion} onClick={()=>{onAddInstrument(addVersion);setAddVersion('');}}>Add instrument</Button>
            </ActionGroup>}
          </>}
          {activeTab === 'contacts' && <>
            <RelatedRecordsTable label={`Contacts associated with ${group.name}`} compact className="assessment-contacts-table">
              <thead><tr><th scope="col">Date</th><th scope="col">Assessment name</th><th scope="col">Contact</th><th scope="col">Status / outcome</th></tr></thead>
              <tbody>{contacts.length ? contacts.map(({contact, assessments}) => {
                const date = contact.actualDate || contact.plannedDate;
                const assessmentNames = [...new Set(assessments.map(assessment => getInstrument(assessment.version)?.name || assessment.label).filter(Boolean))];
                return <tr key={contact.id}>
                  <td data-label="Date">{date ? formatDate(date) : 'Not recorded'}{!contact.actualDate && contact.plannedDate && <small>Planned</small>}</td>
                  <td data-label="Assessment">{assessmentNames.map(name => <div key={name}>{name}</div>)}</td>
                  <td data-label="Contact">{contact.contactType || contact.appointmentType || contact.practitionerService || 'Service contact'}
                    {contact.practitionerService && (contact.contactType || contact.appointmentType) && <small>{contact.practitionerService}</small>}
                  </td>
                  <td data-label="Status"><Badge>{contact.attendance || 'Not recorded'}</Badge></td>
                </tr>;
              }) : <tr><td colSpan={4} className="muted">No contacts associated with these instruments.</td></tr>}</tbody>
            </RelatedRecordsTable>
          </>}
        </div>
      </div>
    </div>
    {!embedded && (!assessmentEditor || activeTab === 'contacts') && <ModalFooter>
      {onEdit && !assessmentEditor && <EditAction disabled={!canEdit} onClick={onEdit}>Edit assessment</EditAction>}
      {notRequiredAction}
      {onArchive && !individual && <Button variant="ghost" className="assessment-tertiary-action assessment-archive-action" onClick={requestArchive}>Archive assessment</Button>}
      <Button onClick={onClose}>Close</Button>
    </ModalFooter>}
  </>;
  if (embedded) return <div className="assessment-bundle-inline-details">{content}</div>;
  return <Modal title={group.name} subtitle={individual ? 'Instrument group details' : 'Assessment details'} wide onClose={onClose} className="new-assessment-bundle-modal assessment-bundle-details-modal">{content}</Modal>;
}
