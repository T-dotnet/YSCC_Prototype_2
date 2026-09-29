import { SortableHeader, useQueueSort } from "./QueueControls";
import { Trash2 } from "lucide-react";
import RelatedRecordsTable from "./RelatedRecordsTable";
import { COLLECTION_METHOD_OPTIONS, LABELS } from "../terminology.js";
import { useState } from 'react';
import { useStore } from '../store';
import { INSTRUMENTS } from '../instruments';
import { responseDate } from '../progress';
import { TODAY, uid, formatDate } from '../model';
import { asBundle, bundleName, uniqueBundleInstanceName, bundleAssessmentUnavailable, bundleAgeMatches, bundleAssessmentsForCreation, bundleDelivery, bundleSelectionForEpisode, newBundleError } from '../assessmentBundles';
import { assessmentSchedulingEnabled, assessmentSmsEnabled } from '../assessmentFeatures';
import { ActionGroup, Badge, Checkbox, IconButton, Modal, Button, Field, Select, Empty, Notice, ValidatedForm } from './UI';
import AssessmentScheduleSettings from "./AssessmentScheduleSettings";
import BundleAssessmentRow from './BundleAssessmentRow';
import AssessmentModalActions from './AssessmentModalActions';

function DeliveryFields({item, person, sms, onChange}) {
  const instrument = item.version ? INSTRUMENTS.find(instrument => instrument.version === item.version) : {respondents:['Person','Family respondent']};
  return <div className="form-grid">
    <Field label={LABELS.collectionMethod}>
      <Select label={LABELS.collectionMethod} value={item.channel} onChange={event => onChange('channel',event.target.value)}>
        {COLLECTION_METHOD_OPTIONS.filter(([value]) => value !== 'SMS link' || sms || item.channel === value).map(([value,label]) =>
          <option key={value} value={value} disabled={value === 'SMS link' && !sms}>{label}{value === 'SMS link' && !sms ? ' (unavailable)' : ''}</option>)}
      </Select>
    </Field>
    <Field label={LABELS.respondent}>
      <Select label={LABELS.respondent} value={item.recipient} onChange={event => onChange('recipient',event.target.value)}>
        {instrument?.respondents.map(recipient => <option key={recipient} value={recipient} disabled={recipient === 'Family respondent' && !person.family}>
          {recipient === 'Person' ? 'Patient' : `Family respondent${!person.family ? ' (not recorded)' : ''}`}
        </option>)}
      </Select>
    </Field>
  </div>;
}

export default function NewAssessmentBundle({ person, episode, onClose, onCreated, editBundleId = null, embedded = false, group, statusFor, assessmentAction, onMarkNotRequired, onArchive, footerAction }) {
  const { state, commit } = useStore();
  const { sort, toggleSort } = useQueueSort({ key: 'requirement', direction: 'asc' });
  const editingBundle = !!editBundleId;
  const [initialSelection] = useState(() => {
    const saved = state.settings?.assessmentScheduleRules?.find(item => item.id === editBundleId);
    return saved ? bundleSelectionForEpisode(asBundle(saved),group?.instanceId ? {...episode,collections:group.records,assessmentBundleSelections:{}} : episode) : {optionalIds:[],assessmentOverrides:[],extraAssessments:[]};
  });
  const [instanceName, setInstanceName] = useState(group?.instanceId ? group.name : '');
  const [bundleId, setBundleId] = useState(editBundleId || '');
  const [optionalIds, setOptionalIds] = useState(initialSelection.optionalIds);
  const [assessmentOverrides, setAssessmentOverrides] = useState(initialSelection.assessmentOverrides);

  const [extras, setExtras] = useState(initialSelection.extraAssessments);
  const [extraVersion, setExtraVersion] = useState('');
  const [due, setDue] = useState(TODAY);
  const [error, setError] = useState('');
  const [instanceId] = useState(uid);
  const bundles = (state.settings?.assessmentScheduleRules || []).map(asBundle)
    .filter(bundle => editingBundle ? bundle.id === editBundleId : bundle.enabled && bundleAgeMatches(bundle,person,TODAY));
  const bundle = bundles.find(item => item.id === bundleId);
  const validationBundle = editingBundle && bundle ? {...bundle,enabled:true} : bundle;
  const scheduling = assessmentSchedulingEnabled(state.settings);
  const sms = assessmentSmsEnabled(state.settings);
  const available = INSTRUMENTS.filter(instrument => !bundle?.assessments.some(item => item.version === instrument.version) &&
    !extras.some(item => item.version === instrument.version));
  const assessmentRows = bundle ? [
              ...(group?.records || []).filter(record => record.bundleRequirement !== 'Additional' || extras.some(item => item.version === record.version)).map(record => ({
                ...bundle.assessments.find(item => item.id === record.bundleAssessmentId),
                ...extras.find(item => item.version === record.version),
                record, version:record.version, requirement:record.bundleRequirement,
              })),
              ...bundleAssessmentsForCreation(bundle,assessmentOverrides).filter(item => !group?.records.some(record => record.bundleAssessmentId === item.id)),
              ...extras.filter(item => !group?.records.some(record => record.version === item.version)).map(item => ({...item,requirement:'Additional'})),
            ] : [];
  const count = embedded
    ? assessmentRows.filter(item => item.requirement === 'Mandatory' || item.requirement === 'Additional' || optionalIds.includes(item.id)).length
    : bundle ? bundle.assessments.filter(item => item.requirement === 'Mandatory' || optionalIds.includes(item.id)).length + extras.length : 0;
  const selectionError = bundle ? newBundleError(validationBundle,optionalIds,extras,person,state.settings,assessmentOverrides) : '';
  const delivery = bundle ? bundleDelivery(bundle,assessmentOverrides) : {channel:'Clinic tablet',recipient:'Person'};
  const updateDelivery = (key,value) => {
    const next = {...delivery,[key]:value};
    setAssessmentOverrides(bundle.assessments.map(item => ({id:item.id,...next})));
    setExtras(items => items.map(item => ({...item,...next})));
    setError('');
  };
  const submit = event => {
    event.preventDefault();
    const validation = newBundleError(validationBundle,optionalIds,extras,person,state.settings,assessmentOverrides);
    if (validation) { setError(validation); return; }
    const name = instanceName.trim();
    if ((!editingBundle || group?.instanceId) && (!name || episode.assessmentBundleInstances?.some(item => item.id !== group?.instanceId && item.name?.trim().toLowerCase() === name.toLowerCase()))) {
      setError(!name ? 'Enter an assessment name.' : 'An assessment with this name already exists. Choose a unique name.'); return;
    }
    const result = commit({name, bundleInstanceId:group?.instanceId, type:editingBundle ? 'UPDATE_ASSESSMENT_BUNDLE' : 'CREATE_ASSESSMENT_BUNDLE',personId:person.id,episodeId:episode.id,
      id:instanceId,bundleId,optionalIds,assessmentOverrides,extraAssessments:extras,due:scheduling ? due : ''});
    if (result.error) { setError(result.error); return; }
    onCreated(bundle.id,editingBundle ? `${bundleName(bundle)} updated. Drafts and completed instruments have been kept.`
      : `${bundleName(bundle)} added with ${count} instrument${count === 1 ? '' : 's'}.`);
    onClose();
  };
  const rowStatus = item => item.requirement !== 'Mandatory' && item.requirement !== 'Additional' && !optionalIds.includes(item.id)
    ? 'Not included' : item.record ? statusFor(item.record) : 'Not started';
  const instrumentPicker = <div className="field">
                <Select label="Instrument type to add" value={extraVersion} onChange={event => setExtraVersion(event.target.value)}>
                  <option value="">Choose an instrument</option>
                  {available.map(instrument => <option key={instrument.version} value={instrument.version}>{instrument.name}</option>)}
                </Select>
              </div>;
  const addInstrumentButton = <Button type="button" disabled={!extraVersion} onClick={() => {
                setExtras(items => [...items,{id:uid(),version:extraVersion,...delivery,requirement:'Optional'}]);setExtraVersion('');setError('');
              }}>Add instrument</Button>;
  if (bundleId === 'blank') return <AssessmentScheduleSettings editorOnly onClose={onClose} bundleField={<Field label="Assessment"><Select label="Assessment" value={bundleId} onChange={event => {
    setBundleId(event.target.value);
    setInstanceName(uniqueBundleInstanceName(episode,bundles.find(item => item.id === event.target.value)?.name || 'Assessment'));
    setError('');
  }}><option value="">Choose an assessment</option><option value="blank">Blank</option>{bundles.map(item => <option key={item.id} value={item.id}>{bundleName(item)}</option>)}</Select></Field>} onSaved={saved => {
    setBundleId(saved.id);
    setInstanceName(uniqueBundleInstanceName(episode,saved.name));
    if (saved.timing === 'date') setDue(saved.dueDate);
  }} />;
  const content = <>
    {!bundles.length && editingBundle ? <>
      <div className="form-body"><Empty title="No enabled assessments available">Add or enable an assessment in Administration, and check its age conditions for this person.</Empty></div>
      <ActionGroup className="modal-footer bundle-form-footer"><Button onClick={onClose}>Close</Button></ActionGroup>
    </> : <ValidatedForm onSubmit={submit}>
      <div className="form-body new-assessment-bundle-body">
        {!editingBundle && <Field label="Assessment" hint="Choose an assessment, then review the instruments to include.">
          <Select label="Assessment" required value={bundleId} onChange={event => {
            setBundleId(event.target.value); setInstanceName(uniqueBundleInstanceName(episode, bundles.find(item => item.id === event.target.value) ? bundleName(bundles.find(item => item.id === event.target.value)) : 'Assessment')); setOptionalIds([]); setAssessmentOverrides([]); setExtras([]); setExtraVersion(''); setError('');
          }}>
            <option value="">Choose an assessment</option>
            <option value="blank">Blank</option>
            {bundles.map(item => <option key={item.id} value={item.id}>{bundleName(item)}</option>)}
          </Select>
        </Field>}
        {bundle && <>
          {(!editingBundle || group?.instanceId) && <Field label="Assessment name">
            <input aria-label="Assessment name" required maxLength={120} value={instanceName} onChange={event => { setInstanceName(event.target.value); setError(''); }} />
          </Field>}
          {scheduling && <Field label={editingBundle ? 'Due date for added instruments' : 'Due date'} hint={editingBundle ? 'Existing instrument dates stay as recorded.' : 'Applies to all instruments created in this assessment.'}><input required type="date" min={TODAY} value={due} onChange={event => setDue(event.target.value)} /></Field>}
          {!embedded && <DeliveryFields item={delivery} person={person} sms={sms} onChange={updateDelivery} />}
          {embedded ? <div className="bundle-edit-table"><RelatedRecordsTable label={`Instruments in ${bundleName(bundle)}`} compact>
            <thead><tr><th scope="col">Instrument</th><SortableHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} /><SortableHeader label="Requirement" sortKey="requirement" sort={sort} onSort={toggleSort} /></tr></thead>
            <tbody>{[...assessmentRows].sort((a,b) => {
              if (!['status', 'requirement'].includes(sort.key)) return 0;
              const direction = sort.direction === 'asc' ? 1 : -1;
              if (sort.key === 'requirement') {
                const rank = item => item.requirement === 'Mandatory' ? 0 : item.requirement === 'Additional' ? 2 : 1;
                return direction * (rank(a) - rank(b));
              }
              return direction * rowStatus(a).localeCompare(rowStatus(b));
            }).map((item,index) => {
              const instrument = INSTRUMENTS.find(instrument => instrument.version === item.version);
              const mandatory = item.requirement === 'Mandatory';
              const additional = item.requirement === 'Additional';
              const unavailable = bundleAssessmentUnavailable(item,person,state.settings);
              const included = mandatory || additional || optionalIds.includes(item.id);
              return <tr key={item.record?.id || item.id || index}>
                <td>{instrument?.name || item.record?.label}{item.record && responseDate(item.record) && <small>Completed {formatDate(responseDate(item.record))}</small>}</td>
                <td><Badge>{rowStatus(item)}</Badge></td>
                <td>{additional ? <div className="bundle-additional-requirement"><IconButton icon={Trash2} label={`Remove ${instrument?.name}`} onClick={() => {setExtras(items => items.filter(extra => extra.version !== item.version));setError('');}} /><span>Remove</span></div>
                  : <Checkbox label={mandatory ? 'Mandatory' : 'Include'} aria-label={`Include ${instrument?.name}`} checked={included} disabled={mandatory || !!unavailable}
                      onChange={event => {setOptionalIds(ids => event.target.checked ? [...new Set([...ids,item.id])] : ids.filter(id => id !== item.id));setError('');}} />}</td>
              </tr>;
            })}

            </tbody>
          </RelatedRecordsTable>{available.length > 0 && <div className="assessment-group-add-instrument">{instrumentPicker}{addInstrumentButton}</div>}</div> : <fieldset className="new-bundle-assessments">
            <legend>Instruments in this assessment</legend>
            <p className="new-bundle-section-caption">Mandatory instruments stay included. Choose which optional instruments to include.</p>
            {bundleAssessmentsForCreation(bundle,assessmentOverrides).map(item => {
              const mandatory = item.requirement === 'Mandatory';
              const instrument = INSTRUMENTS.find(instrument => instrument.version === item.version);
              const unavailable = bundleAssessmentUnavailable(item,person,state.settings);
              return <BundleAssessmentRow key={item.id} name={instrument?.name}
                checkboxLabel={mandatory ? 'Mandatory' : 'Optional'}
                checkboxAriaLabel={`Include ${instrument?.name} (${COLLECTION_METHOD_OPTIONS.find(([value]) => value === item.channel)?.[1]}, ${item.recipient === 'Person' ? 'Patient' : item.recipient})`}
                checked={mandatory || optionalIds.includes(item.id)} disabled={mandatory || !!unavailable}
                onCheckedChange={checked => {setOptionalIds(ids => checked ? [...ids,item.id] : ids.filter(id => id !== item.id)); setError('');}}
                secondary={unavailable && <Notice tone="amber">{unavailable}. Choose an available assessment collection method and respondent.</Notice>}
              />;
            })}
            {extras.map(item => {
              const instrument = INSTRUMENTS.find(instrument => instrument.version === item.version);
              return <BundleAssessmentRow key={item.id} name={instrument?.name}
                onRemove={() => {setExtras(items => items.filter(extra => extra.id !== item.id));setError('');}}
                status="Added"
              />;
            })}
          </fieldset>}
          {!embedded && <section className="new-bundle-extras" aria-label="Additional instruments">
            {available.length ? <div className="new-bundle-extra-picker">
              {instrumentPicker}
              {addInstrumentButton}
            </div> : <p className="muted">All available instrument types are included.</p>}

          </section>}
        </>}
        {bundle && <div className="new-bundle-creation-summary" role="status">
          <strong>{count} instrument{count === 1 ? '' : 's'} selected</strong>
          <small>{editingBundle ? 'Mandatory instruments stay included' : scheduling ? 'Ready on the chosen due date' : 'Ready to collect after creation'}</small>
        </div>}
        {(error || selectionError) && <div role="alert"><Notice tone="amber">{error || selectionError}</Notice></div>}
      </div>
      <AssessmentModalActions assessment={assessmentAction || bundle}
        onMarkNotRequired={onMarkNotRequired || (footerAction ? () => footerAction.props.onClick() : null)}
        onArchive={onArchive} onCancel={onClose} saveLabel={editingBundle ? 'Save changes' : 'Create assessment'} disabled={!bundle || !!selectionError} />
    </ValidatedForm>}
  </>;
  return embedded ? content : <Modal title={editingBundle ? 'Edit assessment' : 'New assessment'} subtitle={editingBundle ? bundleName(bundle) : `${person.name} · Care episode ${episode.number}`} onClose={onClose} wide className="new-assessment-bundle-modal">{content}</Modal>;
}
