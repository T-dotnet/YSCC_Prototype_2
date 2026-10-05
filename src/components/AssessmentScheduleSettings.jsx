import StandardTable from "./StandardTable";
import { COLLECTION_METHOD_OPTIONS, LABELS, displayTerminology } from "../terminology.js";
import { Fragment, useRef, useState } from 'react';
import { ChevronDown, LockKeyhole, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { INSTRUMENTS, STANDARD_INSTRUMENTS } from '../instruments';
import { PROGRAM_STREAMS, CARE_LEVELS } from '../carePeriods';
import { bundleError, asBundle, bundleName, BUNDLE_EVENT_TYPES, bundleAgeLabel, bundleTiming, bundleScheduleHint, instrumentSupportsRespondent } from '../assessmentBundles';
import { assessmentSmsEnabled } from '../assessmentFeatures';
import { ActionGroup, EditAction, DeleteAction, Panel, Button, Badge, Modal, ModalFooter, Field, FieldInput, FieldSelect, Select, Checkbox, Switch, IconButton } from './UI';
import { QueueRow, QueueCell } from './QueueRow';
import BundleAssessmentRow from './BundleAssessmentRow';
import ConfirmRemoval from './ConfirmRemoval';
import { mvpAssessmentMode, mvpReviewBundles, mvpReviewItems, MVP_REVIEW_BUNDLES, mvpInitialBundles, mvpInitialVersions, MVP_INITIAL_BUNDLES } from '../mvpAssessmentPathway';
import { administrationMeasureBundles, instrumentVersionsForAdministrationMeasure, mvpDisplayBattery, mvpDisplayBundles } from '../administrationMeasures';
import MvpReviewBundleEditor from './MvpReviewBundleEditor';
import MvpInitialBundleEditor from './MvpInitialBundleEditor';
import SpecificMeasureFields from './SpecificMeasureFields';
import { measureSourceOptions, measureTriggerIds, measureTriggerStatuses, specificMeasureError } from '../measureTriggers';
import ProfileValueTriggerFields from './ProfileValueTriggerFields';
import { PROFILE_TRIGGER_FIELDS, profileValueTriggerError } from '../profileValueTriggers';
import { CLIENT_PROFILE_INSTRUMENTS, clientProfileBundle, DEFAULT_CLIENT_PROFILE_BUNDLE } from '../clientProfileMeasure';
import ClientProfileBundleEditor from './ClientProfileBundleEditor';
import ListFilterBar from './ListFilterBar';
import StatusChangeFields, { StatusChangeValue } from './StatusChangeFields';
import AllowedCollectionMethods from './AllowedCollectionMethods';
import { collectionMethodSummary } from '../allowedCollectionMethods.js';
import { MVP_SCHEDULE_PRESETS, presetForBundle } from '../mvpSchedulePresets.js';
import EpisodeStatusFields from './EpisodeStatusFields';

const profileConfig = ({ id, name, channel, allowedCollectionMethods, respondent, enabled, instrumentVersions,
  timing, after, delayDays, dueDate, triggerMeasureId, triggerMeasureStatus, triggerMeasureIds, triggerMeasureStatuses,
  triggerDataEnabled, triggerDataField, triggerDataValue, triggerEpisodeStatus, programStream, careLevel, minAge, maxAge, statusChange }) =>
  ({ id, name, channel, allowedCollectionMethods, respondent, enabled, instrumentVersions,
    timing, after, delayDays, dueDate, triggerMeasureId, triggerMeasureStatus, triggerMeasureIds, triggerMeasureStatuses,
    triggerDataEnabled, triggerDataField, triggerDataValue, triggerEpisodeStatus, programStream, careLevel, minAge, maxAge, statusChange });
const packTriggerSummary = (bundle, settings) => {
  const names = new Map(measureSourceOptions(settings).map(item => [item.id, item.name]));
  return `${measureTriggerStatuses(bundle).map(value => value.replace('not-required', 'not required')).join(' or ')} · ${measureTriggerIds(bundle).map(id => names.get(id) || id).join(' or ')}`;
};
const mockPackScheduleSummary = (bundle, settings) => {
  const initial = MVP_INITIAL_BUNDLES.some(item => item.id === bundle.id);
  if (bundle.timing === 'date') return `Due ${bundle.dueDate}`;
  const anchor = bundle.after === 'specific-measure' ? packTriggerSummary(bundle, settings)
    : bundle.after === 'episode-status' ? `episode status ${bundle.triggerEpisodeStatus}` : '';
  if (!anchor) return bundle.schedule || bundleTiming(bundle);
  const days = bundle.profileMeasure || initial ? bundle.delayDays || 0 : bundle.days;
  if (days === 0) return `On ${anchor}`;
  return !bundle.profileMeasure && !initial && bundle.repeat
    ? `Every ${days} days after ${anchor}` : `Once, ${days} days after ${anchor}`;
};
const mvpInstrumentSummary = bundle => {
  if (bundle.profileMeasure) return `${bundle.instrumentVersions.length} total`;
  if (MVP_INITIAL_BUNDLES.some(item => item.id === bundle.id)) return `${mvpInitialVersions(bundle, bundle.programStream).length} total`;
  if (!bundle.coreVersion) return `${mvpReviewItems(bundle).length} total`;
  const streams = bundle.programStream && bundle.programStream !== 'All' ? [bundle.programStream] : PROGRAM_STREAMS;
  const distinctVersions = new Set(streams.flatMap(stream => mvpDisplayBattery(bundle, stream)));
  return `${distinctVersions.size} measure type${distinctVersions.size === 1 ? '' : 's'} across ${streams.length} program stream${streams.length === 1 ? '' : 's'}`;
};

const blankAssessment = () => ({id:crypto.randomUUID(), version:'', requirement:'Mandatory'});
const blankBundle = () => ({id:crypto.randomUUID(), name:'', channel:'Clinician entry', recipient:'Person', trigger:'current', eventType:'', programStream:'All', careLevel:'All', minAge:null, maxAge:null, timing:'days', after:'', dueDate:'', repeat:true, days:28, delayDays:0, enabled:true, statusChange:'', assessments:[]});
const parameterOptions = [
  ['programStream', 'Program stream'], ['careLevel', 'Care level'],
  ['minAge', 'Minimum age (years)'], ['maxAge', 'Maximum age (years)'],
  ['profileValue', 'Data dictionary item'],
];
const configuredParameters = bundle => parameterOptions.map(([key])=>key).filter(key =>
  key === 'profileValue' ? !!bundle.triggerDataEnabled : key === 'programStream' || key === 'careLevel' ? bundle[key] !== 'All' : bundle[key] != null);
export default function AssessmentScheduleSettings({ editorOnly = false, onClose, onSaved, bundleField } = {}) {
  const {state, commit} = useStore();
  const bundles = state.settings?.assessmentScheduleRules || [];
  const mvp = mvpAssessmentMode(state.settings);
  const sms = assessmentSmsEnabled(state.settings);
  const [draft, setDraft] = useState(() => editorOnly ? blankBundle() : null);
  const [assessmentVersion, setAssessmentVersion] = useState('');
  const [parameterToAdd, setParameterToAdd] = useState('');
  const [parameters, setParameters] = useState([]);
  const availableParameterOptions = draft?.trigger === 'event'
    ? parameterOptions.filter(([key]) => key === 'profileValue') : parameterOptions;
  const availableAssessments = STANDARD_INSTRUMENTS.filter(instrument =>
    instrumentSupportsRespondent(instrument, draft?.recipient || 'Person', draft?.channel || 'Clinician entry') &&
    !draft?.assessments.some(item => item.version === instrument.version));
  const nameInput = useRef(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [mvpDraft, setMvpDraft] = useState(null);
  const [initialDraft, setInitialDraft] = useState(null);
  const [profileDraft, setProfileDraft] = useState(null);
  const [profileInfoOpen, setProfileInfoOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingParameterRemoval, setPendingParameterRemoval] = useState(null);
  const [listStatus, setListStatus] = useState('All');
  const [listQuery, setListQuery] = useState('');
  const [listRespondent, setListRespondent] = useState('All');
  const [listStream, setListStream] = useState('Any');
  const [listMethod, setListMethod] = useState('All');
  const availableVersions = new Set(INSTRUMENTS.map(instrument => instrument.version));
  const adminBundles = bundles.filter(bundle => (!mvp || bundle.createdInMvp) &&
    bundle.assessments?.length && bundle.assessments.every(item => availableVersions.has(item.version)));
  const systemBundles = mvp ? mvpDisplayBundles(state.settings) : [];
  const displayBundles = administrationMeasureBundles(state.settings);
  const search = listQuery.trim().toLocaleLowerCase();
  const visibleBundles = displayBundles.filter(bundle => {
    const status = bundle.enabled ? 'Enabled' : 'Disabled';
    if (listStatus !== 'All' && status !== listStatus) return false;
    if (listRespondent !== 'All' && (bundle.respondent || bundle.recipient) !== listRespondent) return false;
    if (listStream !== 'Any' && (bundle.programStream || 'All') !== listStream) return false;
    if (listMethod !== 'All' && !(Array.isArray(bundle.allowedCollectionMethods)
      ? bundle.allowedCollectionMethods.includes(listMethod) : true)) return false;
    if (!search) return true;
    const versions = instrumentVersionsForAdministrationMeasure(bundle);
    return [bundle.name, bundle.programStream, bundle.schedule, ...versions.map(version =>
      INSTRUMENTS.find(instrument => instrument.version === version)?.name || version)]
      .some(value => String(value || '').toLocaleLowerCase().includes(search));
  });
  const clearListFilters = () => {setListStatus('All');setListQuery('');setListRespondent('All');setListStream('Any');setListMethod('All');};
  const closeEditor = () => {setDraft(null); setAssessmentVersion(''); setParameterToAdd(''); setParameters([]); setError(''); onClose?.();};
  const removeParameter = key => {
    setParameters(current=>current.filter(item=>item!==key));
    if (key === 'profileValue') setDraft(current => ({...current, triggerDataEnabled:false, triggerDataField:'', triggerDataValue:''}));
    else change(key, key === 'programStream' || key === 'careLevel' ? 'All' : null);
  };
  const change = (key, value) => {setDraft(current=>({...current, [key]:value, ...(['channel','recipient'].includes(key) ? {assessments:current.assessments.map(item=>({...item,[key]:value}))} : {})})); setError('');};
  const changeAssessment = (id, key, value) => setDraft(current=>({...current, assessments:current.assessments.map(item=> {
    if (item.id !== id) return item;
    return {...item, [key]:value};
  })}));
  const save = event => {
    event.preventDefault();
    if (draft.trigger !== 'event' && draft.timing === 'days' && !draft.after) {setError('Choose what starts the schedule.'); return;}
    if (mvp && (state.settings?.phase2CareActivity && state.settings?.mvpSchedulePresets !== false) && !presetForBundle(draft)) {
      setError('Choose a care point preset.'); return;
    }
    const normalized = asBundle(draft);
    const validation = bundleError(normalized, bundles) || specificMeasureError(normalized, state.settings) || profileValueTriggerError(normalized);
    if (validation) {setError(validation); return;}
    const result = commit({type:'SAVE_ASSESSMENT_SCHEDULE_RULE', rule:normalized});
    if (result.error) {setError(result.error); return;}
    setDraft(null); setError(''); setMessage('Assessment Pack saved.');
    onSaved?.(normalized);
  };
  return <div className="stack">
    {!editorOnly && !mvp && <Panel title="Automatic assessment due dates" className="admin-panel assessment-schedule-settings">
      <div className="admin-row">
        <div><h3>Enable assessments</h3><p>Prepare mandatory measures automatically. Staff choose which optional measures to include in each person’s Assessment tab.</p></div>
        <Switch label="Automatic assessment due dates" checked={!!state.settings?.automaticAssessmentDueDates}
          onChange={event=>commit({type:'SET_AUTOMATIC_ASSESSMENT_DUE_DATES', enabled:event.target.checked})}/>
      </div>
      <p>Schedule assessments after a selected event. Schedules can repeat when configured with a time interval.</p>
      <p>Assignments are prepared in this browser. Live SMS and tablet delivery are not connected. SMS measures wait while Assessment SMS flow is off. Existing measures and answers are retained.</p>
    </Panel>}
    <section className="assessment-schedule-settings stack" aria-label="Assessment Packs">
      {!editorOnly && <>
      <div className="section-toolbar administration-section-heading">
        <div>
          <h2>Assessment Packs</h2>
          {!editorOnly && <p>Configure the sets of measures issued at each point in care.</p>}
        </div>
        <ActionGroup className="button-row">
          {mvp && !clientProfileBundle(state.settings) && <Button onClick={()=>setProfileDraft({ ...DEFAULT_CLIENT_PROFILE_BUNDLE,
            instrumentVersions: CLIENT_PROFILE_INSTRUMENTS.map(item => item.version) })}>Add Client profile</Button>}
          <Button variant="primary" onClick={()=>{setDraft({...blankBundle(), createdInMvp:mvp});setAssessmentVersion('');setParameterToAdd('');setParameters([]);setError('');setMessage('');}}>Add Assessment Pack</Button>
        </ActionGroup>
      </div>
      <ListFilterBar id="assessment-bundle-filters" label="Assessment Pack status" className="administration-filter-bar"
        items={['All', 'Enabled', 'Disabled'].map(value => ({
          value, label:value, count:value === 'All' ? displayBundles.length : displayBundles.filter(bundle =>
            (bundle.enabled ? 'Enabled' : 'Disabled') === value).length,
        }))}
        value={listStatus} onChange={setListStatus} query={listQuery} onQueryChange={setListQuery}
        placeholder="Search Assessment Packs or measures" shown={visibleBundles.length} total={displayBundles.length}
        noun="Assessment Packs" onClear={clearListFilters}
        activeFilters={[
          ...(listQuery ? [{id:'search', label:`Search: ${listQuery}`, onRemove:()=>setListQuery('')}] : []),
          ...(listStatus !== 'All' ? [{id:'status', label:`Status: ${listStatus}`, onRemove:()=>setListStatus('All')}] : []),
          ...(listRespondent !== 'All' ? [{id:'respondent', label:`Respondent: ${listRespondent === 'Person' ? 'Patient' : listRespondent}`, onRemove:()=>setListRespondent('All')}] : []),
          ...(listStream !== 'Any' ? [{id:'stream', label:`Program stream: ${listStream === 'All' ? 'All program streams' : listStream}`, onRemove:()=>setListStream('Any')}] : []),
          ...(listMethod !== 'All' ? [{id:'method', label:`Collection method: ${COLLECTION_METHOD_OPTIONS.find(([value])=>value===listMethod)?.[1] || listMethod}`, onRemove:()=>setListMethod('All')}] : []),
        ]}
        activeAdvancedCount={Number(listRespondent !== 'All') + Number(listStream !== 'Any') + Number(listMethod !== 'All')}
        advanced={<>
          <Select label="Respondent" value={listRespondent} onChange={event=>setListRespondent(event.target.value)}>
            <option value="All">All respondents</option><option value="Person">Patient</option><option value="Clinician">Clinician</option>
          </Select>
          <Select label="Program stream" value={listStream} onChange={event=>setListStream(event.target.value)}>
            <option value="Any">Any program stream</option><option value="All">All program streams</option>
            {PROGRAM_STREAMS.map(stream=><option key={stream} value={stream}>{stream}</option>)}
          </Select>
          <Select label="Collection method" value={listMethod} onChange={event=>setListMethod(event.target.value)}>
            <option value="All">All collection methods</option>
            {COLLECTION_METHOD_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </Select>
        </>}/>
      {mvp && <div className="assessment-schedule-rule-list stack" aria-label="Assessment Pack configuration">
        {!visibleBundles.length && <p className="muted">No Assessment Packs match these filters.</p>}
        {visibleBundles.filter(bundle => systemBundles.some(item => item.id === bundle.id)).map(bundle => {
          return <Fragment key={bundle.id}>
          <Panel className="assessment-bundle-summary"
          title={<span className="bundle-summary-heading"><span className="bundle-summary-title"><span>{bundle.name}</span>{bundle.profileMeasure &&
            <IconButton icon={LockKeyhole} label="Why Client profile is required" className="bundle-summary-lock"
              aria-haspopup="dialog" onClick={()=>setProfileInfoOpen(true)} />}</span><small className="bundle-summary-id">ID: {bundle.id}</small></span>}
          action={bundle.profileMeasure ? <ActionGroup className="button-row bundle-summary-actions bundle-summary-profile-actions">
            <Switch label={`Enable ${bundle.name}`} checked={bundle.enabled} onChange={event => {
              const result = commit({type:'SAVE_CLIENT_PROFILE_BUNDLE', bundle:profileConfig({...bundle, enabled:event.target.checked})});
              setMessage(result.error || `${bundle.name} ${event.target.checked ? 'enabled' : 'disabled'}.`);
            }}/>
            <EditAction onClick={()=>setProfileDraft({...bundle})} aria-label={`Edit ${bundle.name}`}>Edit</EditAction>
          </ActionGroup> : (!bundle.coreVersion || MVP_INITIAL_BUNDLES.some(item => item.id === bundle.id)) && <ActionGroup className="button-row bundle-summary-actions">
            <Switch label={`Enable ${bundle.name}`} checked={bundle.enabled} onChange={event => {
              const result = commit({type:bundle.coreVersion ? 'SAVE_MVP_INITIAL_BUNDLE' : 'SAVE_MVP_REVIEW_BUNDLE',bundle:{...bundle,enabled:event.target.checked}});
              setMessage(result.error || `${bundle.name} ${event.target.checked ? 'enabled' : 'disabled'}.`);
            }}/>
            <EditAction onClick={()=>{MVP_INITIAL_BUNDLES.some(item => item.id === bundle.id) ? setInitialDraft({...bundle}) : setMvpDraft({...bundle});setError('');setMessage('');}} aria-label={`Edit ${bundle.name}`}>Edit</EditAction>
            <DeleteAction onClick={()=>setPendingDelete({id:bundle.id,name:bundle.name,type:bundle.coreVersion ? 'DELETE_MVP_INITIAL_BUNDLE' : 'DELETE_MVP_REVIEW_BUNDLE'})} aria-label={`Delete ${bundle.name}`}>Delete</DeleteAction>
          </ActionGroup>}>
          <div className="panel-body">
            <dl className="metadata bundle-summary-conditions">
              <div><dt>{(state.settings?.phase2CareActivity && state.settings?.mvpSchedulePresets !== false) ? 'Care point' : 'Schedule'}</dt><dd>{state.settings?.mvpSchedulePresets === false ? mockPackScheduleSummary(bundle, state.settings) : bundle.profileMeasure ? bundle.timing === 'date' ? `Due ${bundle.dueDate}` :
                `After ${bundle.after === 'specific-measure' ? packTriggerSummary(bundle, state.settings) : bundle.after === 'intake' ? 'intake' : bundle.after === 'care-period' ? 'care episode starts' : 'new profile'}${bundle.delayDays ? ` + ${bundle.delayDays} days` : ''}`
                : MVP_INITIAL_BUNDLES.some(item => item.id === bundle.id) ? bundle.timing === 'date' ? `Due ${bundle.dueDate}` : `${bundle.after === 'specific-measure' ? `After ${packTriggerSummary(bundle, state.settings)}` : bundle.after === 'intake' ? 'After intake' : 'After care episode starts'}${bundle.delayDays ? ` + ${bundle.delayDays} days` : ''}` : bundle.schedule || bundleTiming(bundle)}</dd></div>
              {bundle.triggerDataEnabled && <div><dt>Data field</dt><dd>{PROFILE_TRIGGER_FIELDS.find(field => field.id === bundle.triggerDataField)?.label}: {bundle.triggerDataValue}</dd></div>}
              <div><dt>{LABELS.respondent}</dt><dd>{bundle.respondent === 'Person' ? 'Patient' : 'Clinician'}</dd></div>
              <div><dt>Allowed collection methods</dt><dd>{collectionMethodSummary(bundle)}</dd></div>
              <div><dt>Status change after completion</dt><dd><StatusChangeValue verbatim value={bundle.statusChange} /></dd></div>
              {!bundle.example && <><div><dt>{LABELS.programStream}</dt><dd>{bundle.programStream === 'All' ? 'All program streams' : bundle.programStream}</dd></div><div><dt>Care level</dt><dd>{bundle.careLevel === 'All' ? 'All care levels' : bundle.careLevel}</dd></div><div><dt>Age</dt><dd>{bundleAgeLabel(bundle)}</dd></div></>}
            </dl>
            <details className="bundle-summary-assessments">
              <summary className="bundle-summary-assessments-heading"><span>Measures</span><span className="muted">{mvpInstrumentSummary(bundle)}</span><ChevronDown size={18} aria-hidden="true" /></summary>
              <div className="collection-details-accordion-body">
                <StandardTable className="bundle-assessments-table" density="compact" label={`Measures in ${bundle.name}`}>
                  <thead><tr><th scope="col">{bundle.coreVersion && !MVP_INITIAL_BUNDLES.some(item => item.id === bundle.id) ? 'Program stream' : 'Measure'}</th>{bundle.coreVersion && !MVP_INITIAL_BUNDLES.some(item => item.id === bundle.id) && <th scope="col">Measures</th>}</tr></thead>
                  <tbody>{bundle.profileMeasure ? CLIENT_PROFILE_INSTRUMENTS.map(instrument => <QueueRow key={instrument.version}>
                    <QueueCell label="Measure" slot="subject" verbatim><strong>{instrument.name}</strong></QueueCell>
                  </QueueRow>) : MVP_INITIAL_BUNDLES.some(item => item.id === bundle.id)
                    ? mvpInitialVersions(bundle, bundle.programStream).map(version => <QueueRow key={version}>
                      <QueueCell label="Measure" slot="subject" verbatim><strong>{INSTRUMENTS.find(item => item.version === version)?.name || version}</strong></QueueCell>
                    </QueueRow>)
                    : bundle.coreVersion
                    ? (bundle.programStream && bundle.programStream !== 'All' ? [bundle.programStream] : PROGRAM_STREAMS).map(stream => <QueueRow key={stream}>
                      <QueueCell label="Program stream" slot="subject"><strong>{stream}</strong></QueueCell>
                      <QueueCell label="Measures" slot="state">{mvpDisplayBattery(bundle,stream).map(version => INSTRUMENTS.find(item => item.version === version)?.name || version).join(' · ')}</QueueCell>
                    </QueueRow>)
                    : mvpReviewItems(bundle).map(item => <QueueRow key={item.id}>
                      <QueueCell label="Measure" slot="subject" verbatim><strong>{INSTRUMENTS.find(instrument => instrument.version === item.version)?.name || item.version}</strong></QueueCell>
                    </QueueRow>)}</tbody>
                </StandardTable>
              </div>
            </details>
          </div>
        </Panel></Fragment>;})}
        {MVP_INITIAL_BUNDLES.filter(defaultBundle => !mvpInitialBundles(state.settings).some(bundle => bundle.id === defaultBundle.id)).map(bundle =>
          <Button key={bundle.id} onClick={()=>{commit({type:'SAVE_MVP_INITIAL_BUNDLE',bundle});setMessage(`${bundle.name} restored.`);}}>Restore {bundle.name}</Button>)}
        {MVP_REVIEW_BUNDLES.filter(defaultBundle => !mvpReviewBundles(state.settings).some(bundle => bundle.id === defaultBundle.id)).map(bundle =>
          <Button key={bundle.id} onClick={()=>{const result=commit({type:'SAVE_MVP_REVIEW_BUNDLE',bundle});setMessage(result.error || `${bundle.name} restored.`);}}>Restore {bundle.name}</Button>)}
      </div>}
      {adminBundles.length ? <div className="assessment-schedule-rule-list stack">
        {mvp && <h3>User-created Assessment Packs</h3>}
        {mvp && !visibleBundles.some(bundle => adminBundles.some(item => item.id === bundle.id)) && <p className="muted">No Assessment Packs match these filters.</p>}
        {visibleBundles.filter(bundle => adminBundles.some(item => item.id === bundle.id)).map(bundle=> {
        const saved = bundles.find(item=>item.id===bundle.id);
        const mandatory=bundle.assessments.filter(item=>item.requirement==='Mandatory').length;
        const conditions=bundle.trigger==='event'
          ? [['Trigger', BUNDLE_EVENT_TYPES.find(e=>e.value===bundle.eventType)?.label], ['Due', bundleTiming(bundle)]]
          : [[LABELS.programStream, bundle.programStream==='All' ? 'All program streams' : bundle.programStream], ['Care level', bundle.careLevel==='All' ? 'All care levels' : bundle.careLevel], ['Age', bundleAgeLabel(bundle)], [mvp && (state.settings?.phase2CareActivity && state.settings?.mvpSchedulePresets !== false) ? 'Care point' : 'Schedule', mvp && (state.settings?.phase2CareActivity && state.settings?.mvpSchedulePresets !== false) ? presetForBundle(bundle)?.label || bundleTiming(bundle) : bundleTiming(bundle)]];
        conditions.push(['Allowed collection methods', collectionMethodSummary(bundle)], [LABELS.respondent, bundle.recipient==='Person' ? 'Patient' : bundle.recipient]);
        conditions.push(['Status change after completion', <StatusChangeValue verbatim value={bundle.statusChange} />]);
        return <Panel key={bundle.id} className="assessment-bundle-summary"
          title={<span className="bundle-summary-heading"><span className="bundle-summary-title">{bundle.name}</span><small className="bundle-summary-id">ID: {bundle.id}</small></span>}
          action={<ActionGroup className="button-row bundle-summary-actions">
            <Switch label={`Enable ${bundle.name}`} checked={bundle.enabled}
              onChange={event=> {
                  const result=commit({type:'SAVE_ASSESSMENT_SCHEDULE_RULE',rule:{...saved,enabled:event.target.checked}});
                  setMessage(result.error || `${bundle.name} ${event.target.checked ? 'enabled':'disabled'}.`);
                  if (!result.error && draft?.id===bundle.id) setDraft(current=>({...current,enabled:event.target.checked}));
                }}/>
            <EditAction onClick={()=>{setDraft(structuredClone(bundle));setAssessmentVersion('');setParameterToAdd('');setParameters(configuredParameters(bundle));setError('');setMessage('');}} aria-label={`Edit ${bundleName(saved)}`}>Edit</EditAction>
            <DeleteAction onClick={()=>setPendingDelete({id:bundle.id,name:bundleName(saved),type:'DELETE_ASSESSMENT_SCHEDULE_RULE'})} aria-label={`Delete ${bundleName(saved)}`}>Delete</DeleteAction>
          </ActionGroup>}>
          <div className="panel-body">
            <dl className="metadata bundle-summary-conditions">{conditions.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            <details className="bundle-summary-assessments">
              <summary className="bundle-summary-assessments-heading"><span>Measures</span><span className="muted">{bundle.assessments.length} total · {mandatory} mandatory · {bundle.assessments.length-mandatory} optional</span><ChevronDown size={18} aria-hidden="true" /></summary>
              <div className="collection-details-accordion-body">
              <StandardTable className="bundle-assessments-table" density="compact" label={`Measures in ${bundle.name}`}>
                <thead><tr><th scope="col">Measure</th><th scope="col">Requirement</th></tr></thead>
                <tbody>{bundle.assessments.map(item=><QueueRow key={item.id}>
                  <QueueCell label="Measure" slot="subject"><strong>{INSTRUMENTS.find(i=>i.version===item.version)?.name}</strong></QueueCell>
                  <QueueCell label="Requirement" slot="state"><Badge tone="neutral">{item.requirement}</Badge></QueueCell>
                </QueueRow>)}</tbody>
              </StandardTable>
              </div>
            </details>
          </div>
        </Panel>;
      })}</div> : !mvp && <p className="muted">No Assessment Packs yet. Add a Pack to group measures for a care condition or event.</p>}
      </>}
      {profileInfoOpen && <Modal title="About Client profile" subtitle="Required for new profiles" onClose={()=>setProfileInfoOpen(false)}>
        <div className="form-body stack">
          <p>Client profile is the mandatory first Assessment Pack for new people while it is enabled. Its included measures must be completed as part of the new-profile workflow.</p>
          <p>Submitted Client profile answers update the same person and care episode details shown in Profile information. The initial assessment follows Client profile completion according to its configured schedule.</p>
        </div>
        <ModalFooter><Button type="button" onClick={()=>setProfileInfoOpen(false)}>Close</Button></ModalFooter>
      </Modal>}
      {initialDraft && <MvpInitialBundleEditor key={initialDraft.id} bundle={initialDraft} settings={state.settings}
        onClose={()=>setInitialDraft(null)} onSave={bundle=>{
          const result=commit({type:'SAVE_MVP_INITIAL_BUNDLE',bundle});
          if(!result.error)setMessage('Assessment Pack saved.');
          return result;
        }}/>}
      {profileDraft && <ClientProfileBundleEditor key={profileDraft.id} bundle={profileDraft} settings={state.settings}
        onClose={()=>setProfileDraft(null)} onSave={bundle=>{
          const result=commit({type:'SAVE_CLIENT_PROFILE_BUNDLE', bundle:profileConfig(bundle)});
          if(!result.error)setMessage('Client profile saved.');
          return result;
        }}/>}
      {mvpDraft && <MvpReviewBundleEditor key={mvpDraft.id} bundle={mvpDraft} settings={state.settings}
        onClose={()=>setMvpDraft(null)} onSave={bundle=>{
          const result=commit({type:'SAVE_MVP_REVIEW_BUNDLE',bundle});
          if(!result.error)setMessage('Assessment Pack saved.');
          return result;
        }}/>}
      {draft && <Modal title={bundles.some(b=>b.id===draft.id) ? 'Edit Assessment Pack':'New Assessment Pack'}
        subtitle="Define when the Pack applies and which measures it includes."
        onClose={closeEditor} initialFocusRef={nameInput} wide className="assessment-bundle-settings-modal">
      <form onSubmit={save} className="assessment-schedule-form">
        <div className="form-body">
        {bundleField}
        <div className="assessment-schedule-fields">
          <FieldInput className="bundle-name-field" label="Assessment Pack name" ref={nameInput} required maxLength={80} value={draft.name} onChange={e=>change('name',e.target.value)}/>
          <Checkbox className="bundle-name-field assessment-schedule-enabled" label="Enable this Assessment Pack" checked={draft.enabled} onChange={e=>change('enabled',e.target.checked)}/>
          <h3 className="bundle-name-field bundle-collection-heading">Collection settings</h3>
          <FieldSelect label={LABELS.respondent} value={draft.recipient} onChange={e=>{setDraft(current=>{
            const recipient = e.target.value;
            const channel = recipient === 'Clinician' ? 'Clinician entry' : current.channel;
            return {...current, recipient, channel,
              allowedCollectionMethods: recipient === 'Clinician' && Array.isArray(current.allowedCollectionMethods)
                ? ['Clinician entry'] : current.allowedCollectionMethods,
              assessments: current.assessments.map(item=>({...item,recipient,channel}))};
          });setError('');}}><option value="Person">Patient</option><option value="Clinician">Clinician</option></FieldSelect>
          <AllowedCollectionMethods bundle={draft} methods={COLLECTION_METHOD_OPTIONS.filter(([value]) =>
            (value !== 'SMS link' || sms) && (draft.recipient !== 'Clinician' || value === 'Clinician entry')).map(([value]) => value)}
            onChange={methods => setDraft(current => {
              const channel = methods?.length && !methods.includes(current.channel) ? methods[0] : current.channel;
              return { ...current, allowedCollectionMethods: methods, channel,
                assessments: current.assessments.map(item => ({ ...item, channel })) };
            })} />
            {mvp && (state.settings?.phase2CareActivity && state.settings?.mvpSchedulePresets !== false) ? <div className="bundle-name-field mvp-preset-pair">
              <div className="bundle-timing-fields">
              <div className="bundle-name-field mvp-preset-label">Care point preset</div>
              <Select className="mvp-care-point-select" label="Care point preset" required value={presetForBundle(draft)?.id || ''} onChange={event => {
                const preset = MVP_SCHEDULE_PRESETS.find(item => item.id === event.target.value);
                if (preset) setDraft(current => ({ ...current, ...preset.fields, dueDate: '' }));
                setError('');
              }}>
                <option value="" disabled>Choose a care point</option>
                {MVP_SCHEDULE_PRESETS.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
              </Select>
              <p className="muted bundle-name-field">{presetForBundle(draft)?.description || 'Choose when this Assessment Pack is prepared.'}</p>
              </div>
              <StatusChangeFields compact value={draft.statusChange} onChange={value=>change('statusChange',value)} />
            </div> :             <div className="bundle-name-field bundle-timing-fields assessment-pack-schedule">
              <h3 className="bundle-name-field bundle-timing-heading">Schedule</h3>
              {draft.trigger === 'event' && <>
                <FieldSelect label="Event category" required value={draft.eventType} onChange={e=>change('eventType',e.target.value)}><option value="">Choose an event category</option>{BUNDLE_EVENT_TYPES.map(e=><option key={e.value} value={e.value}>{e.label}</option>)}</FieldSelect>
                <FieldInput label="Days after event" required type="number" min="0" max="730" step="1" value={draft.delayDays} onChange={e=>change('delayDays',Number(e.target.value))}/>
              </>}
              {draft.trigger !== 'event' && draft.timing === 'date' && <FieldInput label="Due date" required type="date" value={draft.dueDate || ''} onChange={e=>change('dueDate',e.target.value)}/>}
              {draft.trigger !== 'event' && draft.timing === 'days' && <>
                <FieldInput label="Time (days)" required type="number" min="1" max="728" step="1" value={draft.days} onChange={e=>change('days',Number(e.target.value))}/>
                <FieldSelect label="After" required value={draft.after || ''} onChange={e=>setDraft(current=>({...current,after:e.target.value}))}>
                  <option value="">Choose a trigger</option>
                  {['new-profile', 'intake', 'referral', 'discharge'].includes(draft.after) &&
                    <option value={draft.after}>{({ 'new-profile':'New profile', intake:'Intake', referral:'Referral', discharge:'Discharge' })[draft.after]} (existing schedule)</option>}
                  <option value="specific-measure">Specific Assessment Pack</option>
                  <option value="episode-status">Specific episode status</option>
                  <option value="program-change">Program changed</option>
                  <option value="care-level-change">Care level changed</option>
                  {draft.after === 'level-change' && <option value="level-change">Program or care level changed</option>}
                  {!mvp && BUNDLE_EVENT_TYPES.filter(event=>!['program-change','care-level-change','level-change'].includes(event.value)).map(event=><option key={event.value} value={event.value}>{event.label}</option>)}
                </FieldSelect>
                <SpecificMeasureFields draft={draft} settings={state.settings} change={change} />
                <EpisodeStatusFields draft={draft} change={change} />
                {draft.after === 'referral' ? <FieldSelect label="Referral status" required value={draft.referralStatus || 'Accepted'} onChange={e=>change('referralStatus',e.target.value)}>{['Accepted','Denied','Reworked','Modified'].map(status=><option key={status} value={status}>{status}</option>)}</FieldSelect> : !(draft.after === 'episode-status' && draft.triggerEpisodeStatus === 'Discharged') && <Checkbox className="bundle-repeat-choice" label="Repeat" checked={draft.repeat} aria-describedby={`bundle-repeat-hint-${draft.id}`} onChange={event=>change('repeat',event.target.checked)}/>}
              </>}
              <p id={`bundle-repeat-hint-${draft.id}`} className={`muted ${draft.timing === 'days' ? 'bundle-repeat-hint' : 'bundle-name-field'}`}>{bundleScheduleHint(draft)}</p>
            </div>}
          <>
            <h3 className="bundle-name-field bundle-collection-heading">Show if</h3>
            {!!parameters.length && <div className="bundle-name-field bundle-parameter-list">
              {parameters.filter(key => availableParameterOptions.some(([value]) => value === key)).map(key => <div key={key} className="bundle-parameter-row">
                {key === 'profileValue' ? <ProfileValueTriggerFields draft={draft} change={change} />
                  : key === 'programStream' ? <FieldSelect label="Program stream" required value={draft.programStream === 'All' ? '' : draft.programStream} onChange={e=>change(key,e.target.value)}><option value="" disabled>Choose a program stream</option>{PROGRAM_STREAMS.map(value=><option key={value} value={value}>{value}</option>)}</FieldSelect>
                  : key === 'careLevel' ? <FieldSelect label="Care level" required value={draft.careLevel === 'All' ? '' : draft.careLevel} onChange={e=>change(key,e.target.value)}><option value="" disabled>Choose a care level</option>{CARE_LEVELS.map(value=><option key={value} value={value}>{value}</option>)}</FieldSelect>
                    : <FieldInput label={key === 'minAge' ? 'Minimum age (years)' : 'Maximum age (years)'} required type="number" min="0" max="120" step="1" placeholder="Enter age" value={draft[key] ?? ''} onChange={e=>change(key,e.target.value==='' ? null:Number(e.target.value))}/>}
                <IconButton icon={Trash2} label={`Remove ${parameterOptions.find(([value])=>value===key)?.[1]} condition`} className="bundle-editor-delete" onClick={()=>setPendingParameterRemoval(key)} />
              </div>)}
            </div>}
            {availableParameterOptions.some(([key]) => !parameters.includes(key)) && <div className="bundle-name-field new-bundle-extra-picker">
              <Field label="Condition to add">
                <Select value={parameterToAdd} onChange={event=>setParameterToAdd(event.target.value)}>
                  <option value="">Choose a condition</option>
                  {availableParameterOptions.filter(([key])=>!parameters.includes(key)).map(([key,label])=><option key={key} value={key}>{label}</option>)}
                </Select>
              </Field>
              <Button type="button" disabled={!parameterToAdd} onClick={()=>{
                if (parameterToAdd === 'profileValue') change('triggerDataEnabled', true);
                setParameters(current=>[...current,parameterToAdd]);
                setParameterToAdd('');
              }}>Add condition</Button>
            </div>}
            {draft.trigger === 'current' && (parameters.includes('minAge') || parameters.includes('maxAge')) && <p className="muted bundle-name-field">Age limits include both endpoints and use the recorded date of birth. A missing birth date will not match an age-limited assessment.</p>}

          </>

        </div>
        {!(mvp && state.settings?.phase2CareActivity && state.settings?.mvpSchedulePresets !== false) && <StatusChangeFields value={draft.statusChange} onChange={value=>change('statusChange',value)} />}
        <section className="bundle-editor-assessments">
        <header className="bundle-editor-assessments-heading">
          <h3>Measures in this Assessment Pack</h3>
          <p className="muted">{editorOnly ? 'Choose the measures to include in this Pack.' : 'Mandatory measures are always included. Optional measures wait for staff selection.'}</p>
        </header>
        <div className="bundle-editor-assessment-list">{draft.assessments.map(item=> {
          const instrument = INSTRUMENTS.find(instrument=>instrument.version===item.version);
          return <BundleAssessmentRow key={item.id} name={instrument?.name} checkboxLabel={editorOnly ? undefined : 'Mandatory'}
            checked={item.requirement==='Mandatory'}
            onCheckedChange={mandatory=>changeAssessment(item.id,'requirement',mandatory ? 'Mandatory':'Optional')}
            onRemove={()=>change('assessments',draft.assessments.filter(a=>a.id!==item.id))}
          />;
        })}</div>
        {!draft.assessments.length && <p className="new-bundle-section-caption">Choose at least one measure to include.</p>}
        {availableAssessments.length ? <div className="new-bundle-extra-picker">
          <Field label="Measure type to add">
            <Select value={assessmentVersion} onChange={event=>setAssessmentVersion(event.target.value)}>
              <option value="">Choose a measure</option>
              {availableAssessments.map(instrument=><option key={instrument.version} value={instrument.version}>{instrument.name}</option>)}
            </Select>
          </Field>
          <Button type="button" disabled={!assessmentVersion} onClick={()=>{
            change('assessments',[...draft.assessments,{...blankAssessment(),version:assessmentVersion}]);
            setAssessmentVersion('');
          }}>Add measure</Button>
        </div> : <p className="muted">All available measure types are included.</p>}
        </section>
        {error && <p role="alert" className="field-error">{displayTerminology(error)}</p>}
        </div>
        <ActionGroup className="modal-footer">
          <Button type="button" onClick={closeEditor}>Cancel</Button><Button type="submit" variant="primary" disabled={!draft.assessments.length}>Save Assessment Pack</Button>
        </ActionGroup>
      </form>
      </Modal>}
      {pendingDelete && <Modal title="Delete measure?" subtitle={pendingDelete.name} onClose={()=>setPendingDelete(null)}>
        <div className="form-body"><p>This measure will be removed from Administration. Existing person measures and responses will be retained.</p></div>
        <ActionGroup className="modal-footer">
          <Button type="button" onClick={()=>setPendingDelete(null)}>Cancel</Button>
          <Button type="button" variant="primary" onClick={()=>{
            const result=commit({type:pendingDelete.type,id:pendingDelete.id});
            if(result.error){setMessage(result.error);setPendingDelete(null);return;}
            setMessage(`${pendingDelete.name} deleted. Existing person measures and responses retained.`);
            if(draft?.id===pendingDelete.id)setDraft(null);
            setPendingDelete(null);
          }}>Delete measure</Button>
        </ActionGroup>
      </Modal>}
      <ConfirmRemoval item={pendingParameterRemoval ? { name: `${parameterOptions.find(([value]) => value === pendingParameterRemoval)?.[1]} condition`, type: 'condition' } : null}
        onCancel={() => setPendingParameterRemoval(null)} onConfirm={() => {
          removeParameter(pendingParameterRemoval);
          setPendingParameterRemoval(null);
        }} />
      {message && <p role="status">{displayTerminology(message)}</p>}
    </section>
  </div>;
}
