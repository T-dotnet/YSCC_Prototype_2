import { useRef, useState } from 'react';
import { CARE_LEVELS, PROGRAM_STREAMS } from '../carePeriods';
import { INSTRUMENTS } from '../instruments';
import { COLLECTION_METHOD_OPTIONS, LABELS } from '../terminology';
import { mvpInitialBundleError, mvpInitialVersions } from '../mvpAssessmentPathway';
import { ActionGroup, Button, Checkbox, Field, FieldInput, FieldSelect, Modal, Select } from './UI';
import BundleAssessmentRow from './BundleAssessmentRow';
import SpecificMeasureFields from './SpecificMeasureFields';
import ProfileValueTriggerFields from './ProfileValueTriggerFields';
import StatusChangeFields from './StatusChangeFields';
import AllowedCollectionMethods from './AllowedCollectionMethods';

const parameterOptions = [['careLevel', 'Care level'],
  ['minAge', 'Minimum age (years)'], ['maxAge', 'Maximum age (years)'], ['profileValue', 'Profile data field']];

export default function MvpInitialBundleEditor({ bundle, settings, onClose, onSave }) {
  const [draft, setDraft] = useState(() => (settings?.phase2CareActivity && settings?.mvpSchedulePresets !== false) && (!['specific-measure', 'intake', 'care-period'].includes(bundle.after) || bundle.timing === 'date') ? { ...bundle, timing: 'days', after: 'specific-measure', delayDays: 0, triggerMeasureId: 'MVP-CLIENT-PROFILE', triggerMeasureStatus: 'completed', dueDate: '' } : bundle);
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
  return <Modal title={`Edit ${bundle.name} Assessment Pack`} subtitle="Configure when the Pack applies and which measures it includes."
    onClose={onClose} initialFocusRef={nameInput} wide className="assessment-bundle-settings-modal mvp-initial-editor">
    <form className="assessment-schedule-form" onSubmit={save}>
      <div className="form-body">
        <div className="assessment-schedule-fields">
          <FieldInput className="bundle-name-field" label="Assessment Pack name" ref={nameInput} required maxLength={80} value={draft.name} onChange={event => change('name', event.target.value)} />
          <Checkbox className="bundle-name-field assessment-schedule-enabled" label="Enable this Assessment Pack" checked={draft.enabled} onChange={event => change('enabled', event.target.checked)} />
          <h3 className="bundle-name-field bundle-collection-heading">Collection settings</h3>
          <Field label={LABELS.respondent}><Select value="Person" disabled><option value="Person">Patient</option></Select></Field>
          <AllowedCollectionMethods bundle={draft} methods={COLLECTION_METHOD_OPTIONS.filter(([value]) =>
            value !== 'SMS link' || settings.assessmentSms !== false).map(([value]) => value)} onChange={methods => {
            setDraft(current => ({ ...current, allowedCollectionMethods: methods,
              channel: methods?.length && !methods.includes(current.channel) ? methods[0] : current.channel }));
            setError('');
          }} />
          {(settings?.phase2CareActivity && settings?.mvpSchedulePresets !== false) ? <div className="bundle-name-field mvp-preset-pair">
            <div className="mvp-preset-content">
              <div className="mvp-preset-label">Care point preset</div>
            <Select className="mvp-care-point-select" label="Care point preset" value={draft.after || 'specific-measure'} onChange={event => setDraft(current => ({ ...current, timing: 'days', after: event.target.value, delayDays: 0, dueDate: '', triggerMeasureId: event.target.value === 'specific-measure' ? 'MVP-CLIENT-PROFILE' : current.triggerMeasureId, triggerMeasureStatus: 'completed' }))}>
              <option value="specific-measure">Assessment</option>
              <option value="intake">Intake</option>
              <option value="care-period">Care episode starts</option>
            </Select>
            <p className="muted">{draft.after === 'intake' ? 'Prepare once after intake is completed.' : draft.after === 'care-period' ? 'Prepare once when the care episode starts.' : 'Prepare once after Client profile is completed.'}</p>
            </div>
            <StatusChangeFields compact value={draft.statusChange} onChange={value => change('statusChange', value)} />
          </div> : <>
          <h3 className="bundle-name-field bundle-collection-heading">Schedule</h3>
          <Field label="Trigger"><Select value={draft.timing || 'days'} onChange={event => change('timing', event.target.value)}>
            <option value="days">Event</option><option value="date">Date</option>
          </Select></Field>
          {(draft.timing || 'days') === 'days' ? <>
            <FieldInput label="Time (days)" type="number" min="0" max="728" step="1" required value={draft.delayDays} onChange={event => change('delayDays', Number(event.target.value))} />
            <FieldSelect label="After" value={draft.after || 'specific-measure'} onChange={event => change('after', event.target.value)}>
              <option value="specific-measure">Specific measure</option><option value="intake">Intake</option><option value="care-period">Care episode starts</option>
            </FieldSelect>
            <SpecificMeasureFields draft={draft} settings={settings} change={change} />
          </> : <FieldInput label="Due date" type="date" required value={draft.dueDate || ''} onChange={event => change('dueDate', event.target.value)} />}
          <p className="muted bundle-name-field">For new profiles, the initial assessment follows Client profile completion by default. Existing assessments are retained.</p>
</>}
          <h3 className="bundle-name-field bundle-collection-heading">Parameter</h3>
          <div className="bundle-name-field bundle-parameter-row">
            <FieldSelect label="Program stream" required value={draft.programStream} onChange={event => {
              const programStream = event.target.value;
              setDraft(current => ({ ...current, programStream, name: current.name.endsWith(` · ${current.programStream}`)
                ? `${current.name.slice(0, -current.programStream.length)}${programStream}` : current.name }));
              setError('');
            }}>
              {PROGRAM_STREAMS.map(stream => <option key={stream} value={stream}>{stream}</option>)}
            </FieldSelect>
          </div>
          {parameters.map(key => <div key={key} className="bundle-name-field bundle-parameter-row">
            {key === 'profileValue' ? <ProfileValueTriggerFields draft={draft} change={change} />
              : key === 'careLevel' ? <FieldSelect label="Care level" required value={draft.careLevel === 'All' ? '' : draft.careLevel} onChange={event => change(key, event.target.value)}><option value="" disabled>Choose a care level</option>{CARE_LEVELS.map(value => <option key={value} value={value}>{value}</option>)}</FieldSelect>
                : <FieldInput label={key === 'minAge' ? 'Minimum age (years)' : 'Maximum age (years)'} required type="number" min="0" max="120" step="1" value={draft[key] ?? ''} onChange={event => change(key, event.target.value === '' ? null : Number(event.target.value))} />}
            <Button type="button" onClick={() => { setParameters(current => current.filter(value => value !== key)); if (key === 'profileValue') setDraft(current => ({ ...current, triggerDataEnabled: false, triggerDataField: '', triggerDataValue: '' })); else change(key, key === 'careLevel' ? 'All' : null); }}>Remove</Button>
          </div>)}
          {parameters.length < parameterOptions.length && <div className="bundle-name-field new-bundle-extra-picker"><Field label="Parameter to add"><Select value={parameterToAdd} onChange={event => setParameterToAdd(event.target.value)}><option value="">Choose a parameter</option>{parameterOptions.filter(([key]) => !parameters.includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></Field>
            <Button type="button" disabled={!parameterToAdd} onClick={() => { if (parameterToAdd === 'profileValue') change('triggerDataEnabled', true); setParameters(current => [...current, parameterToAdd]); setParameterToAdd(''); }}>Add parameter</Button></div>}
        </div>
        {!(settings?.phase2CareActivity && settings?.mvpSchedulePresets !== false) && <StatusChangeFields value={draft.statusChange} onChange={value => change('statusChange', value)} />}
        <section className="bundle-editor-assessments">
          <header className="bundle-editor-assessments-heading"><h3>Measures in this Assessment Pack</h3></header>
          <div className="bundle-editor-assessment-list">{versions.map(itemVersion => <BundleAssessmentRow key={itemVersion} name={INSTRUMENTS.find(instrument => instrument.version === itemVersion)?.name || itemVersion} onRemove={() => updateVersions(versions.filter(value => value !== itemVersion))} />)}</div>
          {!versions.length && <p className="new-bundle-section-caption">Choose at least one measure to include.</p>}
          <div className="new-bundle-extra-picker"><Field label="Measure type to add"><Select value={version} onChange={event => setVersion(event.target.value)}><option value="">Choose a measure</option>{available.map(instrument => <option key={instrument.version} value={instrument.version}>{instrument.name}</option>)}</Select></Field>
            <Button type="button" disabled={!version} onClick={() => { updateVersions([...versions, version]); setVersion(''); }}>Add measure</Button></div>
        </section>
        {error && <p role="alert" className="field-error">{error}</p>}
      </div>
      <ActionGroup className="modal-footer"><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary">Save Assessment Pack</Button></ActionGroup>
    </form>
  </Modal>;
}
