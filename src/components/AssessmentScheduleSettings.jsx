import StandardTable from "./StandardTable";
import { COLLECTION_METHOD_OPTIONS, LABELS, appTerm, displayTerminology } from "../terminology.js";
import { Fragment, useRef, useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { INSTRUMENTS, STANDARD_INSTRUMENTS } from '../instruments';
import { PROGRAM_STREAMS, CARE_LEVELS } from '../carePeriods';
import { bundleError, asBundle, bundleName, BUNDLE_EVENT_TYPES, bundleAgeLabel, bundleTiming, instrumentSupportsRespondent } from '../assessmentBundles';
import { assessmentSmsEnabled } from '../assessmentFeatures';
import { ActionGroup, EditAction, DeleteAction, Panel, Button, Badge, Modal, Field, Select, Checkbox, Switch, IconButton } from './UI';
import { QueueRow, QueueCell } from './QueueRow';
import BundleAssessmentRow from './BundleAssessmentRow';
import { mvpAssessmentMode, mvpReviewBundles, mvpReviewItems, MVP_REVIEW_BUNDLES, mvpInitialBundles, mvpInitialVersions, MVP_INITIAL_BUNDLES } from '../mvpAssessmentPathway';
import { administrationMeasureBundles, instrumentVersionsForAdministrationMeasure, mvpDisplayBattery, mvpDisplayBundles } from '../administrationMeasures';
import MvpReviewBundleEditor from './MvpReviewBundleEditor';
import MvpInitialBundleEditor from './MvpInitialBundleEditor';
import SpecificMeasureFields from './SpecificMeasureFields';
import { measureSourceOptions, specificMeasureError } from '../measureTriggers';
import ProfileValueTriggerFields from './ProfileValueTriggerFields';
import { PROFILE_TRIGGER_FIELDS, profileValueTriggerError } from '../profileValueTriggers';
import { CLIENT_PROFILE_INSTRUMENTS, clientProfileBundle, DEFAULT_CLIENT_PROFILE_BUNDLE } from '../clientProfileMeasure';
import ClientProfileBundleEditor from './ClientProfileBundleEditor';
import ListFilterBar from './ListFilterBar';
import StatusChangeFields, { StatusChangeValue } from './StatusChangeFields';
import { ActiveFilters } from './QueueControls';

const profileConfig = ({ id, name, channel, respondent, enabled, instrumentVersions,
  timing, after, delayDays, dueDate, triggerMeasureId, triggerMeasureStatus,
  triggerDataEnabled, triggerDataField, triggerDataValue, programStream, careLevel, minAge, maxAge, statusChange }) =>
  ({ id, name, channel, respondent, enabled, instrumentVersions,
    timing, after, delayDays, dueDate, triggerMeasureId, triggerMeasureStatus,
    triggerDataEnabled, triggerDataField, triggerDataValue, programStream, careLevel, minAge, maxAge, statusChange });
const mvpInstrumentSummary = bundle => {
  if (bundle.profileMeasure) return `${bundle.instrumentVersions.length} total`;
  if (MVP_INITIAL_BUNDLES.some(item => item.id === bundle.id)) return `${mvpInitialVersions(bundle, bundle.programStream).length} total`;
  if (!bundle.coreVersion) return `${mvpReviewItems(bundle).length} total`;
  const streams = bundle.programStream && bundle.programStream !== 'All' ? [bundle.programStream] : PROGRAM_STREAMS;
  const distinctVersions = new Set(streams.flatMap(stream => mvpDisplayBattery(bundle, stream)));
  return `${distinctVersions.size} instrument type${distinctVersions.size === 1 ? '' : 's'} across ${streams.length} program stream${streams.length === 1 ? '' : 's'}`;
};

const blankAssessment = () => ({id:crypto.randomUUID(), version:'', requirement:'Mandatory'});
const blankBundle = () => ({id:crypto.randomUUID(), name:'', channel:'Clinician entry', recipient:'Person', trigger:'current', eventType:'', programStream:'All', careLevel:'All', minAge:null, maxAge:null, timing:'days', after:'intake', dueDate:'', repeat:true, days:28, delayDays:0, enabled:true, statusChange:'', assessments:[]});
const parameterOptions = [
  ['programStream', 'Program stream'], ['careLevel', 'Care level'],
  ['minAge', 'Minimum age (years)'], ['maxAge', 'Maximum age (years)'],
  ['profileValue', 'Profile data field'],
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
  const [pendingDelete, setPendingDelete] = useState(null);
  const [listStatus, setListStatus] = useState('All');
  const [listQuery, setListQuery] = useState('');
  const [listRespondent, setListRespondent] = useState('All');
  const [listStream, setListStream] = useState('Any');
  const [listMethod, setListMethod] = useState('All');
  const adminBundles = mvp ? bundles.filter(bundle => bundle.createdInMvp) : bundles;
  const systemBundles = mvp ? mvpDisplayBundles(state.settings) : [];
  const displayBundles = administrationMeasureBundles(state.settings);
  const search = listQuery.trim().toLocaleLowerCase();
  const visibleBundles = displayBundles.filter(bundle => {
    const status = bundle.example ? 'Mock' : bundle.enabled ? 'Enabled' : 'Disabled';
    if (listStatus !== 'All' && status !== listStatus) return false;
    if (listRespondent !== 'All' && (bundle.respondent || bundle.recipient) !== listRespondent) return false;
    if (listStream !== 'Any' && (bundle.programStream || 'All') !== listStream) return false;
    if (listMethod !== 'All' && bundle.channel !== listMethod) return false;
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
    const normalized = asBundle(draft);
    const validation = bundleError(normalized, bundles) || specificMeasureError(normalized, state.settings) || profileValueTriggerError(normalized);
    if (validation) {setError(validation); return;}
    const result = commit({type:'SAVE_ASSESSMENT_SCHEDULE_RULE', rule:normalized});
    if (result.error) {setError(result.error); return;}
    setDraft(null); setError(''); setMessage('Assessment saved.');
    onSaved?.(normalized);
  };
  return <div className="stack">
    {!editorOnly && !mvp && <Panel title="Automatic assessment due dates" className="admin-panel assessment-schedule-settings">
      <div className="admin-row">
        <div><h3>Enable assessments</h3><p>Prepare mandatory instruments automatically. Staff choose which optional instruments to include in each person’s Assessment tab.</p></div>
        <Switch label="Automatic assessment due dates" checked={!!state.settings?.automaticAssessmentDueDates}
          onChange={event=>commit({type:'SET_AUTOMATIC_ASSESSMENT_DUE_DATES', enabled:event.target.checked})}/>
      </div>
      <p>Schedule assessments from an event or for a specific date. Event-based schedules can repeat when configured with a time interval.</p>
      <p>Assignments are prepared in this browser. Live SMS and tablet delivery are not connected. SMS instruments wait while Assessment SMS flow is off. Existing instruments and answers are retained.</p>
    </Panel>}
    <section className="assessment-schedule-settings stack" aria-label={appTerm("measures")}>
      {!editorOnly && <>
      <div className="section-toolbar administration-section-heading">
        <div>
          <h2>{appTerm("measures")}</h2>
          {!editorOnly && <p>Configure the measures used in care reviews and collections.</p>}
        </div>
        <ActionGroup className="button-row">
          {mvp && !clientProfileBundle(state.settings) && <Button onClick={()=>setProfileDraft({ ...DEFAULT_CLIENT_PROFILE_BUNDLE,
            instrumentVersions: CLIENT_PROFILE_INSTRUMENTS.map(item => item.version) })}>Add Client profile</Button>}
          <Button variant="primary" onClick={()=>{setDraft({...blankBundle(), createdInMvp:mvp});setAssessmentVersion('');setParameterToAdd('');setParameters([]);setError('');setMessage('');}}>Add {appTerm('measures', 'singular').toLowerCase()}</Button>
        </ActionGroup>
      </div>
      <ListFilterBar id="assessment-bundle-filters" label="Assessment status"
        items={['All', 'Enabled', 'Disabled', ...(mvp ? ['Mock'] : [])].map(value => ({
          value, label:value, count:value === 'All' ? displayBundles.length : displayBundles.filter(bundle =>
            (bundle.example ? 'Mock' : bundle.enabled ? 'Enabled' : 'Disabled') === value).length,
        }))}
        value={listStatus} onChange={setListStatus} query={listQuery} onQueryChange={setListQuery}
        placeholder="Search assessments or instruments" shown={visibleBundles.length} total={displayBundles.length}
        noun="assessments" onClear={clearListFilters}
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
      <ActiveFilters items={[
        ...(listQuery ? [{id:'search', label:`Search: ${listQuery}`, onRemove:()=>setListQuery('')}] : []),
        ...(listStatus !== 'All' ? [{id:'status', label:`Status: ${listStatus}`, onRemove:()=>setListStatus('All')}] : []),
        ...(listRespondent !== 'All' ? [{id:'respondent', label:`Respondent: ${listRespondent === 'Person' ? 'Patient' : listRespondent}`, onRemove:()=>setListRespondent('All')}] : []),
        ...(listStream !== 'Any' ? [{id:'stream', label:`Program stream: ${listStream === 'All' ? 'All program streams' : listStream}`, onRemove:()=>setListStream('Any')}] : []),
        ...(listMethod !== 'All' ? [{id:'method', label:`Collection method: ${COLLECTION_METHOD_OPTIONS.find(([value])=>value===listMethod)?.[1] || listMethod}`, onRemove:()=>setListMethod('All')}] : []),
      ]} onClear={clearListFilters}/>
      {mvp && <div className="assessment-schedule-rule-list stack" aria-label={`${appTerm("measures")} configuration`}>
        {!visibleBundles.length && <p className="muted">No {appTerm("measures").toLowerCase()} match these filters.</p>}
        {visibleBundles.filter(bundle => systemBundles.some(item => item.id === bundle.id)).map(bundle => {
          return <Fragment key={bundle.id}>
          <Panel className="assessment-bundle-summary"
          title={<span className="bundle-summary-heading"><span className="bundle-summary-title">{bundle.name}{bundle.example && <Badge tone="neutral">Mock</Badge>}</span><small className="bundle-summary-id">ID: {bundle.id}</small></span>}
          action={bundle.profileMeasure ? <ActionGroup className="button-row bundle-summary-actions">
            <Switch label={`Enable ${bundle.name}`} checked={bundle.enabled} onChange={event => {
              const result = commit({type:'SAVE_CLIENT_PROFILE_BUNDLE', bundle:profileConfig({...bundle, enabled:event.target.checked})});
              setMessage(result.error || `${bundle.name} ${event.target.checked ? 'enabled' : 'disabled'}.`);
            }}/>
            <EditAction onClick={()=>setProfileDraft({...bundle})} aria-label={`Edit ${bundle.name}`}>Edit</EditAction>
            <DeleteAction onClick={()=>setPendingDelete({id:bundle.id,name:bundle.name,type:'DELETE_CLIENT_PROFILE_BUNDLE'})} aria-label={`Delete ${bundle.name}`}>Delete</DeleteAction>
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
              <div><dt>Schedule</dt><dd>{bundle.profileMeasure ? bundle.timing === 'date' ? `Due ${bundle.dueDate}` :
                `After ${bundle.after === 'specific-measure' ? `${bundle.triggerMeasureStatus} · ${measureSourceOptions(state.settings).find(item => item.id === bundle.triggerMeasureId)?.name || bundle.triggerMeasureId}` : bundle.after === 'intake' ? 'intake' : bundle.after === 'care-period' ? 'care episode starts' : 'new profile'}${bundle.delayDays ? ` + ${bundle.delayDays} days` : ''}`
                : MVP_INITIAL_BUNDLES.some(item => item.id === bundle.id) ? bundle.timing === 'date' ? `Due ${bundle.dueDate}` : `${bundle.after === 'specific-measure' ? `After ${bundle.triggerMeasureStatus} · ${bundle.triggerMeasureId === 'MVP-CLIENT-PROFILE' ? 'Client profile' : bundle.triggerMeasureId}` : bundle.after === 'intake' ? 'After intake' : 'After care episode starts'}${bundle.delayDays ? ` + ${bundle.delayDays} days` : ''}` : bundle.schedule || bundleTiming(bundle)}</dd></div>
              {bundle.triggerDataEnabled && <div><dt>Data field</dt><dd>{PROFILE_TRIGGER_FIELDS.find(field => field.id === bundle.triggerDataField)?.label}: {bundle.triggerDataValue}</dd></div>}
              <div><dt>{LABELS.respondent}</dt><dd>{bundle.respondent === 'Person' ? 'Patient' : 'Clinician'}</dd></div>
              <div><dt>{LABELS.collectionMethod}</dt><dd>{COLLECTION_METHOD_OPTIONS.find(([value])=>value===bundle.channel)?.[1]}</dd></div>
              <div><dt>Status change</dt><dd><StatusChangeValue verbatim value={bundle.statusChange} /></dd></div>
              {!bundle.example && <><div><dt>{LABELS.programStream}</dt><dd>{bundle.programStream === 'All' ? 'All program streams' : bundle.programStream}</dd></div><div><dt>Care level</dt><dd>{bundle.careLevel === 'All' ? 'All care levels' : bundle.careLevel}</dd></div><div><dt>Age</dt><dd>{bundleAgeLabel(bundle)}</dd></div></>}
            </dl>
            <details className="bundle-summary-assessments">
              <summary className="bundle-summary-assessments-heading"><span>Instruments</span><span className="muted">{mvpInstrumentSummary(bundle)}</span><ChevronDown size={18} aria-hidden="true" /></summary>
              <div className="collection-details-accordion-body">
                <StandardTable className="bundle-assessments-table" density="compact" label={`Instruments in ${bundle.name}`}>
                  <thead><tr><th scope="col">{bundle.coreVersion && !MVP_INITIAL_BUNDLES.some(item => item.id === bundle.id) ? 'Program stream' : 'Instrument'}</th>{bundle.coreVersion && !MVP_INITIAL_BUNDLES.some(item => item.id === bundle.id) && <th scope="col">Instruments</th>}</tr></thead>
                  <tbody>{bundle.profileMeasure ? CLIENT_PROFILE_INSTRUMENTS.map(instrument => <QueueRow key={instrument.version}>
                    <QueueCell label="Instrument" slot="subject" verbatim><strong>{instrument.name}</strong></QueueCell>
                  </QueueRow>) : MVP_INITIAL_BUNDLES.some(item => item.id === bundle.id)
                    ? mvpInitialVersions(bundle, bundle.programStream).map(version => <QueueRow key={version}>
                      <QueueCell label="Instrument" slot="subject" verbatim><strong>{INSTRUMENTS.find(item => item.version === version)?.name || version}</strong></QueueCell>
                    </QueueRow>)
                    : bundle.coreVersion
                    ? (bundle.programStream && bundle.programStream !== 'All' ? [bundle.programStream] : PROGRAM_STREAMS).map(stream => <QueueRow key={stream}>
                      <QueueCell label="Program stream" slot="subject"><strong>{stream}</strong></QueueCell>
                      <QueueCell label="Instruments" slot="state">{mvpDisplayBattery(bundle,stream).map(version => INSTRUMENTS.find(item => item.version === version)?.name || version).join(' · ')}</QueueCell>
                    </QueueRow>)
                    : mvpReviewItems(bundle).map(item => <QueueRow key={item.id}>
                      <QueueCell label="Instrument" slot="subject" verbatim><strong>{INSTRUMENTS.find(instrument => instrument.version === item.version)?.name || item.version}</strong></QueueCell>
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
        {mvp && <h3>User-created {appTerm('measures').toLowerCase()}</h3>}
        {mvp && !visibleBundles.some(bundle => adminBundles.some(item => item.id === bundle.id)) && <p className="muted">No {appTerm('measures').toLowerCase()} match these filters.</p>}
        {visibleBundles.filter(bundle => adminBundles.some(item => item.id === bundle.id)).map(bundle=> {
        const saved = bundles.find(item=>item.id===bundle.id);
        const mandatory=bundle.assessments.filter(item=>item.requirement==='Mandatory').length;
        const conditions=bundle.trigger==='event'
          ? [['Trigger', BUNDLE_EVENT_TYPES.find(e=>e.value===bundle.eventType)?.label], ['Due', bundleTiming(bundle)]]
          : [[LABELS.programStream, bundle.programStream==='All' ? 'All program streams' : bundle.programStream], ['Care level', bundle.careLevel==='All' ? 'All care levels' : bundle.careLevel], ['Age', bundleAgeLabel(bundle)], ['Schedule', bundleTiming(bundle)]];
        conditions.push([LABELS.collectionMethod, COLLECTION_METHOD_OPTIONS.find(([value])=>value===bundle.channel)?.[1]], [LABELS.respondent, bundle.recipient==='Person' ? 'Patient' : bundle.recipient]);
        conditions.push(['Status change', <StatusChangeValue verbatim value={bundle.statusChange} />]);
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
              <summary className="bundle-summary-assessments-heading"><span>Instruments</span><span className="muted">{bundle.assessments.length} total · {mandatory} mandatory · {bundle.assessments.length-mandatory} optional</span><ChevronDown size={18} aria-hidden="true" /></summary>
              <div className="collection-details-accordion-body">
              <StandardTable className="bundle-assessments-table" density="compact" label={`Instruments in ${bundle.name}`}>
                <thead><tr><th scope="col">Instrument</th><th scope="col">Requirement</th></tr></thead>
                <tbody>{bundle.assessments.map(item=><QueueRow key={item.id}>
                  <QueueCell label="Instrument" slot="subject"><strong>{INSTRUMENTS.find(i=>i.version===item.version)?.name}</strong></QueueCell>
                  <QueueCell label="Requirement" slot="state"><Badge tone="neutral">{item.requirement}</Badge></QueueCell>
                </QueueRow>)}</tbody>
              </StandardTable>
              </div>
            </details>
          </div>
        </Panel>;
      })}</div> : !mvp && <p className="muted">{displayTerminology('No assessments yet. Add an assessment to group the instruments for a care condition or event.')}</p>}
      </>}
      {initialDraft && <MvpInitialBundleEditor key={initialDraft.id} bundle={initialDraft} settings={state.settings}
        onClose={()=>setInitialDraft(null)} onSave={bundle=>{
          const result=commit({type:'SAVE_MVP_INITIAL_BUNDLE',bundle});
          if(!result.error)setMessage(`${appTerm('measures', 'singular')} saved.`);
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
          if(!result.error)setMessage(`${appTerm('measures', 'singular')} saved.`);
          return result;
        }}/>}
      {draft && <Modal title={bundles.some(b=>b.id===draft.id) ? 'Edit assessment':'New assessment'}
        subtitle="Configure when the assessment applies and which instruments it includes."
        onClose={closeEditor} initialFocusRef={nameInput} wide className="assessment-bundle-settings-modal">
      <form onSubmit={save} className="assessment-schedule-form">
        <div className="form-body">
        {bundleField}
        <div className="assessment-schedule-fields">
          <label className="bundle-name-field"><span>Assessment name</span><input ref={nameInput} required maxLength={80} value={draft.name} onChange={e=>change('name',e.target.value)}/></label>
          <Checkbox className="bundle-name-field assessment-schedule-enabled" label="Enable this assessment" checked={draft.enabled} onChange={e=>change('enabled',e.target.checked)}/>
          <h3 className="bundle-name-field bundle-collection-heading">Collection settings</h3>
          <label><span>{LABELS.respondent}</span><select value={draft.recipient} onChange={e=>{setDraft(current=>({...current,recipient:e.target.value,...(e.target.value==='Clinician'?{channel:'Clinician entry'}:{})}));setError('');}}><option value="Person">Patient</option><option value="Clinician">Clinician</option></select></label>
          <label><span>{LABELS.collectionMethod}</span><select value={draft.channel} onChange={e=>change('channel',e.target.value)}>{COLLECTION_METHOD_OPTIONS.filter(([value])=>value!=='SMS link' || sms || draft.channel===value).map(([value,label])=><option key={value} value={value} disabled={value==='SMS link' && !sms || draft.recipient==='Clinician' && value!=='Clinician entry'}>{label}{value==='SMS link' && !sms ? ' (SMS disabled)':''}</option>)}</select></label>
            <div className="bundle-name-field bundle-timing-fields">
              <h3 className="bundle-name-field bundle-timing-heading">Schedule</h3>
              <label><span>Trigger</span><select required value={draft.trigger === 'event' ? 'days' : ['days','date'].includes(draft.timing) ? draft.timing : ''} onChange={event=> {
                const timing = event.target.value;
                setDraft(current=>({...current,trigger:timing === 'event' ? 'event' : 'current',timing,repeat:timing === 'days' ? current.repeat : false}));
                setError('');
              }}>{!['days','date'].includes(draft.timing) && draft.trigger !== 'event' && <option value="" disabled>Choose Event or Date</option>}<option value="days">Event</option><option value="date">Date</option></select></label>
              {draft.trigger === 'event' && <>
                <label><span>Event category</span><select required value={draft.eventType} onChange={e=>change('eventType',e.target.value)}><option value="">Choose an event category</option>{BUNDLE_EVENT_TYPES.map(e=><option key={e.value} value={e.value}>{e.label}</option>)}</select></label>
                <label><span>Days after event</span><input required type="number" min="0" max="730" step="1" value={draft.delayDays} onChange={e=>change('delayDays',Number(e.target.value))}/></label>
              </>}
              {draft.trigger !== 'event' && draft.timing === 'date' && <label><span>Due date</span><input required type="date" value={draft.dueDate || ''} onChange={e=>change('dueDate',e.target.value)}/></label>}
              {draft.trigger !== 'event' && draft.timing === 'days' && <>
                <label><span>Time (days)</span><input required type="number" min="1" max="728" step="1" value={draft.days} onChange={e=>change('days',Number(e.target.value))}/></label>
                <label><span>After</span><select value={draft.after || 'care-period'} onChange={e=>setDraft(current=>({...current,after:e.target.value,...(e.target.value === 'referral' ? {repeat:false,referralStatus:current.referralStatus || 'Accepted'} : {})}))}>
                  {!mvp && !draft.after && <option value="care-period">Care period starts</option>}
                  <option value="intake">Intake</option>
                  <option value="specific-measure">Specific measure</option>
                  {mvp ? <><option value="referral">Referral</option><option value="discharge">Discharge</option></> : <><option value="discharge">Discharge</option><option value="referral">Referral</option></>}
                  {(mvp ? BUNDLE_EVENT_TYPES.filter(event=>event.value==='level-change') : BUNDLE_EVENT_TYPES).map(event=><option key={event.value} value={event.value}>{event.label}</option>)}
                </select></label>
                <SpecificMeasureFields draft={draft} settings={state.settings} change={change} />
                {draft.after === 'referral' ? <label><span>Referral status</span><select required value={draft.referralStatus || 'Accepted'} onChange={e=>change('referralStatus',e.target.value)}>{['Accepted','Denied','Reworked','Modified'].map(status=><option key={status} value={status}>{status}</option>)}</select></label> : <Checkbox className="bundle-repeat-choice" label="Repeat" checked={draft.repeat} aria-describedby={`bundle-repeat-hint-${draft.id}`} onChange={event=>change('repeat',event.target.checked)}/>}
              </>}
              <p id={`bundle-repeat-hint-${draft.id}`} className={`muted ${draft.timing === 'days' ? 'bundle-repeat-hint' : 'bundle-name-field'}`}>{draft.trigger === 'event' ? 'Runs once for each matching event.' : draft.timing === 'intake' ? 'Runs once when intake is completed for this care episode.'
                : draft.timing === 'discharge' ? 'Runs once when this care episode closes.'
                  : draft.timing === 'date' ? 'Runs once on the selected date.'
                  : draft.repeat ? `Repeats every ${draft.days} days after ${draft.after === 'intake' ? 'intake' : draft.after === 'discharge' ? 'discharge' : (draft.after === 'referral' ? `referral ${draft.referralStatus || 'Accepted'}` : BUNDLE_EVENT_TYPES.find(event=>event.value===draft.after)?.label) || 'the care period starts'}.` : `Runs once ${draft.days} days after ${draft.after === 'intake' ? 'intake' : draft.after === 'discharge' ? 'discharge' : (draft.after === 'referral' ? `referral ${draft.referralStatus || 'Accepted'}` : BUNDLE_EVENT_TYPES.find(event=>event.value===draft.after)?.label) || 'the care period starts'}.`}</p>
            </div>
          <>
            <h3 className="bundle-name-field bundle-collection-heading">Trigger conditions</h3>
            {!!parameters.length && <div className="bundle-name-field bundle-parameter-list">
              {parameters.filter(key => availableParameterOptions.some(([value]) => value === key)).map(key => <div key={key} className="bundle-parameter-row">
                {key === 'profileValue' ? <ProfileValueTriggerFields draft={draft} change={change} />
                  : key === 'programStream' ? <label><span>Program stream</span><select required value={draft.programStream === 'All' ? '' : draft.programStream} onChange={e=>change(key,e.target.value)}><option value="" disabled>Choose a program stream</option>{PROGRAM_STREAMS.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
                  : key === 'careLevel' ? <label><span>Care level</span><select required value={draft.careLevel === 'All' ? '' : draft.careLevel} onChange={e=>change(key,e.target.value)}><option value="" disabled>Choose a care level</option>{CARE_LEVELS.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
                    : <label><span>{key === 'minAge' ? 'Minimum age (years)' : 'Maximum age (years)'}</span><input required type="number" min="0" max="120" step="1" placeholder="Enter age" value={draft[key] ?? ''} onChange={e=>change(key,e.target.value==='' ? null:Number(e.target.value))}/></label>}
                <IconButton icon={Trash2} label={`Remove ${parameterOptions.find(([value])=>value===key)?.[1]} parameter`} className="bundle-editor-delete" onClick={()=>removeParameter(key)} />
              </div>)}
            </div>}
            {availableParameterOptions.some(([key]) => !parameters.includes(key)) && <div className="bundle-name-field new-bundle-extra-picker">
              <Field label="Parameter to add">
                <Select label="Parameter to add" value={parameterToAdd} onChange={event=>setParameterToAdd(event.target.value)}>
                  <option value="">Choose a parameter</option>
                  {availableParameterOptions.filter(([key])=>!parameters.includes(key)).map(([key,label])=><option key={key} value={key}>{label}</option>)}
                </Select>
              </Field>
              <Button type="button" disabled={!parameterToAdd} onClick={()=>{
                if (parameterToAdd === 'profileValue') change('triggerDataEnabled', true);
                setParameters(current=>[...current,parameterToAdd]);
                setParameterToAdd('');
              }}>Add parameter</Button>
            </div>}
            {draft.trigger === 'current' && (parameters.includes('minAge') || parameters.includes('maxAge')) && <p className="muted bundle-name-field">Age limits include both endpoints and use the recorded date of birth. A missing birth date will not match an age-limited assessment.</p>}

          </>

        </div>
        <StatusChangeFields value={draft.statusChange} onChange={value=>change('statusChange',value)} />
        <section className="bundle-editor-assessments" aria-label="Instruments in this assessment">
        <header className="bundle-editor-assessments-heading">
          <h3>Instruments in this assessment</h3>
          <p className="muted">{editorOnly ? 'Choose the instruments to include in this assessment.' : 'Mandatory instruments are always included. Optional instruments wait for staff selection.'}</p>
        </header>
        <div className="bundle-editor-assessment-list">{draft.assessments.map(item=> {
          const instrument = INSTRUMENTS.find(instrument=>instrument.version===item.version);
          return <BundleAssessmentRow key={item.id} name={instrument?.name} checkboxLabel={editorOnly ? undefined : 'Mandatory'}
            checked={item.requirement==='Mandatory'}
            onCheckedChange={mandatory=>changeAssessment(item.id,'requirement',mandatory ? 'Mandatory':'Optional')}
            onRemove={()=>change('assessments',draft.assessments.filter(a=>a.id!==item.id))}
          />;
        })}</div>
        {!draft.assessments.length && <p className="new-bundle-section-caption">Choose at least one instrument to include.</p>}
        {availableAssessments.length ? <div className="new-bundle-extra-picker">
          <Field label="Instrument type to add">
            <Select label="Instrument type to add" value={assessmentVersion} onChange={event=>setAssessmentVersion(event.target.value)}>
              <option value="">Choose an instrument</option>
              {availableAssessments.map(instrument=><option key={instrument.version} value={instrument.version}>{instrument.name}</option>)}
            </Select>
          </Field>
          <Button type="button" disabled={!assessmentVersion} onClick={()=>{
            change('assessments',[...draft.assessments,{...blankAssessment(),version:assessmentVersion}]);
            setAssessmentVersion('');
          }}>Add instrument</Button>
        </div> : <p className="muted">All available instrument types are included.</p>}
        </section>
        {error && <p role="alert" className="field-error">{displayTerminology(error)}</p>}
        </div>
        <ActionGroup className="modal-footer">
          <Button type="button" onClick={closeEditor}>Cancel</Button><Button type="submit" variant="primary" disabled={!draft.assessments.length}>Save assessment</Button>
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
      {message && <p role="status">{displayTerminology(message)}</p>}
    </section>
  </div>;
}
