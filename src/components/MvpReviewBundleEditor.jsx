import { useRef, useState } from 'react';
import { INSTRUMENTS } from '../instruments';
import { CARE_LEVELS, PROGRAM_STREAMS } from '../carePeriods';
import { COLLECTION_METHOD_OPTIONS, LABELS } from '../terminology';
import { mvpBattery, mvpReviewBundleError, mvpReviewItems } from '../mvpAssessmentPathway';
import { ActionGroup, Button, Checkbox, Field, FieldInput, FieldSelect, Modal, Select } from './UI';
import BundleAssessmentRow from './BundleAssessmentRow';
import ConfirmRemoval from './ConfirmRemoval';
import SpecificMeasureFields from './SpecificMeasureFields';
import ProfileValueTriggerFields from './ProfileValueTriggerFields';
import StatusChangeFields from './StatusChangeFields';
import AllowedCollectionMethods from './AllowedCollectionMethods';

const parameterOptions = [['careLevel', 'Care level'], ['minAge', 'Minimum age (years)'],
  ['maxAge', 'Maximum age (years)'], ['profileValue', 'Profile data field']];

export default function MvpReviewBundleEditor({ bundle, settings, onClose, onSave }) {
  const [draft, setDraft] = useState(() => (settings?.phase2CareActivity && settings?.mvpSchedulePresets !== false) ? { ...bundle, timing: 'days', after: 'intake', days: 90, repeat: true, dueDate: '' } : bundle);
  const [version, setVersion] = useState('');
  const [parameterToAdd, setParameterToAdd] = useState('');
  const [parameters, setParameters] = useState(parameterOptions.map(([key]) => key).filter(key =>
    key === 'profileValue' ? !!bundle.triggerDataEnabled : key === 'careLevel' ? bundle.careLevel !== 'All' : bundle[key] != null));
  const [error, setError] = useState('');
  const [pendingParameterRemoval, setPendingParameterRemoval] = useState(null);
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
  return <Modal title={`Edit ${bundle.name}`} subtitle="Configure when the review applies and which measures it includes."
    onClose={onClose} initialFocusRef={nameInput} wide className="assessment-bundle-settings-modal mvp-review-editor">
    <form className="assessment-schedule-form" onSubmit={save}>
      <div className="form-body">
        <div className="assessment-schedule-fields">
          <FieldInput className="bundle-name-field" label="Assessment Pack name" ref={nameInput} required maxLength={80} value={draft.name} onChange={event => change('name', event.target.value)} />
          <Checkbox className="bundle-name-field assessment-schedule-enabled" label="Enable this Assessment Pack" checked={draft.enabled} onChange={event => change('enabled', event.target.checked)} />
          <h3 className="bundle-name-field bundle-collection-heading">Collection settings</h3>
          <FieldSelect label={LABELS.respondent} value={draft.respondent} onChange={event => {
            const respondent = event.target.value;
            setDraft(current => ({ ...current, respondent, channel: respondent === 'Clinician' ? 'Clinician entry' : current.channel, assessments: mvpBattery(current.programStream, respondent)
              .map((itemVersion, index) => ({ id: `${current.programStream}-${index}`, version: itemVersion, requirement: 'Mandatory' })) }));
            setError('');
          }}><option value="Person">Patient</option><option value="Clinician">Clinician</option></FieldSelect>
          <AllowedCollectionMethods bundle={draft} methods={draft.respondent === 'Clinician' ? ['Clinician entry']
            : COLLECTION_METHOD_OPTIONS.filter(([value]) => value !== 'SMS link' || settings.assessmentSms !== false)
              .map(([value]) => value)} onChange={methods => {
            setDraft(current => ({ ...current, allowedCollectionMethods: methods,
              channel: methods?.length && !methods.includes(current.channel) ? methods[0] : current.channel }));
            setError('');
          }} />
          {(settings?.phase2CareActivity && settings?.mvpSchedulePresets !== false) ? <div className="bundle-name-field mvp-preset-pair">
            <div className="mvp-preset-content">
              <div className="mvp-preset-label">Care point preset</div>
            <Select className="mvp-care-point-select" label="Care point preset" value="review"><option value="review">90-day review</option></Select>
            <p className="muted">Prepare a review every 90 days after initial assessment completion while the care episode is active.</p>
            </div>
            <StatusChangeFields compact value={draft.statusChange} onChange={value => change('statusChange', value)} />
          </div> : <>
          <h3 className="bundle-name-field bundle-collection-heading">Schedule</h3>
          <FieldSelect label="Trigger" value={draft.timing} onChange={event => setDraft(current => ({ ...current, timing: event.target.value, repeat: event.target.value === 'days' ? current.repeat : false }))}><option value="days">Event</option><option value="date">Date</option></FieldSelect>
          {draft.timing === 'days' ? <>
            <FieldInput label="Time (days)" type="number" min="1" max="728" step="1" required value={draft.days} onChange={event => change('days', Number(event.target.value))} />
            <FieldSelect label="After" value={draft.after} onChange={event => change('after', event.target.value)}><option value="intake">Intake</option><option value="care-period">Care episode starts</option><option value="specific-measure">Specific Assessment Pack</option></FieldSelect>
            <SpecificMeasureFields draft={draft} settings={settings} change={change} />
            <Checkbox className="bundle-repeat-choice" label="Repeat" checked={draft.repeat} onChange={event => change('repeat', event.target.checked)} />
          </> : <FieldInput label="Due date" type="date" required value={draft.dueDate || ''} onChange={event => change('dueDate', event.target.value)} />}
          <p className="muted bundle-name-field">{draft.timing === 'date' ? 'Runs once on the selected date.' : draft.repeat
            ? `Repeats every ${draft.days} days after ${draft.after === 'specific-measure' ? 'the selected Assessment Pack status' : draft.after === 'intake' ? 'intake' : 'the care episode starts'}.`
            : `Runs once ${draft.days} days after ${draft.after === 'specific-measure' ? 'the selected Assessment Pack status' : draft.after === 'intake' ? 'intake' : 'the care episode starts'}.`}</p>
</>}
          <h3 className="bundle-name-field bundle-collection-heading">Parameter</h3>
          <div className="bundle-name-field bundle-parameter-row">
            <FieldSelect label="Program stream" required value={draft.programStream} onChange={event => {
              const programStream = event.target.value;
              setDraft(current => ({ ...current, programStream, name: current.name.endsWith(` · ${current.programStream}`)
                ? `${current.name.slice(0, -current.programStream.length)}${programStream}` : current.name,
                assessments: mvpBattery(programStream, current.respondent)
                .map((itemVersion, index) => ({ id: `${programStream}-${index}`, version: itemVersion, requirement: 'Mandatory' })) }));
              setError('');
            }}>
              {PROGRAM_STREAMS.map(stream => <option key={stream} value={stream}>{stream}</option>)}
            </FieldSelect>
          </div>
          {parameters.map(key => <div key={key} className="bundle-name-field bundle-parameter-row">
            {key === 'profileValue' ? <ProfileValueTriggerFields draft={draft} change={change} />
              : key === 'careLevel' ? <FieldSelect label="Care level" required value={draft.careLevel === 'All' ? '' : draft.careLevel} onChange={event => change(key, event.target.value)}><option value="" disabled>Choose a care level</option>{CARE_LEVELS.map(value => <option key={value} value={value}>{value}</option>)}</FieldSelect>
              : <FieldInput label={key === 'minAge' ? 'Minimum age (years)' : 'Maximum age (years)'} required type="number" min="0" max="120" step="1" value={draft[key] ?? ''} onChange={event => change(key, event.target.value === '' ? null : Number(event.target.value))} />}
            <Button type="button" onClick={() => setPendingParameterRemoval(key)}>Remove</Button>
          </div>)}
          {parameters.length < parameterOptions.length && <div className="bundle-name-field new-bundle-extra-picker"><Field label="Parameter to add"><Select value={parameterToAdd} onChange={event => setParameterToAdd(event.target.value)}><option value="">Choose a parameter</option>{parameterOptions.filter(([key]) => !parameters.includes(key)).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</Select></Field>
            <Button type="button" disabled={!parameterToAdd} onClick={() => { if (parameterToAdd === 'profileValue') change('triggerDataEnabled', true); setParameters(current => [...current, parameterToAdd]); setParameterToAdd(''); }}>Add parameter</Button></div>}
        </div>
        {!(settings?.phase2CareActivity && settings?.mvpSchedulePresets !== false) && <StatusChangeFields value={draft.statusChange} onChange={value => change('statusChange', value)} />}
        <section className="bundle-editor-assessments">
          <header className="bundle-editor-assessments-heading"><h3>Measures in this Assessment Pack</h3></header>
          <div className="bundle-editor-assessment-list">{items.map(item => <BundleAssessmentRow key={item.id}
            name={INSTRUMENTS.find(instrument => instrument.version === item.version)?.name || item.version}
            onRemove={() => updateItems(items.filter(candidate => candidate.id !== item.id))} />)}</div>
          {!items.length && <p className="new-bundle-section-caption">Choose at least one measure to include.</p>}
          <div className="new-bundle-extra-picker"><Field label="Measure type to add"><Select value={version} onChange={event => setVersion(event.target.value)}><option value="">Choose a measure</option>
            {available.map(instrument => <option key={instrument.version} value={instrument.version}>{instrument.name}</option>)}</Select></Field>
            <Button type="button" disabled={!version} onClick={() => { updateItems([...items, { id: crypto.randomUUID(), version, requirement: 'Mandatory' }]); setVersion(''); }}>Add measure</Button>
          </div>
        </section>
        {error && <p role="alert" className="field-error">{error}</p>}
      </div>
      <ActionGroup className="modal-footer"><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary">Save Assessment Pack</Button></ActionGroup>
    </form>
    <ConfirmRemoval item={pendingParameterRemoval ? { name: `${parameterOptions.find(([value]) => value === pendingParameterRemoval)?.[1]} parameter`, type: 'parameter' } : null}
      onCancel={() => setPendingParameterRemoval(null)} onConfirm={() => {
        const key = pendingParameterRemoval;
        setParameters(current => current.filter(value => value !== key));
        if (key === 'profileValue') setDraft(current => ({ ...current, triggerDataEnabled: false, triggerDataField: '', triggerDataValue: '' }));
        else change(key, key === 'careLevel' ? 'All' : null);
        setPendingParameterRemoval(null);
      }} />
  </Modal>;
}
