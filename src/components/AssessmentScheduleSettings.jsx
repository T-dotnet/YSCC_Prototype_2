import StandardTable from "./StandardTable";
import { COLLECTION_METHOD_OPTIONS, LABELS } from "../terminology.js";
import { Fragment, useRef, useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { INSTRUMENTS, STANDARD_INSTRUMENTS } from '../instruments';
import { PROGRAM_STREAMS, CARE_LEVELS } from '../carePeriods';
import { bundleError, asBundle, bundleName, BUNDLE_EVENT_TYPES, bundleAgeLabel, bundleTiming } from '../assessmentBundles';
import { assessmentSmsEnabled } from '../assessmentFeatures';
import { ActionGroup, EditAction, DeleteAction, Panel, Button, Badge, Modal, Field, Select, Checkbox, Switch, IconButton } from './UI';
import { QueueRow, QueueCell } from './QueueRow';
import BundleAssessmentRow from './BundleAssessmentRow';
import { mvpAssessmentMode, mvpReviewBundles, mvpReviewItems, MVP_REVIEW_BUNDLES, mvpInitialBundles, mvpInitialVersions, MVP_INITIAL_BUNDLES } from '../mvpAssessmentPathway';
import MvpReviewBundleEditor from './MvpReviewBundleEditor';
import MvpInitialBundleEditor from './MvpInitialBundleEditor';
import ListFilterBar from './ListFilterBar';
import { ActiveFilters } from './QueueControls';

const mvpMockBundles = [
  {id:'MVP-DISCHARGE-PERSON', name:'Discharge · Young person', respondent:'Person', channel:'Clinic tablet', enabled:true, example:true, schedule:'At discharge', coreVersion:'Life and care check-in v1.0'},
  {id:'MVP-DISCHARGE-FAMILY', name:'Discharge · Family', respondent:'Family respondent', channel:'Clinic tablet', enabled:true, example:true, schedule:'At discharge', coreVersion:'Your preferences and next steps v2.0'},
];
const mvpDisplayBundles = settings => {
  const reviews = mvpReviewBundles(settings);
  return [...mvpInitialBundles(settings), ...['Person', 'Family respondent'].flatMap(respondent =>
    ['General', ...PROGRAM_STREAMS.filter(stream => stream !== 'General')].flatMap(stream =>
      reviews.filter(bundle => MVP_REVIEW_BUNDLES.find(item => item.id === bundle.id)?.respondent === respondent && bundle.programStream === stream))), ...mvpMockBundles];
};
const mvpDisplayBattery = (bundle, stream) => bundle.coreVersion
  ? mvpInitialVersions(bundle, stream)
  : mvpReviewItems(bundle).map(item => item.version);
const mvpInstrumentSummary = bundle => {
  if (MVP_INITIAL_BUNDLES.some(item => item.id === bundle.id)) return `${mvpInitialVersions(bundle, bundle.programStream).length} total`;
  if (!bundle.coreVersion) return `${mvpReviewItems(bundle).length} total`;
  const streams = bundle.programStream && bundle.programStream !== 'All' ? [bundle.programStream] : PROGRAM_STREAMS;
  const distinctVersions = new Set(streams.flatMap(stream => mvpDisplayBattery(bundle, stream)));
  return `${distinctVersions.size} instrument types across ${streams.length} program stream${streams.length === 1 ? '' : 's'}`;
};

const blankAssessment = () => ({id:crypto.randomUUID(), version:'', requirement:'Mandatory'});
const blankBundle = () => ({id:crypto.randomUUID(), name:'', channel:'Clinician entry', recipient:'Person', trigger:'current', eventType:'', programStream:'All', careLevel:'All', minAge:null, maxAge:null, timing:'days', after:'intake', dueDate:'', repeat:true, days:28, delayDays:0, enabled:true, assessments:[]});
const parameterOptions = [
  ['programStream', 'Program stream'], ['careLevel', 'Care level'],
  ['minAge', 'Minimum age (years)'], ['maxAge', 'Maximum age (years)'],
];
const configuredParameters = bundle => parameterOptions.map(([key])=>key).filter(key =>
  key === 'programStream' || key === 'careLevel' ? bundle[key] !== 'All' : bundle[key] != null);
export default function AssessmentScheduleSettings({ editorOnly = false, onClose, onSaved, bundleField } = {}) {
  const {state, commit} = useStore();
  const bundles = state.settings?.assessmentScheduleRules || [];
  const mvp = mvpAssessmentMode(state.settings);
  const sms = assessmentSmsEnabled(state.settings);
  const [draft, setDraft] = useState(() => editorOnly ? blankBundle() : null);
  const [assessmentVersion, setAssessmentVersion] = useState('');
  const [parameterToAdd, setParameterToAdd] = useState('');
  const [parameters, setParameters] = useState([]);
  const availableAssessments = STANDARD_INSTRUMENTS.filter(instrument => !draft?.assessments.some(item => item.version === instrument.version));
  const nameInput = useRef(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [mvpDraft, setMvpDraft] = useState(null);
  const [initialDraft, setInitialDraft] = useState(null);
  const [listStatus, setListStatus] = useState('All');
  const [listQuery, setListQuery] = useState('');
  const [listRespondent, setListRespondent] = useState('All');
  const [listStream, setListStream] = useState('Any');
  const [listMethod, setListMethod] = useState('All');
  const displayBundles = mvp ? mvpDisplayBundles(state.settings) : bundles.map(asBundle);
  const search = listQuery.trim().toLocaleLowerCase();
  const visibleBundles = displayBundles.filter(bundle => {
    const status = bundle.example ? 'Mock' : bundle.enabled ? 'Enabled' : 'Disabled';
    if (listStatus !== 'All' && status !== listStatus) return false;
    if (listRespondent !== 'All' && (bundle.respondent || bundle.recipient) !== listRespondent) return false;
    if (listStream !== 'Any' && (bundle.programStream || 'All') !== listStream) return false;
    if (listMethod !== 'All' && bundle.channel !== listMethod) return false;
    if (!search) return true;
    const versions = mvp ? (bundle.coreVersion
      ? (bundle.programStream && bundle.programStream !== 'All' ? [bundle.programStream] : PROGRAM_STREAMS).flatMap(stream => mvpDisplayBattery(bundle, stream))
      : mvpReviewItems(bundle).map(item => item.version)) : bundle.assessments.map(item => item.version);
    return [bundle.name, bundle.programStream, bundle.schedule, ...versions.map(version =>
      INSTRUMENTS.find(instrument => instrument.version === version)?.name || version)]
      .some(value => String(value || '').toLocaleLowerCase().includes(search));
  });
  const clearListFilters = () => {setListStatus('All');setListQuery('');setListRespondent('All');setListStream('Any');setListMethod('All');};
  const closeEditor = () => {setDraft(null); setAssessmentVersion(''); setParameterToAdd(''); setParameters([]); setError(''); onClose?.();};
  const removeParameter = key => {
    setParameters(current=>current.filter(item=>item!==key));
    change(key, key === 'programStream' || key === 'careLevel' ? 'All' : null);
  };
  const change = (key, value) => {setDraft(current=>({...current, [key]:value, ...(['channel','recipient'].includes(key) ? {assessments:current.assessments.map(item=>({...item,[key]:value}))} : {})})); setError('');};
  const changeAssessment = (id, key, value) => setDraft(current=>({...current, assessments:current.assessments.map(item=> {
    if (item.id !== id) return item;
    return {...item, [key]:value};
  })}));
  const save = event => {
    event.preventDefault();
    const normalized = asBundle(draft);
    const validation = bundleError(normalized, bundles);
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
    <section className="assessment-schedule-settings stack" aria-label="Assessments">
      {!editorOnly && <>
      <div className="section-toolbar">
        <h2>Assessment bundles</h2>
        {!mvp && <Button onClick={()=>{setDraft(blankBundle());setAssessmentVersion('');setParameterToAdd('');setParameters([]);setError('');setMessage('');}}>New assessment</Button>}
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
            <option value="All">All respondents</option><option value="Person">Patient</option><option value="Family respondent">Family respondent</option>
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
        ...(listRespondent !== 'All' ? [{id:'respondent', label:`Respondent: ${listRespondent === 'Person' ? 'Patient' : 'Family respondent'}`, onRemove:()=>setListRespondent('All')}] : []),
        ...(listStream !== 'Any' ? [{id:'stream', label:`Program stream: ${listStream === 'All' ? 'All program streams' : listStream}`, onRemove:()=>setListStream('Any')}] : []),
        ...(listMethod !== 'All' ? [{id:'method', label:`Collection method: ${COLLECTION_METHOD_OPTIONS.find(([value])=>value===listMethod)?.[1] || listMethod}`, onRemove:()=>setListMethod('All')}] : []),
      ]} onClear={clearListFilters}/>
      {mvp && <div className="assessment-schedule-rule-list stack" aria-label="MVP assessment bundles">
        {!visibleBundles.length && <p className="muted">No assessments match these filters.</p>}
        {visibleBundles.map(bundle => {
          return <Fragment key={bundle.id}>
          <Panel className="assessment-bundle-summary"
          title={<span className="bundle-summary-title">{bundle.name}<Badge tone={bundle.example ? 'neutral' : bundle.enabled ? 'green' : 'neutral'}>{bundle.example ? 'Mock' : bundle.enabled ? 'Enabled' : 'Disabled'}</Badge></span>}
          action={(!bundle.coreVersion || MVP_INITIAL_BUNDLES.some(item => item.id === bundle.id)) && <ActionGroup className="button-row bundle-summary-actions">
            <Switch label={`Enable ${bundle.name}`} checked={bundle.enabled} onChange={event => {
              const result = commit({type:bundle.coreVersion ? 'SAVE_MVP_INITIAL_BUNDLE' : 'SAVE_MVP_REVIEW_BUNDLE',bundle:{...bundle,enabled:event.target.checked}});
              setMessage(result.error || `${bundle.name} ${event.target.checked ? 'enabled' : 'disabled'}.`);
            }}/>
            <EditAction onClick={()=>{MVP_INITIAL_BUNDLES.some(item => item.id === bundle.id) ? setInitialDraft({...bundle}) : setMvpDraft({...bundle});setError('');setMessage('');}} aria-label={`Edit ${bundle.name}`}>Edit</EditAction>
            <DeleteAction onClick={()=>{const result=commit({type:bundle.coreVersion ? 'DELETE_MVP_INITIAL_BUNDLE' : 'DELETE_MVP_REVIEW_BUNDLE',id:bundle.id});setMessage(result.error || `${bundle.name} removed. Existing assessments retained.`);}} aria-label={`Delete ${bundle.name}`}>Delete</DeleteAction>
          </ActionGroup>}>
          <div className="panel-body">
            <dl className="metadata bundle-summary-conditions">
              <div><dt>Schedule</dt><dd>{MVP_INITIAL_BUNDLES.some(item => item.id === bundle.id) ? bundle.delayDays ? `${bundle.delayDays} days after care episode start` : 'At care episode start' : bundle.schedule || (bundle.timing === 'date' ? `Due ${bundle.dueDate}` : `${bundle.repeat ? 'Every' : 'Once after'} ${bundle.days} days`)}</dd></div>
              <div><dt>{LABELS.respondent}</dt><dd>{bundle.respondent === 'Person' ? 'Patient' : 'Family respondent'}</dd></div>
              <div><dt>{LABELS.collectionMethod}</dt><dd>{COLLECTION_METHOD_OPTIONS.find(([value])=>value===bundle.channel)?.[1]}</dd></div>
              {!bundle.example && <><div><dt>{LABELS.programStream}</dt><dd>{bundle.programStream === 'All' ? 'All program streams' : bundle.programStream}</dd></div><div><dt>Care level</dt><dd>{bundle.careLevel === 'All' ? 'All care levels' : bundle.careLevel}</dd></div><div><dt>Age</dt><dd>{bundleAgeLabel(bundle)}</dd></div></>}
            </dl>
            <details className="bundle-summary-assessments">
              <summary className="bundle-summary-assessments-heading"><span>Instruments</span><span className="muted">{mvpInstrumentSummary(bundle)}</span><ChevronDown size={18} aria-hidden="true" /></summary>
              <div className="collection-details-accordion-body">
                <StandardTable className="bundle-assessments-table" density="compact" label={`Instruments in ${bundle.name}`}>
                  <thead><tr><th scope="col">{bundle.coreVersion && !MVP_INITIAL_BUNDLES.some(item => item.id === bundle.id) ? 'Program stream' : 'Instrument'}</th>{bundle.coreVersion && !MVP_INITIAL_BUNDLES.some(item => item.id === bundle.id) && <th scope="col">Instruments</th>}</tr></thead>
                  <tbody>{MVP_INITIAL_BUNDLES.some(item => item.id === bundle.id)
                    ? mvpInitialVersions(bundle, bundle.programStream).map(version => <QueueRow key={version}>
                      <QueueCell label="Instrument" slot="subject"><strong>{INSTRUMENTS.find(item => item.version === version)?.name || version}</strong></QueueCell>
                    </QueueRow>)
                    : bundle.coreVersion
                    ? (bundle.programStream && bundle.programStream !== 'All' ? [bundle.programStream] : PROGRAM_STREAMS).map(stream => <QueueRow key={stream}>
                      <QueueCell label="Program stream" slot="subject"><strong>{stream}</strong></QueueCell>
                      <QueueCell label="Instruments" slot="state">{mvpDisplayBattery(bundle,stream).map(version => INSTRUMENTS.find(item => item.version === version)?.name || version).join(' · ')}</QueueCell>
                    </QueueRow>)
                    : mvpReviewItems(bundle).map(item => <QueueRow key={item.id}>
                      <QueueCell label="Instrument" slot="subject"><strong>{INSTRUMENTS.find(instrument => instrument.version === item.version)?.name || item.version}</strong></QueueCell>
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
      {!mvp && (bundles.length ? <div className="assessment-schedule-rule-list stack">
        {!visibleBundles.length && <p className="muted">No assessments match these filters.</p>}
        {visibleBundles.map(bundle=> {
        const saved = bundles.find(item=>item.id===bundle.id);
        const mandatory=bundle.assessments.filter(item=>item.requirement==='Mandatory').length;
        const conditions=bundle.trigger==='event'
          ? [['Trigger', BUNDLE_EVENT_TYPES.find(e=>e.value===bundle.eventType)?.label], ['Due', bundleTiming(bundle)]]
          : [[LABELS.programStream, bundle.programStream==='All' ? 'All program streams' : bundle.programStream], ['Care level', bundle.careLevel==='All' ? 'All care levels' : bundle.careLevel], ['Age', bundleAgeLabel(bundle)], ['Schedule', bundleTiming(bundle)]];
        conditions.push([LABELS.collectionMethod, COLLECTION_METHOD_OPTIONS.find(([value])=>value===bundle.channel)?.[1]], [LABELS.respondent, bundle.recipient==='Person' ? 'Patient' : 'Family respondent']);
        return <Panel key={bundle.id} className="assessment-bundle-summary"
          title={<span className="bundle-summary-title">{bundle.name}<Badge tone={bundle.enabled ? 'green':'neutral'}>{bundle.enabled ? 'Enabled':'Disabled'}</Badge></span>}
          action={<ActionGroup className="button-row bundle-summary-actions">
            <Switch label={`Enable ${bundle.name}`} checked={bundle.enabled}
              onChange={event=> {
                  const result=commit({type:'SAVE_ASSESSMENT_SCHEDULE_RULE',rule:{...saved,enabled:event.target.checked}});
                  setMessage(result.error || `${bundle.name} ${event.target.checked ? 'enabled':'disabled'}.`);
                  if (!result.error && draft?.id===bundle.id) setDraft(current=>({...current,enabled:event.target.checked}));
                }}/>
            <EditAction onClick={()=>{setDraft(structuredClone(bundle));setAssessmentVersion('');setParameterToAdd('');setParameters(configuredParameters(bundle));setError('');setMessage('');}} aria-label={`Edit ${bundleName(saved)}`}>Edit</EditAction>
            <DeleteAction onClick={()=>{const result=commit({type:'DELETE_ASSESSMENT_SCHEDULE_RULE',id:bundle.id});if(result.error){setMessage(result.error);return;}setMessage('Assessment removed. Existing instruments retained.');if(draft?.id===bundle.id)setDraft(null);}} aria-label={`Delete ${bundleName(saved)}`}>Delete</DeleteAction>
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
      })}</div> : <p className="muted">{mvp ? 'No assessments yet.' : 'No assessments yet. Add an assessment to group the instruments for a care condition or event.'}</p>)}
      </>}
      {initialDraft && <MvpInitialBundleEditor key={initialDraft.id} bundle={initialDraft} settings={state.settings}
        onClose={()=>setInitialDraft(null)} onSave={bundle=>{
          const result=commit({type:'SAVE_MVP_INITIAL_BUNDLE',bundle});
          if(!result.error)setMessage('Assessment bundle saved.');
          return result;
        }}/>}
      {mvpDraft && <MvpReviewBundleEditor key={mvpDraft.id} bundle={mvpDraft} settings={state.settings}
        onClose={()=>setMvpDraft(null)} onSave={bundle=>{
          const result=commit({type:'SAVE_MVP_REVIEW_BUNDLE',bundle});
          if(!result.error)setMessage('Assessment bundle saved.');
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
          <label><span>{LABELS.respondent}</span><select value={draft.recipient} onChange={e=>change('recipient',e.target.value)}><option value="Person">Patient</option><option value="Family respondent">Family respondent</option></select></label>
          <label><span>{LABELS.collectionMethod}</span><select value={draft.channel} onChange={e=>change('channel',e.target.value)}>{COLLECTION_METHOD_OPTIONS.filter(([value])=>value!=='SMS link' || sms || draft.channel===value).map(([value,label])=><option key={value} value={value} disabled={value==='SMS link' && !sms}>{label}{value==='SMS link' && !sms ? ' (SMS disabled)':''}</option>)}</select></label>
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
                  {mvp ? <><option value="referral">Referral</option><option value="discharge">Discharge</option></> : <><option value="discharge">Discharge</option><option value="referral">Referral</option></>}
                  {(mvp ? BUNDLE_EVENT_TYPES.filter(event=>event.value==='level-change') : BUNDLE_EVENT_TYPES).map(event=><option key={event.value} value={event.value}>{event.label}</option>)}
                </select></label>
                {draft.after === 'referral' ? <label><span>Referral status</span><select required value={draft.referralStatus || 'Accepted'} onChange={e=>change('referralStatus',e.target.value)}>{['Accepted','Denied','Reworked','Modified'].map(status=><option key={status} value={status}>{status}</option>)}</select></label> : <Checkbox className="bundle-repeat-choice" label="Repeat" checked={draft.repeat} aria-describedby={`bundle-repeat-hint-${draft.id}`} onChange={event=>change('repeat',event.target.checked)}/>}
              </>}
              <p id={`bundle-repeat-hint-${draft.id}`} className={`muted ${draft.timing === 'days' ? 'bundle-repeat-hint' : 'bundle-name-field'}`}>{draft.trigger === 'event' ? 'Runs once for each matching event.' : draft.timing === 'intake' ? 'Runs once when intake is completed for this care episode.'
                : draft.timing === 'discharge' ? 'Runs once when this care episode closes.'
                  : draft.timing === 'date' ? 'Runs once on the selected date.'
                  : draft.repeat ? `Repeats every ${draft.days} days after ${draft.after === 'intake' ? 'intake' : draft.after === 'discharge' ? 'discharge' : (draft.after === 'referral' ? `referral ${draft.referralStatus || 'Accepted'}` : BUNDLE_EVENT_TYPES.find(event=>event.value===draft.after)?.label) || 'the care period starts'}.` : `Runs once ${draft.days} days after ${draft.after === 'intake' ? 'intake' : draft.after === 'discharge' ? 'discharge' : (draft.after === 'referral' ? `referral ${draft.referralStatus || 'Accepted'}` : BUNDLE_EVENT_TYPES.find(event=>event.value===draft.after)?.label) || 'the care period starts'}.`}</p>
            </div>
          {draft.trigger==='current' ? <>
            <h3 className="bundle-name-field bundle-collection-heading">Trigger</h3>
            {!!parameters.length && <div className="bundle-name-field bundle-parameter-list">
              {parameters.map(key => <div key={key} className="bundle-parameter-row">
                {key === 'programStream' ? <label><span>Program stream</span><select required value={draft.programStream === 'All' ? '' : draft.programStream} onChange={e=>change(key,e.target.value)}><option value="" disabled>Choose a program stream</option>{PROGRAM_STREAMS.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
                  : key === 'careLevel' ? <label><span>Care level</span><select required value={draft.careLevel === 'All' ? '' : draft.careLevel} onChange={e=>change(key,e.target.value)}><option value="" disabled>Choose a care level</option>{CARE_LEVELS.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
                    : <label><span>{key === 'minAge' ? 'Minimum age (years)' : 'Maximum age (years)'}</span><input required type="number" min="0" max="120" step="1" placeholder="Enter age" value={draft[key] ?? ''} onChange={e=>change(key,e.target.value==='' ? null:Number(e.target.value))}/></label>}
                <IconButton icon={Trash2} label={`Remove ${parameterOptions.find(([value])=>value===key)?.[1]} parameter`} className="bundle-editor-delete" onClick={()=>removeParameter(key)} />
              </div>)}
            </div>}
            {parameters.length < parameterOptions.length && <div className="bundle-name-field new-bundle-extra-picker">
              <Field label="Parameter to add">
                <Select label="Parameter to add" value={parameterToAdd} onChange={event=>setParameterToAdd(event.target.value)}>
                  <option value="">Choose a parameter</option>
                  {parameterOptions.filter(([key])=>!parameters.includes(key)).map(([key,label])=><option key={key} value={key}>{label}</option>)}
                </Select>
              </Field>
              <Button type="button" disabled={!parameterToAdd} onClick={()=>{
                setParameters(current=>[...current,parameterToAdd]);
                setParameterToAdd('');
              }}>Add parameter</Button>
            </div>}
            {(parameters.includes('minAge') || parameters.includes('maxAge')) && <p className="muted bundle-name-field">Age limits include both endpoints and use the recorded date of birth. A missing birth date will not match an age-limited assessment.</p>}

          </> : null}

        </div>
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
        {error && <p role="alert" className="field-error">{error}</p>}
        </div>
        <ActionGroup className="modal-footer">
          <Button type="button" onClick={closeEditor}>Cancel</Button><Button type="submit" variant="primary" disabled={!draft.assessments.length}>Save assessment</Button>
        </ActionGroup>
      </form>
      </Modal>}
      {message && <p role="status">{message}</p>}
    </section>
  </div>;
}
