import StandardTable from "./StandardTable";
import { COLLECTION_METHOD_OPTIONS, LABELS } from "../terminology.js";
import { useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useStore } from '../store';
import { INSTRUMENTS } from '../instruments';
import { PROGRAM_STREAMS, CARE_LEVELS } from '../carePeriods';
import { bundleError, asBundle, bundleName, BUNDLE_EVENT_TYPES, bundleAgeLabel, bundleTiming } from '../assessmentBundles';
import { assessmentSmsEnabled } from '../assessmentFeatures';
import { ActionGroup, EditAction, DeleteAction, Panel, Button, Badge, Modal, Field, Select, Checkbox, Switch } from './UI';
import { QueueRow, QueueCell } from './QueueRow';
import BundleAssessmentRow from './BundleAssessmentRow';

const blankAssessment = () => ({id:crypto.randomUUID(), version:'', requirement:'Mandatory'});
const blankBundle = () => ({id:crypto.randomUUID(), name:'', channel:'Clinician entry', recipient:'Person', trigger:'current', eventType:'', programStream:'All', careLevel:'All', minAge:null, maxAge:null, timing:'days', after:'intake', dueDate:'', repeat:true, days:28, delayDays:0, enabled:true, assessments:[]});
export default function AssessmentScheduleSettings({ editorOnly = false, onClose, onSaved, bundleField } = {}) {
  const {state, commit} = useStore();
  const bundles = state.settings?.assessmentScheduleRules || [];
  const sms = assessmentSmsEnabled(state.settings);
  const [draft, setDraft] = useState(() => editorOnly ? blankBundle() : null);
  const [assessmentVersion, setAssessmentVersion] = useState('');
  const availableAssessments = INSTRUMENTS.filter(instrument => !draft?.assessments.some(item => item.version === instrument.version));
  const nameInput = useRef(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const closeEditor = () => {setDraft(null); setAssessmentVersion(''); setError(''); onClose?.();};
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
    {!editorOnly && <Panel title="Automatic assessment due dates" className="admin-panel assessment-schedule-settings">
      <div className="admin-row">
        <div><h3>Enable assessments</h3><p>Prepare mandatory instruments automatically. Staff choose which optional instruments to include in each person’s Assessment tab.</p></div>
        <Switch label="Automatic assessment due dates" checked={!!state.settings?.automaticAssessmentDueDates}
          onChange={event=>commit({type:'SET_AUTOMATIC_ASSESSMENT_DUE_DATES', enabled:event.target.checked})}/>
      </div>
      <p>Program stream and care level assessments run at intake, at discharge, or after a set number of days from the care period’s effective date. Time-based assessments can repeat. Event assessments run once for each matching event recorded after the assessment is enabled.</p>
      <p>Assignments are prepared in this browser. Live SMS and tablet delivery are not connected. SMS instruments wait while Assessment SMS flow is off. Existing instruments and answers are retained.</p>
    </Panel>}
    <section className="assessment-schedule-settings stack" aria-label="Assessments">
      {!editorOnly && <>
      <div className="section-toolbar">
        <h2>Assessments</h2>
        <Button onClick={()=>{setDraft(blankBundle());setAssessmentVersion('');setError('');setMessage('');}}>New assessment</Button>
      </div>
      {bundles.length ? <div className="assessment-schedule-rule-list stack">{bundles.map(saved=> {
        const bundle=asBundle(saved);
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
            <EditAction onClick={()=>{setDraft(structuredClone(bundle));setAssessmentVersion('');setError('');setMessage('');}} aria-label={`Edit ${bundleName(saved)}`}>Edit</EditAction>
            <DeleteAction onClick={()=>{const result=commit({type:'DELETE_ASSESSMENT_SCHEDULE_RULE',id:bundle.id});if(result.error){setMessage(result.error);return;}setMessage('Assessment removed. Existing instruments retained.');if(draft?.id===bundle.id)setDraft(null);}} aria-label={`Delete ${bundleName(saved)}`}>Delete</DeleteAction>
          </ActionGroup>}>
          <div className="panel-body">
            <dl className="metadata bundle-summary-conditions">{conditions.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            <details className="collection-details-accordion bundle-summary-assessments">
              <summary>
                <span className="bundle-summary-assessments-heading"><span>Instruments</span><span className="muted">{bundle.assessments.length} total · {mandatory} mandatory · {bundle.assessments.length-mandatory} optional</span></span>
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
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
      })}</div> : <p className="muted">No assessments yet. Add an assessment to group the instruments for a care condition or event.</p>}
      </>}
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
          {draft.trigger==='current' ? <>
            <label><span>{LABELS.programStream}</span><select value={draft.programStream} onChange={e=>change('programStream',e.target.value)}><option value="All">All program streams</option>{PROGRAM_STREAMS.map(s=><option key={s}>{s}</option>)}</select></label>
            <label><span>Care level</span><select value={draft.careLevel} onChange={e=>change('careLevel',e.target.value)}><option value="All">All care levels</option>{CARE_LEVELS.map(s=><option key={s}>{s}</option>)}</select></label>
            <label><span>Minimum age (years)</span><input type="number" min="0" max="120" step="1" placeholder="No minimum" value={draft.minAge ?? ''} onChange={e=>change('minAge',e.target.value==='' ? null:Number(e.target.value))}/></label>
            <label><span>Maximum age (years)</span><input type="number" min="0" max="120" step="1" placeholder="No maximum" value={draft.maxAge ?? ''} onChange={e=>change('maxAge',e.target.value==='' ? null:Number(e.target.value))}/></label>
            <p className="muted bundle-name-field">Age limits include both endpoints and use the recorded date of birth. Leave both blank for all ages; a missing birth date will not match an age-limited assessment.</p>

          </> : null}
            <div className="bundle-name-field bundle-timing-fields">
              <h3 className="bundle-name-field bundle-timing-heading">Schedule</h3>
              <label><span>Trigger</span><select value={draft.trigger === 'event' ? 'days' : draft.timing} onChange={event=> {
                const timing = event.target.value;
                setDraft(current=>({...current,trigger:timing === 'event' ? 'event' : 'current',timing,repeat:timing === 'days' ? current.repeat : false}));
                setError('');
              }}><option value="intake">Intake</option><option value="discharge">Discharge</option><option value="days">Event</option><option value="date">Date</option></select></label>
              {draft.trigger === 'event' && <>
                <label><span>Event category</span><select required value={draft.eventType} onChange={e=>change('eventType',e.target.value)}><option value="">Choose an event category</option>{BUNDLE_EVENT_TYPES.map(e=><option key={e.value} value={e.value}>{e.label}</option>)}</select></label>
                <label><span>Days after event</span><input required type="number" min="0" max="730" step="1" value={draft.delayDays} onChange={e=>change('delayDays',Number(e.target.value))}/></label>
              </>}
              {draft.trigger !== 'event' && draft.timing === 'date' && <label><span>Due date</span><input required type="date" value={draft.dueDate || ''} onChange={e=>change('dueDate',e.target.value)}/></label>}
              {draft.trigger !== 'event' && draft.timing === 'days' && <>
                <label><span>Time (days)</span><input required type="number" min="1" max="728" step="1" value={draft.days} onChange={e=>change('days',Number(e.target.value))}/></label>
                <label><span>After</span><select value={draft.after || 'care-period'} onChange={e=>setDraft(current=>({...current,after:e.target.value,...(e.target.value === 'referral' ? {repeat:false,referralStatus:current.referralStatus || 'Accepted'} : {})}))}>
                  {!draft.after && <option value="care-period">Care period starts</option>}
                  <option value="intake">Intake</option><option value="discharge">Discharge</option><option value="referral">Referral</option>
                  {BUNDLE_EVENT_TYPES.map(event=><option key={event.value} value={event.value}>{event.label}</option>)}
                </select></label>
                {draft.after === 'referral' ? <label><span>Referral status</span><select required value={draft.referralStatus || 'Accepted'} onChange={e=>change('referralStatus',e.target.value)}>{['Accepted','Denied','Reworked','Modified'].map(status=><option key={status} value={status}>{status}</option>)}</select></label> : <Checkbox className="bundle-repeat-choice" label="Repeat" checked={draft.repeat} aria-describedby={`bundle-repeat-hint-${draft.id}`} onChange={event=>change('repeat',event.target.checked)}/>}
              </>}
              <p id={`bundle-repeat-hint-${draft.id}`} className={`muted ${draft.timing === 'days' ? 'bundle-repeat-hint' : 'bundle-name-field'}`}>{draft.trigger === 'event' ? 'Runs once for each matching event.' : draft.timing === 'intake' ? 'Runs once when intake is completed for this care episode.'
                : draft.timing === 'discharge' ? 'Runs once when this care episode closes.'
                  : draft.timing === 'date' ? 'Runs once on the selected date.'
                  : draft.repeat ? `Repeats every ${draft.days} days after ${draft.after === 'intake' ? 'intake' : draft.after === 'discharge' ? 'discharge' : (draft.after === 'referral' ? `referral ${draft.referralStatus || 'Accepted'}` : BUNDLE_EVENT_TYPES.find(event=>event.value===draft.after)?.label) || 'the care period starts'}.` : `Runs once ${draft.days} days after ${draft.after === 'intake' ? 'intake' : draft.after === 'discharge' ? 'discharge' : (draft.after === 'referral' ? `referral ${draft.referralStatus || 'Accepted'}` : BUNDLE_EVENT_TYPES.find(event=>event.value===draft.after)?.label) || 'the care period starts'}.`}</p>
            </div>
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
