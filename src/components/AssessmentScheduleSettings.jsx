import { useState } from 'react';
import { useStore } from '../store';
import { INSTRUMENTS } from '../instruments';
import { PROGRAM_STREAMS, CARE_LEVELS } from '../carePeriods';
import { scheduleRuleError } from '../assessmentSchedules';
import { Panel, Button } from './UI';

const blankRule = () => ({id:crypto.randomUUID(), version:'', programStream:'All', careLevel:'All', weeks:4, enabled:true});
export default function AssessmentScheduleSettings() {
  const {state, commit} = useStore();
  const rules = state.settings?.assessmentScheduleRules || [];
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const change = (key, value) => setDraft({...draft, [key]:value});
  const save = event => {
    event.preventDefault();
    const validation = scheduleRuleError(draft, rules);
    if (validation) {setError(validation); return;}
    const result = commit({type:'SAVE_ASSESSMENT_SCHEDULE_RULE', rule:draft});
    if (result.error) {setError(result.error); return;}
    setDraft(null); setError(''); setMessage('Scheduling rule saved.');
  };
  return <Panel title="Assessment due-date rules" className="admin-panel assessment-schedule-settings">
    <div className="admin-row">
      <div><h3>Automatic assessment due dates</h3>
        <p>Create assessments for active care episodes using the matching rules below. This does not enable future appointment booking.</p></div>
      <label className="admin-setting-toggle">
        <input type="checkbox" role="switch" aria-label="Automatic assessment due dates"
          checked={!!state.settings?.automaticAssessmentDueDates}
          onChange={event => commit({type:'SET_AUTOMATIC_ASSESSMENT_DUE_DATES',enabled:event.target.checked})}/>
        <span>{state.settings?.automaticAssessmentDueDates ? 'On' : 'Off'}</span>
      </label>
    </div>
    <p>Cadence starts on the effective date of the current care level or program stream. The first assessment is due after one interval; later assessments follow that same cycle.</p>
    <p>Rules for a specific stream and care level take priority over defaults. If a stream-only rule and a level-only rule both match, the stream rule takes priority. Existing assessments and saved responses are retained; rule changes apply when the next assessment is created.</p>
    {rules.length ? <div className="assessment-schedule-rule-list">
      {rules.map(rule => <div className="assessment-schedule-rule" key={rule.id}>
        <div><h3>{INSTRUMENTS.find(i=>i.version===rule.version)?.name || rule.version}</h3>
          <p>{rule.programStream === 'All' ? 'All program streams' : `${rule.programStream} stream`} · {rule.careLevel === 'All' ? 'All care levels' : `${rule.careLevel} care level`} · Every {rule.weeks} {rule.weeks === 1 ? 'week' : 'weeks'} · {rule.enabled ? 'Enabled' : 'Disabled'}</p></div>
        <div className="assessment-schedule-rule-actions">
          <Button onClick={()=>{setDraft({...rule}); setError(''); setMessage('');}} aria-label={`Edit ${INSTRUMENTS.find(i=>i.version===rule.version)?.name} scheduling rule`}>Edit</Button>
          <Button onClick={()=>{commit({type:'DELETE_ASSESSMENT_SCHEDULE_RULE',id:rule.id}); setMessage('Rule removed. Existing assessments retained.'); if(draft?.id===rule.id) setDraft(null);}} aria-label={`Remove ${INSTRUMENTS.find(i=>i.version===rule.version)?.name} scheduling rule`}>Remove</Button>
        </div>
      </div>)}
    </div> : <p className="muted">No scheduling rules yet. Add a rule to define which assessment is due and how often.</p>}
    {!draft && <Button onClick={()=>{setDraft(blankRule()); setError(''); setMessage('');}}>Add scheduling rule</Button>}
    {draft && <form onSubmit={save} className="assessment-schedule-form">
      <h3>{rules.some(r=>r.id===draft.id) ? 'Edit scheduling rule' : 'New scheduling rule'}</h3>
      <div className="assessment-schedule-fields">
        <label><span>Assessment type</span><select aria-label="Assessment type" required value={draft.version} onChange={e=>change('version',e.target.value)}><option value="">Choose assessment</option>{INSTRUMENTS.map(i=><option key={i.version} value={i.version}>{i.name}</option>)}</select></label>
        <label><span>Program stream</span><select aria-label="Program stream" value={draft.programStream} onChange={e=>change('programStream',e.target.value)}><option value="All">All program streams</option>{PROGRAM_STREAMS.map(s=><option key={s}>{s}</option>)}</select></label>
        <label><span>Care level</span><select aria-label="Care level" value={draft.careLevel} onChange={e=>change('careLevel',e.target.value)}><option value="All">All care levels</option>{CARE_LEVELS.map(s=><option key={s}>{s}</option>)}</select></label>
        <label><span>Every (weeks)</span><input aria-label="Every (weeks)" required type="number" min="1" max="104" step="1" value={draft.weeks} onChange={e=>change('weeks',Number(e.target.value))}/></label>
      </div>
      <label className="assessment-schedule-enabled"><input type="checkbox" checked={draft.enabled} onChange={e=>change('enabled',e.target.checked)}/>Enable this rule</label>
      {error && <p role="alert">{error}</p>}
      <div className="assessment-schedule-rule-actions"><Button type="submit" variant="primary">Save rule</Button><Button type="button" onClick={()=>{setDraft(null);setError('');}}>Cancel</Button></div>
    </form>}
    <p role="status">{message}</p>
  </Panel>;
}
