import StandardTable from "./StandardTable";
import { COLLECTION_METHOD_OPTIONS, LABELS } from "../terminology.js";
import { useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useStore } from '../store';
import { INSTRUMENTS } from '../instruments';
import { PROGRAM_STREAMS, CARE_LEVELS } from '../carePeriods';
import { bundleError, asBundle, bundleName, BUNDLE_EVENT_TYPES, bundleAgeLabel, bundleTiming } from '../assessmentBundles';
import { assessmentSmsEnabled } from '../assessmentFeatures';
import { ActionGroup, EditAction, DeleteAction, Panel, Button, Badge, Modal, Field, Select, Checkbox } from './UI';
import { QueueRow, QueueCell } from './QueueRow';
import BundleAssessmentRow from './BundleAssessmentRow';

const blankAssessment = () => ({id:crypto.randomUUID(), version:'', requirement:'Mandatory'});
const blankBundle = () => ({id:crypto.randomUUID(), name:'', channel:'Clinician entry', recipient:'Person', trigger:'current', eventType:'', programStream:'All', careLevel:'All', minAge:null, maxAge:null, timing:'days', repeat:true, days:28, delayDays:0, enabled:true, assessments:[]});
export default function AssessmentScheduleSettings() {
  const {state, commit} = useStore();
  const bundles = state.settings?.assessmentScheduleRules || [];
  const sms = assessmentSmsEnabled(state.settings);
  const [draft, setDraft] = useState(null);
  const [assessmentVersion, setAssessmentVersion] = useState('');
  const availableAssessments = INSTRUMENTS.filter(instrument => !draft?.assessments.some(item => item.version === instrument.version));
  const nameInput = useRef(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const closeEditor = () => {setDraft(null); setAssessmentVersion(''); setError('');};
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
    setDraft(null); setError(''); setMessage('Assessment bundle saved.');
  };
  return <div className="stack">
    <Panel title="Automatic assessment due dates" className="admin-panel assessment-schedule-settings">
      <div className="admin-row">
        <div><h3>Enable assessment bundles</h3><p>Prepare mandatory assessments automatically. Staff choose which optional assessments to include in each person’s Assessment tab.</p></div>
        <label className="admin-setting-toggle">
          <input type="checkbox" role="switch" aria-label="Automatic assessment due dates" checked={!!state.settings?.automaticAssessmentDueDates}
            onChange={event=>commit({type:'SET_AUTOMATIC_ASSESSMENT_DUE_DATES', enabled:event.target.checked})}/>
          <span>{state.settings?.automaticAssessmentDueDates ? 'On' : 'Off'}</span>
        </label>
      </div>
      <p>Program stream and care level bundles run at intake, at discharge, or after a set number of days from the care period’s effective date. Time-based bundles can repeat. Event bundles run once for each matching event recorded after the bundle is enabled.</p>
      <p>Assignments are prepared in this browser. Live SMS and tablet delivery are not connected. SMS assessments wait while Assessment SMS flow is off. Existing assessments and answers are retained.</p>
    </Panel>
    <section className="assessment-schedule-settings stack" aria-label="Assessment bundles">
      <div className="section-toolbar">
        <h2>Assessment bundles</h2>
        <Button onClick={()=>{setDraft(blankBundle());setAssessmentVersion('');setError('');setMessage('');}}>New bundle</Button>
      </div>
      {bundles.length ? <div className="assessment-schedule-rule-list stack">{bundles.map(saved=> {
        const bundle=asBundle(saved);
        const mandatory=bundle.assessments.filter(item=>item.requirement==='Mandatory').length;
        const conditions=bundle.trigger==='event'
          ? [['Trigger', BUNDLE_EVENT_TYPES.find(e=>e.value===bundle.eventType)?.label], ['Due', bundleTiming(bundle)]]
          : [[LABELS.programStream, bundle.programStream==='All' ? 'All program streams' : bundle.programStream], ['Care level', bundle.careLevel==='All' ? 'All care levels' : bundle.careLevel], ['Age', bundleAgeLabel(bundle)], ['Timing', bundleTiming(bundle)]];
        conditions.push([LABELS.collectionMethod, COLLECTION_METHOD_OPTIONS.find(([value])=>value===bundle.channel)?.[1]], [LABELS.respondent, bundle.recipient==='Person' ? 'Patient' : 'Family respondent']);
        return <Panel key={bundle.id} className="assessment-bundle-summary"
          title={<span className="bundle-summary-title">{bundle.name}<Badge tone={bundle.enabled ? 'green':'neutral'}>{bundle.enabled ? 'Enabled':'Disabled'}</Badge></span>}
          action={<ActionGroup className="button-row bundle-summary-actions">
            <label className="admin-setting-toggle">
              <input type="checkbox" role="switch" aria-label={`Enable ${bundle.name}`} checked={bundle.enabled}
                onChange={event=> {
                  const result=commit({type:'SAVE_ASSESSMENT_SCHEDULE_RULE',rule:{...saved,enabled:event.target.checked}});
                  setMessage(result.error || `${bundle.name} ${event.target.checked ? 'enabled':'disabled'}.`);
                  if (!result.error && draft?.id===bundle.id) setDraft(current=>({...current,enabled:event.target.checked}));
                }}/>
              <span>{bundle.enabled ? 'On':'Off'}</span>
            </label>
            <EditAction onClick={()=>{setDraft(structuredClone(bundle));setAssessmentVersion('');setError('');setMessage('');}} aria-label={`Edit ${bundleName(saved)}`}>Edit</EditAction>
            <DeleteAction onClick={()=>{const result=commit({type:'DELETE_ASSESSMENT_SCHEDULE_RULE',id:bundle.id});if(result.error){setMessage(result.error);return;}setMessage('Bundle removed. Existing assessments retained.');if(draft?.id===bundle.id)setDraft(null);}} aria-label={`Delete ${bundleName(saved)}`}>Delete</DeleteAction>
          </ActionGroup>}>
          <div className="panel-body">
            <dl className="metadata bundle-summary-conditions">{conditions.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            <details className="collection-details-accordion bundle-summary-assessments">
              <summary>
                <span className="bundle-summary-assessments-heading"><span>Assessments</span><span className="muted">{bundle.assessments.length} total · {mandatory} mandatory · {bundle.assessments.length-mandatory} optional</span></span>
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
              <div className="collection-details-accordion-body">
              <StandardTable className="bundle-assessments-table" density="compact" label={`Assessments in ${bundle.name}`}>
                <thead><tr><th scope="col">Assessment</th><th scope="col">Requirement</th></tr></thead>
                <tbody>{bundle.assessments.map(item=><QueueRow key={item.id}>
                  <QueueCell label="Assessment" slot="subject"><strong>{INSTRUMENTS.find(i=>i.version===item.version)?.name}</strong></QueueCell>
                  <QueueCell label="Requirement" slot="state"><Badge tone="neutral">{item.requirement}</Badge></QueueCell>
                </QueueRow>)}</tbody>
              </StandardTable>
              </div>
            </details>
          </div>
        </Panel>;
      })}</div> : <p className="muted">No bundles yet. Add a bundle to group the assessments for a care condition or event.</p>}
      {draft && <Modal title={bundles.some(b=>b.id===draft.id) ? 'Edit bundle':'New bundle'}
        subtitle="Configure when the bundle applies and which assessments it includes."
        onClose={closeEditor} initialFocusRef={nameInput} wide className="assessment-bundle-settings-modal">
      <form onSubmit={save} className="assessment-schedule-form">
        <div className="form-body">
        <div className="assessment-schedule-fields">
          <label className="bundle-name-field"><span>Bundle name</span><input ref={nameInput} required maxLength={80} value={draft.name} onChange={e=>change('name',e.target.value)}/></label>
          <Checkbox className="bundle-name-field assessment-schedule-enabled" label="Enable this bundle" checked={draft.enabled} onChange={e=>change('enabled',e.target.checked)}/>
          <label className="bundle-name-field"><span>Schedule based on</span><select value={draft.trigger} onChange={e=>change('trigger',e.target.value)}><option value="current">Program stream and care level</option><option value="event">Event trigger</option></select></label>
          <h3 className="bundle-name-field bundle-collection-heading">Collection settings</h3>
          <label><span>{LABELS.respondent}</span><select value={draft.recipient} onChange={e=>change('recipient',e.target.value)}><option value="Person">Patient</option><option value="Family respondent">Family respondent</option></select></label>
          <label><span>{LABELS.collectionMethod}</span><select value={draft.channel} onChange={e=>change('channel',e.target.value)}>{COLLECTION_METHOD_OPTIONS.filter(([value])=>value!=='SMS link' || sms || draft.channel===value).map(([value,label])=><option key={value} value={value} disabled={value==='SMS link' && !sms}>{label}{value==='SMS link' && !sms ? ' (SMS disabled)':''}</option>)}</select></label>
          {draft.trigger==='current' ? <>
            <label><span>{LABELS.programStream}</span><select value={draft.programStream} onChange={e=>change('programStream',e.target.value)}><option value="All">All program streams</option>{PROGRAM_STREAMS.map(s=><option key={s}>{s}</option>)}</select></label>
            <label><span>Care level</span><select value={draft.careLevel} onChange={e=>change('careLevel',e.target.value)}><option value="All">All care levels</option>{CARE_LEVELS.map(s=><option key={s}>{s}</option>)}</select></label>
            <label><span>Minimum age (years)</span><input type="number" min="0" max="120" step="1" placeholder="No minimum" value={draft.minAge ?? ''} onChange={e=>change('minAge',e.target.value==='' ? null:Number(e.target.value))}/></label>
            <label><span>Maximum age (years)</span><input type="number" min="0" max="120" step="1" placeholder="No maximum" value={draft.maxAge ?? ''} onChange={e=>change('maxAge',e.target.value==='' ? null:Number(e.target.value))}/></label>
            <p className="muted bundle-name-field">Age limits include both endpoints and use the recorded date of birth. Leave both blank for all ages; a missing birth date will not match an age-limited bundle.</p>
            <div className="bundle-name-field bundle-timing-fields">
              <h3 className="bundle-name-field bundle-timing-heading">Schedule</h3>
              <label><span>Timing</span><select value={draft.timing} onChange={event=> {
                const timing = event.target.value;
                setDraft(current=>({...current,timing,repeat:timing === 'days' ? current.repeat : false}));
                setError('');
              }}><option value="intake">Intake</option><option value="discharge">Discharge</option><option value="days">Time (days)</option></select></label>
              {draft.timing === 'days' && <>
                <label><span>Time (days)</span><input required type="number" min="1" max="728" step="1" value={draft.days} onChange={e=>change('days',Number(e.target.value))}/></label>
                <Checkbox className="bundle-repeat-choice" label="Repeat" checked={draft.repeat} aria-describedby={`bundle-repeat-hint-${draft.id}`} onChange={event=>change('repeat',event.target.checked)}/>
              </>}
              <p id={`bundle-repeat-hint-${draft.id}`} className={`muted ${draft.timing === 'days' ? 'bundle-repeat-hint' : 'bundle-name-field'}`}>{draft.timing === 'intake' ? 'Runs once when intake is completed for this care episode.'
                : draft.timing === 'discharge' ? 'Runs once when this care episode closes.'
                  : draft.repeat ? 'Repeats from the care period’s effective date.' : 'Runs once after the care period’s effective date.'}</p>
            </div>
          </> : <>
            <label><span>Triggering event</span><select required value={draft.eventType} onChange={e=>change('eventType',e.target.value)}><option value="">Choose an event</option>{BUNDLE_EVENT_TYPES.map(e=><option key={e.value} value={e.value}>{e.label}</option>)}</select></label>
            <label><span>Days after event</span><input required type="number" min="0" max="730" step="1" value={draft.delayDays} onChange={e=>change('delayDays',Number(e.target.value))}/></label>
          </>}
        </div>
        <section className="bundle-editor-assessments" aria-label="Assessments in this bundle">
        <header className="bundle-editor-assessments-heading">
          <h3>Assessments in this bundle</h3>
          <p className="muted">Mandatory assessments are always included. Optional assessments wait for staff selection.</p>
        </header>
        <div className="bundle-editor-assessment-list">{draft.assessments.map(item=> {
          const instrument = INSTRUMENTS.find(instrument=>instrument.version===item.version);
          return <BundleAssessmentRow key={item.id} name={instrument?.name} checkboxLabel="Mandatory"
            checked={item.requirement==='Mandatory'}
            onCheckedChange={mandatory=>changeAssessment(item.id,'requirement',mandatory ? 'Mandatory':'Optional')}
            onRemove={()=>change('assessments',draft.assessments.filter(a=>a.id!==item.id))}
          />;
        })}</div>
        {!draft.assessments.length && <p className="new-bundle-section-caption">Choose at least one assessment to include.</p>}
        {availableAssessments.length ? <div className="new-bundle-extra-picker">
          <Field label="Assessment type to add">
            <Select label="Assessment type to add" value={assessmentVersion} onChange={event=>setAssessmentVersion(event.target.value)}>
              <option value="">Choose an assessment</option>
              {availableAssessments.map(instrument=><option key={instrument.version} value={instrument.version}>{instrument.name}</option>)}
            </Select>
          </Field>
          <Button type="button" disabled={!assessmentVersion} onClick={()=>{
            change('assessments',[...draft.assessments,{...blankAssessment(),version:assessmentVersion}]);
            setAssessmentVersion('');
          }}>Add assessment</Button>
        </div> : <p className="muted">All available assessment types are included.</p>}
        </section>
        {error && <p role="alert" className="field-error">{error}</p>}
        </div>
        <ActionGroup className="modal-footer">
          <div className="new-bundle-creation-summary" role="status"><strong>{draft.assessments.length} assessment{draft.assessments.length===1 ? '' : 's'} included</strong></div>
          <Button type="button" onClick={closeEditor}>Cancel</Button><Button type="submit" variant="primary" disabled={!draft.assessments.length}>Save bundle</Button>
        </ActionGroup>
      </form>
      </Modal>}
      {message && <p role="status">{message}</p>}
    </section>
  </div>;
}
