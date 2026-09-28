import { SortableHeader, useQueueSort } from "./QueueControls";
import { useId, useState } from 'react';
import { episodeWithVisibleContacts } from "../assessmentFeatures.js";
import { contactsForAssessments } from '../assessmentContacts';
import { earliestPendingAssessment } from '../assessmentDue';
import { getInstrument } from '../instruments';
import { formatDate } from '../model';
import { responseDate } from '../progress';
import { LABELS } from '../terminology';
import RelatedRecordsTable from './RelatedRecordsTable';
import { RecordFacts } from './RecordItem';
import { ActionGroup, Badge, Button, EditAction, Modal, Tabs } from './UI';

export default function AssessmentBundleDetails({ group, episode, delivery, statusFor, showDueDates,
  canEdit, onEdit, onClose, scheduleAssessments = true, assessmentEditor }) {
  const { sort, toggleSort } = useQueueSort({ key: null, direction: 'asc' });
  const [activeTab, setActiveTab] = useState('assessments');
  const tabsId = useId();
  episode = episodeWithVisibleContacts(episode, { scheduleAssessments });
  const dates = [...new Set(group.records.map(record => record.due).filter(Boolean))].sort();
  const bundleDue = earliestPendingAssessment(group.records)?.due || dates.at(-1);
  const individual = group.key === 'individual';
  const contacts = contactsForAssessments(episode, group.records).sort((a,b) =>
    (b.contact.actualDate || b.contact.plannedDate || '').localeCompare(a.contact.actualDate || a.contact.plannedDate || ''));
  return <Modal title={group.name} subtitle={individual ? 'Assessment group details' : 'Bundle details'} wide onClose={onClose} className="new-assessment-bundle-modal assessment-bundle-details-modal">
    <div className="form-body new-assessment-bundle-body">
      <section aria-label="Collection settings">
        <RecordFacts columns={2} facts={[
          { label: LABELS.respondent, value: delivery.recipient },
          ...(showDueDates ? [{ label: 'Due date', value: bundleDue ? formatDate(bundleDue) : 'Not set' }] : []),
        ]} />
      </section>
      <div className="assessment-bundle-details-tabs">
        <Tabs id={tabsId} label="Bundle details" items={[
          { value: 'assessments', label: 'Assessments' },
          { value: 'contacts', label: 'Contacts' },
        ]} value={activeTab} onChange={setActiveTab} />
        <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-tab-${activeTab === 'assessments' ? 0 : 1}`}>
          {assessmentEditor && <div hidden={activeTab !== 'assessments'}>{assessmentEditor}</div>}
          {activeTab === 'assessments' && !assessmentEditor && <>
            <RelatedRecordsTable label={`Assessments in ${group.name}`} compact>
              <thead><tr><th scope="col">Assessment</th><SortableHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} /><th scope="col">Requirement</th></tr></thead>
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
              }) : <tr><td colSpan={3} className="muted">No contacts associated with these assessments.</td></tr>}</tbody>
            </RelatedRecordsTable>
          </>}
        </div>
      </div>
    </div>
    {(!assessmentEditor || activeTab === 'contacts') && <ActionGroup className="modal-footer">
      {onEdit && !assessmentEditor && <EditAction disabled={!canEdit} onClick={onEdit}>Edit bundle</EditAction>}
      <Button onClick={onClose}>Close</Button>
    </ActionGroup>}
  </Modal>;
}
