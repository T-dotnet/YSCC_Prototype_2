import { displayMeasureVersion } from '../terminology.js';
import { SortableHeader, useQueueSort } from "./QueueControls";
import { cloneElement, useEffect, useId, useRef, useState } from 'react';
import { episodeWithVisibleContacts } from "../assessmentFeatures.js";
import { contactsForAssessments } from '../assessmentContacts';
import { earliestPendingAssessment } from '../assessmentDue';
import { INSTRUMENTS, STANDARD_INSTRUMENTS, getInstrument } from '../instruments';
import InstrumentPreview from './InstrumentPreview';
import { formatDate, TODAY } from '../model';
import { responseDate } from '../progress';
import { LABELS, displayTerminology } from '../terminology';
import RelatedRecordsTable from './RelatedRecordsTable';
import { RecordFacts } from './RecordItem';
import { ActionGroup, Badge, Button, EditAction, Field, Modal, ModalFooter, Select, Tabs, TextLink } from './UI';
import ConfirmRemoval from './ConfirmRemoval';

export default function AssessmentBundleDetails({ group, episode, delivery, statusFor, showDueDates, hideRequirement = false, showContacts = true,
  canEdit, onEdit, onClose, onCollect, canCollect, scheduleAssessments = true, assessmentEditor, onAddInstrument, onRemoveInstrument, onArchive, onNotRequired, embedded = false }) {
  const { sort, toggleSort } = useQueueSort({ key: null, direction: 'asc' });
  const [reasonMode, setReasonMode] = useState(false);
  const [archiveConfirmation, setArchiveConfirmation] = useState(false);
  const [removeConfirmation, setRemoveConfirmation] = useState(null);
  const [reason, setReason] = useState('');
  const [postponedDate, setPostponedDate] = useState('');
  const [addVersion, setAddVersion] = useState('');
  const [activeTab, setActiveTab] = useState('assessments');
  useEffect(() => {
    if (!showContacts && activeTab === 'contacts') setActiveTab('assessments');
  }, [showContacts, activeTab]);
  const visibleTab = showContacts ? activeTab : 'assessments';
  const [previewRecord, setPreviewRecord] = useState(null);
  const previewTriggers = useRef(new Map());
  const returnFocusRecord = useRef(null);
  useEffect(() => {
    if (!previewRecord && returnFocusRecord.current) {
      previewTriggers.current.get(returnFocusRecord.current)?.focus();
      returnFocusRecord.current = null;
    }
  }, [previewRecord]);
  const tabsId = useId();
  episode = episodeWithVisibleContacts(episode, { scheduleAssessments });
  const dates = [...new Set(group.records.map(record => record.due).filter(Boolean))].sort();
  const bundleDue = earliestPendingAssessment(group.records)?.due || dates.at(-1);
  const pendingRecord = group.records.find(record => !record.notRequiredReason && record.response === 'Draft') || group.records.find(record => !record.notRequiredReason && record.response !== 'Submitted');
  const individual = group.key === 'individual';
  const contacts = contactsForAssessments(episode, group.records).sort((a,b) =>
    (b.contact.actualDate || b.contact.plannedDate || '').localeCompare(a.contact.actualDate || a.contact.plannedDate || ''));
  const requestArchive = onArchive ? () => setArchiveConfirmation(true) : null;
  const archiveRecord = archiveConfirmation && typeof archiveConfirmation === 'object' ? archiveConfirmation : null;
  if (archiveConfirmation) return <Modal title={archiveRecord ? 'Archive measure?' : 'Archive Collection Occasion?'} subtitle={archiveRecord ? getInstrument(archiveRecord.version)?.name || archiveRecord.label : group.name} className="assessment-not-required-modal" wide onClose={()=>setArchiveConfirmation(false)}>
    <div className="form-body"><p>{archiveRecord ? 'This measure will move to the archive. Its saved response will be retained.' : 'This Collection Occasion and its measures will move to the archive. Saved responses will be retained.'}</p></div>
    <ModalFooter><Button type="button" onClick={()=>setArchiveConfirmation(false)}>Cancel</Button><Button type="button" variant="primary" onClick={()=>{onArchive(archiveRecord);setArchiveConfirmation(false);}}>{archiveRecord ? 'Archive measure' : 'Archive Collection Occasion'}</Button></ModalFooter>
  </Modal>;
  if (removeConfirmation) return <ConfirmRemoval
    item={{ name: getInstrument(removeConfirmation.version)?.name || removeConfirmation.label, type: 'measure',
      description: 'This untouched measure will be removed from this person’s Assessment Pack.' }}
    onCancel={() => setRemoveConfirmation(null)}
    onConfirm={() => { onRemoveInstrument?.(removeConfirmation); setRemoveConfirmation(null); }} />;
  const notRequiredAction = onNotRequired && <Button variant="ghost" className="assessment-not-required-action" onClick={()=>setReasonMode(true)}>Mark as not required or postpone</Button>;
  if (reasonMode) return <Modal title="Mark Collection Occasion as not required or postpone" subtitle={group.name} className="assessment-not-required-modal" wide onClose={onClose}>
    <form onSubmit={event=>{event.preventDefault();if(reason.trim() && (!postponedDate || postponedDate > TODAY && postponedDate > bundleDue)) onNotRequired(reason.trim(), postponedDate);}}>
      <div className="form-body"><Field label="Reason"><textarea required rows={4} value={reason} onChange={event=>setReason(event.target.value)} /></Field>
        <Field label="Postpone until (optional)" hint="Choose a future date to keep this Collection Occasion active. Leave blank to mark it as not required."><input type="date" min={[TODAY, bundleDue || ''].sort().at(-1)} value={postponedDate} onChange={event=>setPostponedDate(event.target.value)} /></Field>
        <p className="muted">Existing measures and responses will be retained.</p></div>
        <ModalFooter><Button type="button" onClick={()=>setReasonMode(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={!reason.trim() || !!postponedDate && (postponedDate <= TODAY || postponedDate <= bundleDue)}>{postponedDate ? 'Postpone Collection Occasion' : 'Mark as not required'}</Button></ModalFooter>
    </form>
  </Modal>;
  if (previewRecord) return <Modal title="Measure preview" subtitle={`${getInstrument(previewRecord.version)?.name || previewRecord.label} · ${displayMeasureVersion(previewRecord.version)}`} onClose={()=>setPreviewRecord(null)} closeLabel="Close preview" className="questionnaire-preview-modal">
    <InstrumentPreview key={previewRecord.id} instrument={getInstrument(previewRecord.version)} respondent={previewRecord.respondent || delivery.recipient} onBack={()=>setPreviewRecord(null)} backLabel="Back to measure details" />
  </Modal>;
  const content = <>
    <div className="form-body new-assessment-bundle-body">
      {group.records.some(record=>record.notRequiredReason) && <p className="notice">Not required: {group.records.find(record=>record.notRequiredReason)?.notRequiredReason}</p>}
    {!embedded && <section aria-label="Collection Occasion settings">
        <RecordFacts columns={2} facts={[
          { label: LABELS.respondent, value: delivery.recipient },
          ...(showDueDates ? [{ label: 'Due date', value: bundleDue ? formatDate(bundleDue) : 'Not set' }] : []),
        ]} />
      </section>}
      <div className="assessment-bundle-details-tabs">
        {showContacts && <Tabs id={tabsId} label="Collection Occasion details" items={[
          { value: 'assessments', label: 'Measures' },
          { value: 'contacts', label: 'Contacts' },
        ]} value={visibleTab} onChange={setActiveTab} />}
        <div id={showContacts ? `${tabsId}-panel` : undefined} role={showContacts ? 'tabpanel' : undefined}
          aria-labelledby={showContacts ? `${tabsId}-tab-${visibleTab === 'assessments' ? 0 : 1}` : undefined}>
          {assessmentEditor && <div hidden={visibleTab !== 'assessments'}>{cloneElement(assessmentEditor, {assessmentAction:group,onMarkNotRequired:onNotRequired ? ()=>setReasonMode(true) : null,onArchive:requestArchive})}</div>}
          {visibleTab === 'assessments' && !assessmentEditor && <>
            <RelatedRecordsTable label={`Measures in ${group.name}`} compact className={individual ? 'individual-instruments-table' : ''}>
              <thead><tr><th scope="col">Measure</th><SortableHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />{!hideRequirement && !individual && <th scope="col">Requirement</th>}<th scope="col">Action</th></tr></thead>
              <tbody>{[...group.records].sort((a,b) => sort.key === 'status' ? (sort.direction === 'asc' ? 1 : -1) * statusFor(a).localeCompare(statusFor(b)) : 0).map(record => {
                const submitted = responseDate(record);
                return <tr key={record.id}>
                  <td>{getInstrument(record.version)?.name || record.label}
                    {submitted && <small>Completed {formatDate(submitted)}</small>}
                  </td>
                  <td><Badge>{statusFor(record)}</Badge></td>
                  {!hideRequirement && !individual && <td>{record.bundleRequirement || 'Individual'}</td>}
                  <td data-label="Action"><ActionGroup className="assessment-instrument-actions">
                    <TextLink className="assessment-instrument-preview" aria-label={`Preview ${getInstrument(record.version)?.name || record.label}`} ref={node => {if (node) previewTriggers.current.set(record.id, node); else previewTriggers.current.delete(record.id);}} onClick={()=>{returnFocusRecord.current = record.id; setPreviewRecord(record);}}>Preview</TextLink>
                    {individual && <Button variant="ghost" disabled={!onArchive} aria-label={`Archive ${getInstrument(record.version)?.name || record.label}`} onClick={()=>setArchiveConfirmation(record)}>Archive</Button>}
                    {onRemoveInstrument && <Button variant="ghost" disabled={group.records.length < 2 || record.response !== 'Not started' || record.assignment !== 'Planned' || record.attempts?.length > 0 || record.answers?.some(Boolean) || record.draftAnswers?.some(Boolean)}
                      aria-label={`Remove ${getInstrument(record.version)?.name || record.label}`} onClick={()=>setRemoveConfirmation(record)}>Remove</Button>}
                  </ActionGroup></td>
                </tr>;
              })}</tbody>
            </RelatedRecordsTable>
            {onAddInstrument && <ActionGroup className="assessment-group-add-instrument">
              <div className="field"><Select label="Measure to add" value={addVersion} onChange={event=>setAddVersion(event.target.value)}>
                <option value="">Choose a measure</option>
                {(onRemoveInstrument ? INSTRUMENTS.filter(instrument=>instrument.respondents.includes(group.records[0]?.mvpRespondent)) : STANDARD_INSTRUMENTS)
                  .filter(instrument=>!group.records.some(record=>record.version === instrument.version)).map(instrument=><option key={instrument.version} value={instrument.version}>{instrument.name}</option>)}
              </Select></div>
              <Button disabled={!addVersion} onClick={()=>{onAddInstrument(addVersion);setAddVersion('');}}>Add measure</Button>
            </ActionGroup>}
          </>}
          {showContacts && visibleTab === 'contacts' && <>
            <RelatedRecordsTable label={`Contacts associated with ${group.name}`} compact className="assessment-contacts-table">
              <thead><tr><th scope="col">Date</th><th scope="col">Measure name</th><th scope="col">Contact</th><th scope="col">Status / outcome</th></tr></thead>
              <tbody>{contacts.length ? contacts.map(({contact, assessments}) => {
                const date = contact.actualDate || contact.plannedDate;
                const assessmentNames = [...new Set(assessments.map(assessment => getInstrument(assessment.version)?.name || assessment.label).filter(Boolean))];
                return <tr key={contact.id}>
                  <td data-label="Date">{date ? formatDate(date) : 'Not recorded'}{!contact.actualDate && contact.plannedDate && <small>Planned</small>}</td>
                  <td data-label="Measure">{assessmentNames.map(name => <div key={name}>{name}</div>)}</td>
                  <td data-label="Contact">{contact.contactType || contact.appointmentType || contact.practitionerService || 'Service contact'}
                    {contact.practitionerService && (contact.contactType || contact.appointmentType) && <small>{contact.practitionerService}</small>}
                  </td>
                  <td data-label="Status"><Badge>{contact.attendance || 'Not recorded'}</Badge></td>
                </tr>;
              }) : <tr><td colSpan={4} className="muted">No contacts associated with these measures.</td></tr>}</tbody>
            </RelatedRecordsTable>
          </>}
        </div>
      </div>
    </div>
    {!embedded && (!assessmentEditor || visibleTab === 'contacts') && <ModalFooter>
      {onEdit && !assessmentEditor && <EditAction disabled={!canEdit} onClick={onEdit}>Edit Collection Occasion</EditAction>}
      {notRequiredAction}
      {onArchive && !individual && <Button variant="ghost" className="assessment-tertiary-action assessment-archive-action" onClick={requestArchive}>Archive Collection Occasion</Button>}
      <Button onClick={onClose}>Close</Button>
      {onCollect && pendingRecord && <Button variant="primary" disabled={canCollect && !canCollect(pendingRecord)} onClick={()=>onCollect(pendingRecord)}>Collect response</Button>}
    </ModalFooter>}
  </>;
  if (embedded) return <div className="assessment-bundle-inline-details">{content}</div>;
  return <Modal title={displayTerminology(group.name)} subtitle={individual ? 'Individual measure details' : 'Collection Occasion details'} wide onClose={onClose} className="new-assessment-bundle-modal assessment-bundle-details-modal">{content}</Modal>;
}
