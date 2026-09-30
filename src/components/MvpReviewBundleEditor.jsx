import { useRef, useState } from 'react';
import { INSTRUMENTS } from '../instruments';
import { CARE_LEVELS } from '../carePeriods';
import { COLLECTION_METHOD_OPTIONS, LABELS } from '../terminology';
import { mvpBattery, mvpReviewBundleError, mvpReviewItems } from '../mvpAssessmentPathway';
import { ActionGroup, Button, Checkbox, Field, Modal, Select } from './UI';
import BundleAssessmentRow from './BundleAssessmentRow';

export default function MvpReviewBundleEditor({ bundle, settings, onClose, onSave }) {
  const [draft, setDraft] = useState(bundle);
  const [version, setVersion] = useState('');
  const [parameterToAdd, setParameterToAdd] = useState('');
  const [parameters, setParameters] = useState(['careLevel', 'minAge', 'maxAge'].filter(key =>
    key === 'careLevel' ? bundle.careLevel !== 'All' : bundle[key] != null));
  const [error, setError] = useState('');
  const nameInput = useRef(null);
  const change = (key, value) => { setDraft(current => ({ ...current, [key]: value })); setError(''); };
  const items = mvpReviewItems(draft);
  const updateItems = nextItems => {
    setDraft(current => ({ ...current, assessments: nextItems }));
    setError('');
  };
  const compatible = INSTRUMENTS.filter(instrument => instrument.respondents.includes(draft.respondent));
  const available = compatible.filter(instrument => !items.some(item => item.version === instrument.version));
  const save = event => {
    event.preventDefault();
    const validation = mvpReviewBundleError(draft, settings);
    if (validation) return setError(validation);
    if (JSON.stringify(draft) === JSON.stringify(bundle)) return onClose();
    const result = onSave(draft);
    if (result?.error) return setError(result.error);
    onClose();
  };
  return <Modal title={`Edit ${bundle.name}`} subtitle="Configure when the review applies and which instruments it includes."
    onClose={onClose} initialFocusRef={nameInput} wide className="assessment-bundle-settings-modal mvp-review-editor">
    <form className="assessment-schedule-form" onSubmit={save}>
      <div className="form-body">
        <div className="assessment-schedule-fields">
          <label className="bundle-name-field"><span>Assessment name</span><input ref={nameInput} required maxLength={80} value={draft.name} onChange={event => change('name', event.target.value)} /></label>
          <Checkbox className="bundle-name-field assessment-schedule-enabled" label="Enable this assessment" checked={draft.enabled} onChange={event => change('enabled', event.target.checked)} />
          <h3 className="bundle-name-field bundle-collection-heading">Collection settings</h3>
          <label><span>{LABELS.respondent}</span><select value={draft.respondent} onChange={event => {
            const respondent = event.target.value;
            setDraft(current => ({ ...current, respondent, assessments: mvpBattery(current.programStream, respondent)
              .map((itemVersion, index) => ({ id: `${current.programStream}-${index}`, version: itemVersion, requirement: 'Mandatory' })) }));
            setError('');
          }}><option value="Person">Patient</option><option value="Family respondent">Family respondent</option></select></label>
          <label><span>{LABELS.collectionMethod}</span><select value={draft.channel} onChange={event => change('channel', event.target.value)}>
            {COLLECTION_METHOD_OPTIONS.filter(([value]) => value !== 'SMS link' || settings.assessmentSms !== false || draft.channel === value)
              .map(([value, label]) => <option key={value} value={value} disabled={value === 'SMS link' && settings.assessmentSms === false}>{label}</option>)}
          </select></label>
          <h3 className="bundle-name-field bundle-collection-heading">Schedule</h3>
          <label><span>Trigger</span><select value={draft.timing} onChange={event => setDraft(current => ({ ...current, timing: event.target.value, repeat: event.target.value === 'days' ? current.repeat : false }))}><option value="days">Event</option><option value="date">Date</option></select></label>
          {draft.timing === 'days' ? <>
            <label><span>Time (days)</span><input type="number" min="1" max="728" step="1" required value={draft.days} onChange={event => change('days', Number(event.target.value))} /></label>
            <label><span>After</span><select value={draft.after} onChange={event => change('after', event.target.value)}><option value="intake">Intake</option><option value="care-period">Care episode starts</option></select></label>
            <Checkbox className="bundle-repeat-choice" label="Repeat" checked={draft.repeat} onChange={event => change('repeat', event.target.checked)} />
          </> : <label><span>Due date</span><input type="date" required value={draft.dueDate || ''} onChange={event => change('dueDate', event.target.value)} /></label>}
          <p className="muted bundle-name-field">{draft.timing === 'date' ? 'Runs once on the selected date.' : draft.repeat
            ? `Repeats every ${draft.days} days after ${draft.after === 'intake' ? 'intake' : 'the care episode starts'}.`
            : `Runs once ${draft.days} days after ${draft.after === 'intake' ? 'intake' : 'the care episode starts'}.`}</p>
          <h3 className="bundle-name-field bundle-collection-heading">Trigger</h3>
          <div className="bundle-name-field bundle-parameter-row">
            <label><span>Program stream</span><input value={bundle.programStream} readOnly /></label>
          </div>
          {parameters.map(key => <div key={key} className="bundle-name-field bundle-parameter-row">
            {key === 'careLevel' ? <label><span>Care level</span><select required value={draft.careLevel === 'All' ? '' : draft.careLevel} onChange={event => change(key, event.target.value)}><option value="" disabled>Choose a care level</option>{CARE_LEVELS.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
              : <label><span>{key === 'minAge' ? 'Minimum age (years)' : 'Maximum age (years)'}</span><input required type="number" min="0" max="120" step="1" value={draft[key] ?? ''} onChange={event => change(key, event.target.value === '' ? null : Number(event.target.value))} /></label>}
            <Button type="button" onClick={() => { setParameters(current => current.filter(value => value !== key)); change(key, key === 'careLevel' ? 'All' : null); }}>Remove</Button>
          </div>)}
          {parameters.length < 3 && <div className="bundle-name-field new-bundle-extra-picker"><Field label="Parameter to add"><Select label="Parameter to add" value={parameterToAdd} onChange={event => setParameterToAdd(event.target.value)}><option value="">Choose a parameter</option>{[['careLevel','Care level'],['minAge','Minimum age (years)'],['maxAge','Maximum age (years)']].filter(([key]) => !parameters.includes(key)).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</Select></Field>
            <Button type="button" disabled={!parameterToAdd} onClick={() => { setParameters(current => [...current, parameterToAdd]); setParameterToAdd(''); }}>Add parameter</Button></div>}
        </div>
        <section className="bundle-editor-assessments" aria-label="Instruments in this assessment">
          <header className="bundle-editor-assessments-heading"><h3>Instruments in this assessment</h3><p className="muted">Choose the instruments for this program stream.</p></header>
          <div className="bundle-editor-assessment-list">{items.map(item => <BundleAssessmentRow key={item.id}
            name={INSTRUMENTS.find(instrument => instrument.version === item.version)?.name || item.version}
            onRemove={() => updateItems(items.filter(candidate => candidate.id !== item.id))} />)}</div>
          {!items.length && <p className="new-bundle-section-caption">Choose at least one instrument to include.</p>}
          <div className="new-bundle-extra-picker"><Field label="Instrument type to add"><Select label="Instrument type to add" value={version} onChange={event => setVersion(event.target.value)}><option value="">Choose an instrument</option>
            {available.map(instrument => <option key={instrument.version} value={instrument.version}>{instrument.name}</option>)}</Select></Field>
            <Button type="button" disabled={!version} onClick={() => { updateItems([...items, { id: crypto.randomUUID(), version, requirement: 'Mandatory' }]); setVersion(''); }}>Add instrument</Button>
          </div>
        </section>
        {error && <p role="alert" className="field-error">{error}</p>}
      </div>
      <ActionGroup className="modal-footer"><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary">Save assessment</Button></ActionGroup>
    </form>
  </Modal>;
}
