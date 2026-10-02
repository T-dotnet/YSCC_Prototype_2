import { useRef, useState } from 'react';
import { CARE_LEVELS, PROGRAM_STREAMS } from '../carePeriods';
import { INSTRUMENTS } from '../instruments';
import { COLLECTION_METHOD_OPTIONS, LABELS } from '../terminology';
import { mvpInitialBundleError, mvpInitialVersions } from '../mvpAssessmentPathway';
import { ActionGroup, Button, Checkbox, Field, Modal, Select } from './UI';
import BundleAssessmentRow from './BundleAssessmentRow';
import SpecificMeasureFields from './SpecificMeasureFields';
import ProfileValueTriggerFields from './ProfileValueTriggerFields';
import StatusChangeFields from './StatusChangeFields';

const parameterOptions = [['careLevel', 'Care level'],
  ['minAge', 'Minimum age (years)'], ['maxAge', 'Maximum age (years)'], ['profileValue', 'Profile data field']];

export default function MvpInitialBundleEditor({ bundle, settings, onClose, onSave }) {
  const [draft, setDraft] = useState(bundle);
  const [version, setVersion] = useState('');
  const [parameterToAdd, setParameterToAdd] = useState('');
  const [parameters, setParameters] = useState(parameterOptions.map(([key]) => key).filter(key =>
    key === 'profileValue' ? !!bundle.triggerDataEnabled : key === 'careLevel' ? bundle[key] !== 'All' : bundle[key] != null));
  const [error, setError] = useState('');
  const nameInput = useRef(null);
  const change = (key, value) => { setDraft(current => ({ ...current, [key]: value })); setError(''); };
  const versions = mvpInitialVersions(draft, draft.programStream);
  const available = INSTRUMENTS.filter(instrument => instrument.respondents.includes('Person') && !instrument.clientProfileSection && !versions.includes(instrument.version));
  const updateVersions = next => { setDraft(current => ({ ...current, assessmentsByStream: { ...current.assessmentsByStream, [current.programStream]: next } })); setError(''); };
  const save = event => {
    event.preventDefault();
    const validation = mvpInitialBundleError(draft, settings);
    if (validation) return setError(validation);
    if (JSON.stringify(draft) === JSON.stringify(bundle)) return onClose();
    const result = onSave(draft);
    if (result?.error) return setError(result.error);
    onClose();
  };
  return <Modal title={`Edit ${bundle.name}`} subtitle="Configure when the assessment applies and which instruments it includes."
    onClose={onClose} initialFocusRef={nameInput} wide className="assessment-bundle-settings-modal mvp-initial-editor">
    <form className="assessment-schedule-form" onSubmit={save}>
      <div className="form-body">
        <div className="assessment-schedule-fields">
          <label className="bundle-name-field"><span>Assessment name</span><input ref={nameInput} required maxLength={80} value={draft.name} onChange={event => change('name', event.target.value)} /></label>
          <Checkbox className="bundle-name-field assessment-schedule-enabled" label="Enable this assessment" checked={draft.enabled} onChange={event => change('enabled', event.target.checked)} />
          <h3 className="bundle-name-field bundle-collection-heading">Collection settings</h3>
          <Field label={LABELS.respondent}><Select label={LABELS.respondent} value="Person" disabled><option value="Person">Patient</option></Select></Field>
          <Field label={LABELS.collectionMethod}><Select label={LABELS.collectionMethod} value={draft.channel} onChange={event => change('channel', event.target.value)}>
            {COLLECTION_METHOD_OPTIONS.filter(([value]) => value !== 'SMS link' || settings.assessmentSms !== false || draft.channel === value)
              .map(([value, label]) => <option key={value} value={value} disabled={value === 'SMS link' && settings.assessmentSms === false}>{label}</option>)}
          </Select></Field>
          <h3 className="bundle-name-field bundle-collection-heading">Schedule</h3>
          <Field label="Trigger"><Select label="Trigger" value={draft.timing || 'days'} onChange={event => change('timing', event.target.value)}>
            <option value="days">Event</option><option value="date">Date</option>
          </Select></Field>
          {(draft.timing || 'days') === 'days' ? <>
            <label><span>Time (days)</span><input type="number" min="0" max="728" step="1" required value={draft.delayDays} onChange={event => change('delayDays', Number(event.target.value))} /></label>
            <label><span>After</span><select value={draft.after || 'specific-measure'} onChange={event => change('after', event.target.value)}>
              <option value="specific-measure">Specific measure</option><option value="intake">Intake</option><option value="care-period">Care episode starts</option>
            </select></label>
            <SpecificMeasureFields draft={draft} settings={settings} change={change} />
          </> : <label><span>Due date</span><input type="date" required value={draft.dueDate || ''} onChange={event => change('dueDate', event.target.value)} /></label>}
          <p className="muted bundle-name-field">For new profiles, the initial assessment follows Client profile completion by default. Existing assessments are retained.</p>
          <h3 className="bundle-name-field bundle-collection-heading">Trigger conditions</h3>
          <div className="bundle-name-field bundle-parameter-row">
            <label><span>Program stream</span><select required value={draft.programStream} onChange={event => {
              const programStream = event.target.value;
              setDraft(current => ({ ...current, programStream, name: current.name.endsWith(` · ${current.programStream}`)
                ? `${current.name.slice(0, -current.programStream.length)}${programStream}` : current.name }));
              setError('');
            }}>
              {PROGRAM_STREAMS.map(stream => <option key={stream} value={stream}>{stream}</option>)}
            </select></label>
          </div>
          {parameters.map(key => <div key={key} className="bundle-name-field bundle-parameter-row">
            {key === 'profileValue' ? <ProfileValueTriggerFields draft={draft} change={change} />
              : key === 'careLevel' ? <label><span>Care level</span><select required value={draft.careLevel === 'All' ? '' : draft.careLevel} onChange={event => change(key, event.target.value)}><option value="" disabled>Choose a care level</option>{CARE_LEVELS.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
                : <label><span>{key === 'minAge' ? 'Minimum age (years)' : 'Maximum age (years)'}</span><input required type="number" min="0" max="120" step="1" value={draft[key] ?? ''} onChange={event => change(key, event.target.value === '' ? null : Number(event.target.value))} /></label>}
            <Button type="button" onClick={() => { setParameters(current => current.filter(value => value !== key)); if (key === 'profileValue') setDraft(current => ({ ...current, triggerDataEnabled: false, triggerDataField: '', triggerDataValue: '' })); else change(key, key === 'careLevel' ? 'All' : null); }}>Remove</Button>
          </div>)}
          {parameters.length < parameterOptions.length && <div className="bundle-name-field new-bundle-extra-picker"><Field label="Parameter to add"><Select label="Parameter to add" value={parameterToAdd} onChange={event => setParameterToAdd(event.target.value)}><option value="">Choose a parameter</option>{parameterOptions.filter(([key]) => !parameters.includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></Field>
            <Button type="button" disabled={!parameterToAdd} onClick={() => { if (parameterToAdd === 'profileValue') change('triggerDataEnabled', true); setParameters(current => [...current, parameterToAdd]); setParameterToAdd(''); }}>Add parameter</Button></div>}
        </div>
        <StatusChangeFields value={draft.statusChange} onChange={value => change('statusChange', value)} />
        <section className="bundle-editor-assessments" aria-label="Instruments in this assessment">
          <header className="bundle-editor-assessments-heading"><h3>Instruments in this assessment</h3></header>
          <div className="bundle-editor-assessment-list">{versions.map(itemVersion => <BundleAssessmentRow key={itemVersion} name={INSTRUMENTS.find(instrument => instrument.version === itemVersion)?.name || itemVersion} onRemove={() => updateVersions(versions.filter(value => value !== itemVersion))} />)}</div>
          {!versions.length && <p className="new-bundle-section-caption">Choose at least one instrument to include.</p>}
          <div className="new-bundle-extra-picker"><Field label="Instrument type to add"><Select label="Instrument type to add" value={version} onChange={event => setVersion(event.target.value)}><option value="">Choose an instrument</option>{available.map(instrument => <option key={instrument.version} value={instrument.version}>{instrument.name}</option>)}</Select></Field>
            <Button type="button" disabled={!version} onClick={() => { updateVersions([...versions, version]); setVersion(''); }}>Add instrument</Button></div>
        </section>
        {error && <p role="alert" className="field-error">{error}</p>}
      </div>
      <ActionGroup className="modal-footer"><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary">Save assessment</Button></ActionGroup>
    </form>
  </Modal>;
}
