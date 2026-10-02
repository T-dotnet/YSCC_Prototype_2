import { useRef, useState } from 'react';
import { CLIENT_PROFILE_INSTRUMENTS, clientProfileBundleError } from '../clientProfileMeasure';
import { ActionGroup, Button, Checkbox, Field, Modal, Select } from './UI';
import BundleAssessmentRow from './BundleAssessmentRow';
import SpecificMeasureFields from './SpecificMeasureFields';
import { measureSourceOptions } from '../measureTriggers';
import ProfileValueTriggerFields from './ProfileValueTriggerFields';
import { CARE_LEVELS, PROGRAM_STREAMS } from '../carePeriods';
import StatusChangeFields from './StatusChangeFields';

const parameterOptions = [['careLevel', 'Care level'], ['minAge', 'Minimum age (years)'],
  ['maxAge', 'Maximum age (years)'], ['profileValue', 'Profile data field']];

export default function ClientProfileBundleEditor({ bundle, settings, onClose, onSave }) {
  const [draft, setDraft] = useState(bundle);
  const [version, setVersion] = useState('');
  const [parameterToAdd, setParameterToAdd] = useState('');
  const [parameters, setParameters] = useState(parameterOptions.map(([key]) => key).filter(key =>
    key === 'profileValue' ? !!bundle.triggerDataEnabled :
      key === 'careLevel' ? bundle.careLevel && bundle.careLevel !== 'All' : bundle[key] != null));
  const [error, setError] = useState('');
  const nameInput = useRef(null);
  const change = (key, value) => { setDraft(current => ({ ...current, [key]: value })); setError(''); };
  const selected = draft.instrumentVersions || [];
  const available = CLIENT_PROFILE_INSTRUMENTS.filter(item => !selected.includes(item.version));
  const sourceOptions = measureSourceOptions(settings, draft.id).filter(item =>
    settings?.assessmentScheduleRules?.some(rule => rule.id === item.id &&
      !(rule.after === 'specific-measure' && rule.triggerMeasureId === draft.id)));
  const save = event => {
    event.preventDefault();
    const validation = clientProfileBundleError(draft, settings);
    if (validation) return setError(validation);
    if (JSON.stringify(draft) === JSON.stringify(bundle)) return onClose();
    const result = onSave(draft);
    if (result?.error) return setError(result.error);
    onClose();
  };
  return <Modal title="Edit Client profile" subtitle="Configure the profile measure prepared for new people. Existing responses are retained."
    onClose={onClose} initialFocusRef={nameInput} wide className="assessment-bundle-settings-modal">
    <form className="assessment-schedule-form" onSubmit={save}>
      <div className="form-body">
        <div className="assessment-schedule-fields">
          <label className="bundle-name-field"><span>Measure name</span><input ref={nameInput} required maxLength={80} value={draft.name} onChange={event => change('name', event.target.value)} /></label>
          <Checkbox className="bundle-name-field assessment-schedule-enabled" label="Enable this measure" checked={draft.enabled} onChange={event => change('enabled', event.target.checked)} />
          <h3 className="bundle-name-field bundle-collection-heading">Collection settings</h3>
          <Field label="Respondent"><Select label="Respondent" value="Person" disabled><option value="Person">Patient</option></Select></Field>
          <Field label="Collection method"><Select label="Collection method" value={draft.channel} onChange={event => change('channel', event.target.value)}>
            <option value="Clinic tablet">Clinic tablet</option><option value="Clinician entry">Clinician entry</option>
          </Select></Field>
          <h3 className="bundle-name-field bundle-collection-heading">Schedule</h3>
          <Field label="Trigger"><Select label="Trigger" value={draft.timing || 'days'} onChange={event => change('timing', event.target.value)}>
            <option value="days">Event</option><option value="date">Date</option>
          </Select></Field>
          {(draft.timing || 'days') === 'days' ? <>
            <label><span>Time (days)</span><input type="number" min="0" max="728" step="1" required value={draft.delayDays ?? 0}
              onChange={event => change('delayDays', Number(event.target.value))} /></label>
            <label><span>After</span><select value={draft.after || 'new-profile'} onChange={event => change('after', event.target.value)}>
              <option value="new-profile">New profile</option><option value="intake">Intake</option>
              <option value="care-period">Care episode starts</option><option value="specific-measure">Specific measure</option>
            </select></label>
            <SpecificMeasureFields draft={draft} settings={settings} change={change} sourceOptions={sourceOptions} />
          </> : <label><span>Due date</span><input type="date" required value={draft.dueDate || ''}
            onChange={event => change('dueDate', event.target.value)} /></label>}
          <p className="muted bundle-name-field">Client profile is prepared once for each eligible profile.</p>
          <h3 className="bundle-name-field bundle-collection-heading">Trigger conditions</h3>
          <div className="bundle-name-field bundle-parameter-row"><label><span>Program stream</span><select
            value={draft.programStream || 'All'} onChange={event => change('programStream', event.target.value)}>
            <option value="All">All program streams</option>
            {PROGRAM_STREAMS.map(stream => <option key={stream} value={stream}>{stream}</option>)}
          </select></label></div>
          {parameters.map(key => <div key={key} className="bundle-name-field bundle-parameter-row">
            {key === 'profileValue' ? <ProfileValueTriggerFields draft={draft} change={change} />
              : key === 'careLevel' ? <label><span>Care level</span><select value={draft.careLevel || 'All'}
                onChange={event => change(key, event.target.value)}><option value="All">All care levels</option>
                {CARE_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}</select></label>
                : <label><span>{key === 'minAge' ? 'Minimum age (years)' : 'Maximum age (years)'}</span>
                  <input required type="number" min="0" max="120" step="1" value={draft[key] ?? ''}
                    onChange={event => change(key, event.target.value === '' ? null : Number(event.target.value))} /></label>}
            <Button type="button" onClick={() => {
              setParameters(current => current.filter(value => value !== key));
              setDraft(current => key === 'profileValue'
                ? { ...current, triggerDataEnabled: false, triggerDataField: '', triggerDataValue: '' }
                : { ...current, [key]: key === 'careLevel' ? 'All' : null });
              setError('');
            }}>Remove</Button>
          </div>)}
          {parameters.length < parameterOptions.length && <div className="bundle-name-field new-bundle-extra-picker">
            <Field label="Parameter to add"><Select label="Parameter to add" value={parameterToAdd}
              onChange={event => setParameterToAdd(event.target.value)}>
              <option value="">Choose a parameter</option>
              {parameterOptions.filter(([key]) => !parameters.includes(key)).map(([key, label]) =>
                <option key={key} value={key}>{label}</option>)}
            </Select></Field>
            <Button type="button" disabled={!parameterToAdd} onClick={() => {
              if (parameterToAdd === 'profileValue') change('triggerDataEnabled', true);
              setParameters(current => [...current, parameterToAdd]); setParameterToAdd('');
            }}>Add parameter</Button>
          </div>}
        </div>
        <StatusChangeFields value={draft.statusChange} onChange={value => change('statusChange', value)} />
        <section className="bundle-editor-assessments" aria-label="Instruments in Client profile">
          <header className="bundle-editor-assessments-heading"><h3>Instruments in this measure</h3><p className="muted">Each Profile information heading is an instrument.</p></header>
          <div className="bundle-editor-assessment-list">{selected.map(itemVersion => <BundleAssessmentRow key={itemVersion}
            name={CLIENT_PROFILE_INSTRUMENTS.find(item => item.version === itemVersion)?.name || itemVersion}
            onRemove={() => change('instrumentVersions', selected.filter(value => value !== itemVersion))} />)}</div>
          {!selected.length && <p className="new-bundle-section-caption">Choose at least one instrument to include.</p>}
          <div className="new-bundle-extra-picker"><Field label="Instrument to add"><Select label="Instrument to add" value={version} onChange={event => setVersion(event.target.value)}>
            <option value="">{available.length ? 'Choose an instrument' : 'All profile instruments included'}</option>
            {available.map(item => <option key={item.version} value={item.version}>{item.name}</option>)}
          </Select></Field><Button type="button" disabled={!version} onClick={() => { change('instrumentVersions', [...selected, version]); setVersion(''); }}>Add instrument</Button></div>
        </section>
        {error && <p role="alert" className="field-error">{error}</p>}
      </div>
      <ActionGroup className="modal-footer"><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary">Save measure</Button></ActionGroup>
    </form>
  </Modal>;
}
