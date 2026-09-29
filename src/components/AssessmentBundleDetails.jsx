import { SortableHeader, useQueueSort } from "./QueueControls";
import { useId, useState } from 'react';
import { episodeWithVisibleContacts } from "../assessmentFeatures.js";
import { contactsForAssessments } from '../assessmentContacts';
import { earliestPendingAssessment } from '../assessmentDue';
import { INSTRUMENTS, getInstrument } from '../instruments';
import { formatDate } from '../model';
import { responseDate } from '../progress';
import { LABELS } from '../terminology';
import RelatedRecordsTable from './RelatedRecordsTable';
import { RecordFacts } from './RecordItem';
import { ActionGroup, Badge, Button, EditAction, Modal, Select, Tabs } from './UI';

export default function AssessmentBundleDetails({ group, episode, delivery, statusFor, showDueDates,
  canEdit, onEdit, onClose, scheduleAssessments = true, assessmentEditor, onAddInstrument, onArchive, embedded = false }) {
  const { sort, toggleSort } = useQueueSort({ key: null, direction: 'asc' });
  const [addVersion, setAddVersion] = useState('');
  const [activeTab, setActiveTab] = useState('assessments');
  const tabsId = useId();
  episode = episodeWithVisibleContacts(episode, { scheduleAssessments });
  const dates = [...new Set(group.records.map(record => record.due).filter(Boolean))].sort();
  const bundleDue = earliestPendingAssessment(group.records)?.due || dates.at(-1);
  const individual = group.key === 'individual';
  const contacts = contactsForAssessments(episode, group.records).sort((a,b) =>
    (b.contact.actualDate || b.contact.plannedDate || '').localeCompare(a.contact.actualDate || a.contact.plannedDate || ''));
  const content = <>
    <div className="form-body new-assessment-bundle-body">
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
          {assessmentEditor && <div hidden={activeTab !== 'assessments'}>{assessmentEditor}</div>}
          {activeTab === 'assessments' && !assessmentEditor && <>
            <RelatedRecordsTable label={`Instruments in ${group.name}`} compact>
              <thead><tr><th scope="col">Instrument</th><SortableHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} /><th scope="col">Requirement</th></tr></thead>
              <tbody>{[...group.records].sort((a,b) => sort.key === 'status' ? (sort.direction === 'asc' ? 1 : -1) * statusFor(a).localeCompare(statusFor(b)) : 0).map(record => {
                const submitted = responseDate(record);
                return <tr key={record.id}>
                  <td>{getInstrument(record.version)?.name || record.label}
                    {submitted && <small>Completed {formatDate(submitted)}</small>}
                  </td>
                  <td><Badge>{statusFor(record)}</Badge></td>
                  <td>{record.bundleRequirement || 'Individual'}</td>
                </tr>;
              })}</tbody>
            </RelatedRecordsTable>
            {onAddInstrument && <ActionGroup className="assessment-group-add-instrument">
              <Select label="Instrument to add" value={addVersion} onChange={event=>setAddVersion(event.target.value)}>
                <option value="">Choose an instrument</option>
                {INSTRUMENTS.filter(instrument=>!group.records.some(record=>record.version === instrument.version)).map(instrument=><option key={instrument.version} value={instrument.version}>{instrument.name}</option>)}
              </Select>
              <Button disabled={!addVersion} onClick={()=>{onAddInstrument(addVersion);setAddVersion('');}}>Add instrument</Button>
            </ActionGroup>}
          </>}
          {activeTab === 'contacts' && <>
            <RelatedRecordsTable label={`Contacts associated with ${group.name}`} compact>
              <thead><tr><th scope="col">Date</th><th scope="col">Contact</th><th scope="col">Status / outcome</th></tr></thead>
              <tbody>{contacts.length ? contacts.map(({contact}) => {
                const date = contact.actualDate || contact.plannedDate;
                return <tr key={contact.id}>
                  <td>{date ? formatDate(date) : 'Not recorded'}{!contact.actualDate && contact.plannedDate && <small>Planned</small>}</td>
                  <td>{contact.contactType || contact.appointmentType || contact.practitionerService || 'Service contact'}
                    {contact.practitionerService && (contact.contactType || contact.appointmentType) && <small>{contact.practitionerService}</small>}
                  </td>
                  <td><Badge>{contact.attendance || 'Not recorded'}</Badge></td>
                </tr>;
              }) : <tr><td colSpan={3} className="muted">No contacts associated with these instruments.</td></tr>}</tbody>
            </RelatedRecordsTable>
          </>}
        </div>
      </div>
    </div>
    {onArchive && assessmentEditor && <ActionGroup className="modal-footer"><Button onClick={onArchive}>Archive assessment</Button></ActionGroup>}
    {!embedded && (!assessmentEditor || activeTab === 'contacts') && <ActionGroup className="modal-footer">
      {onEdit && !assessmentEditor && <EditAction disabled={!canEdit} onClick={onEdit}>Edit assessment</EditAction>}
      {onArchive && <Button onClick={onArchive}>Archive assessment</Button>}
      <Button onClick={onClose}>Close</Button>
    </ActionGroup>}
  </>;
  if (embedded) return <div className="assessment-bundle-inline-details">{content}</div>;
  return <Modal title={group.name} subtitle={individual ? 'Instrument group details' : 'Assessment details'} wide onClose={onClose} className="new-assessment-bundle-modal assessment-bundle-details-modal">{content}</Modal>;
}
