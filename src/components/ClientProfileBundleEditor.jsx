import { useRef, useState } from 'react';
import { CLIENT_PROFILE_INSTRUMENTS, clientProfileBundleError } from '../clientProfileMeasure';
import { ActionGroup, Button, Checkbox, Field, FieldInput, FieldSelect, Modal, Select } from './UI';
import BundleAssessmentRow from './BundleAssessmentRow';
import ConfirmRemoval from './ConfirmRemoval';
import MockAssessmentPackSchedule from './MockAssessmentPackSchedule';
import { measureSourceOptions, measureTriggerIds } from '../measureTriggers';
import ProfileValueTriggerFields from './ProfileValueTriggerFields';
import { CARE_LEVELS, PROGRAM_STREAMS } from '../carePeriods';
import StatusChangeFields from './StatusChangeFields';
import AllowedCollectionMethods from './AllowedCollectionMethods';

const parameterOptions = [['programStream', 'Program stream'], ['careLevel', 'Care level'], ['minAge', 'Minimum age (years)'],
  ['maxAge', 'Maximum age (years)'], ['profileValue', 'Data dictionary item']];

export default function ClientProfileBundleEditor({ bundle, settings, onClose, onSave }) {
  const [draft, setDraft] = useState(() => (settings?.phase2CareActivity && settings?.mvpSchedulePresets !== false) && (!['new-profile', 'intake', 'care-period'].includes(bundle.after) || bundle.timing === 'date') ? { ...bundle, timing: 'days', after: 'new-profile', delayDays: 0, dueDate: '' } : bundle);
  const [version, setVersion] = useState('');
  const [parameterToAdd, setParameterToAdd] = useState('');
  const [parameters, setParameters] = useState(parameterOptions.map(([key]) => key).filter(key =>
    key === 'profileValue' ? !!bundle.triggerDataEnabled :
      key === 'programStream' ? bundle.programStream && bundle.programStream !== 'All' :
      key === 'careLevel' ? bundle.careLevel && bundle.careLevel !== 'All' : bundle[key] != null));
  const [error, setError] = useState('');
  const [pendingParameterRemoval, setPendingParameterRemoval] = useState(null);
  const nameInput = useRef(null);
  const change = (key, value) => { setDraft(current => ({ ...current, [key]: value })); setError(''); };
  const selected = draft.instrumentVersions || [];
  const available = CLIENT_PROFILE_INSTRUMENTS.filter(item => !selected.includes(item.version));
  const sourceOptions = measureSourceOptions(settings, draft.id).filter(item =>
    settings?.assessmentScheduleRules?.some(rule => rule.id === item.id &&
      !(rule.after === 'specific-measure' && measureTriggerIds(rule).includes(draft.id))));
  const save = event => {
    event.preventDefault();
    const validation = clientProfileBundleError(draft, settings);
    if (validation) return setError(validation);
    if (JSON.stringify(draft) === JSON.stringify(bundle)) return onClose();
    const result = onSave(draft);
    if (result?.error) return setError(result.error);
    onClose();
  };
  return <Modal title="Edit Client profile Assessment Pack" subtitle="Configure the profile items prepared for new people. Existing responses are retained."
    onClose={onClose} initialFocusRef={nameInput} wide className="assessment-bundle-settings-modal">
    <form className="assessment-schedule-form" onSubmit={save}>
      <div className="form-body">
        <div className="assessment-schedule-fields">
          <FieldInput className="bundle-name-field" label="Assessment Pack name" ref={nameInput} required maxLength={80} value={draft.name} onChange={event => change('name', event.target.value)} />
          <Checkbox className="bundle-name-field assessment-schedule-enabled" label="Enable this Assessment Pack" checked={draft.enabled} onChange={event => change('enabled', event.target.checked)} />
          <h3 className="bundle-name-field bundle-collection-heading">Collection settings</h3>
          <Field label="Respondent"><Select value="Person" disabled><option value="Person">Patient</option></Select></Field>
          <AllowedCollectionMethods bundle={draft} methods={['Clinic tablet', 'Clinician entry',
            ...(settings?.assessmentSms === false ? [] : ['SMS link'])]} onChange={methods => {
            setDraft(current => ({ ...current, allowedCollectionMethods: methods,
              channel: methods?.length && !methods.includes(current.channel) ? methods[0] : current.channel }));
            setError('');
          }} />
          {(settings?.phase2CareActivity && settings?.mvpSchedulePresets !== false) ? <div className="bundle-name-field mvp-preset-pair">
            <div className="mvp-preset-content">
              <div className="mvp-preset-label">Care point preset</div>
            <Select className="mvp-care-point-select" label="Care point preset" value={draft.after || 'new-profile'} onChange={event => setDraft(current => ({ ...current, timing: 'days', after: event.target.value, delayDays: 0, dueDate: '' }))}>
              <option value="new-profile">New profile</option>
              <option value="intake">Intake</option>
              <option value="care-period">Care episode starts</option>
            </Select>
            <p className="muted">{draft.after === 'intake' ? 'Prepare once when intake is completed.' : draft.after === 'care-period' ? 'Prepare once when the care episode starts.' : 'Prepare once when a new profile is created.'}</p>
            </div>
            <StatusChangeFields compact value={draft.statusChange} onChange={value => change('statusChange', value)} />
          </div> : <MockAssessmentPackSchedule draft={draft} settings={settings} change={change}
            timeKey="delayDays" sourceOptions={sourceOptions} />}
          <h3 className="bundle-name-field bundle-collection-heading">Show if</h3>
          {parameters.map(key => <div key={key} className="bundle-name-field bundle-parameter-row">
            {key === 'profileValue' ? <ProfileValueTriggerFields draft={draft} change={change} />
              : key === 'programStream' ? <FieldSelect label="Program stream" required
                value={draft.programStream === 'All' ? '' : draft.programStream}
                onChange={event => change('programStream', event.target.value)}>
                <option value="" disabled>Choose a program stream</option>
                {PROGRAM_STREAMS.map(stream => <option key={stream} value={stream}>{stream}</option>)}
              </FieldSelect>
              : key === 'careLevel' ? <FieldSelect label="Care level" value={draft.careLevel || 'All'}
                onChange={event => change(key, event.target.value)}><option value="All">All care levels</option>
                {CARE_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}</FieldSelect>
                : <FieldInput label={key === 'minAge' ? 'Minimum age (years)' : 'Maximum age (years)'}
                    required type="number" min="0" max="120" step="1" value={draft[key] ?? ''}
                    onChange={event => change(key, event.target.value === '' ? null : Number(event.target.value))} />}
            <Button type="button" onClick={() => setPendingParameterRemoval(key)}>Remove</Button>
          </div>)}
          {parameters.length < parameterOptions.length && <div className="bundle-name-field new-bundle-extra-picker">
            <Field label="Condition to add"><Select value={parameterToAdd}
              onChange={event => setParameterToAdd(event.target.value)}>
              <option value="">Choose a condition</option>
              {parameterOptions.filter(([key]) => !parameters.includes(key)).map(([key, label]) =>
                <option key={key} value={key}>{label}</option>)}
            </Select></Field>
            <Button type="button" disabled={!parameterToAdd} onClick={() => {
              if (parameterToAdd === 'profileValue') change('triggerDataEnabled', true);
              setParameters(current => [...current, parameterToAdd]); setParameterToAdd('');
            }}>Add condition</Button>
          </div>}
        </div>
        {!(settings?.phase2CareActivity && settings?.mvpSchedulePresets !== false) && <StatusChangeFields value={draft.statusChange} onChange={value => change('statusChange', value)} />}
        <section className="bundle-editor-assessments">
          <header className="bundle-editor-assessments-heading"><h3>Profile items in this Assessment Pack</h3><p className="muted">Each Profile information heading is collected separately.</p></header>
          <div className="bundle-editor-assessment-list">{selected.map(itemVersion => <BundleAssessmentRow key={itemVersion}
            name={CLIENT_PROFILE_INSTRUMENTS.find(item => item.version === itemVersion)?.name || itemVersion}
            onRemove={() => change('instrumentVersions', selected.filter(value => value !== itemVersion))} />)}</div>
          {!selected.length && <p className="new-bundle-section-caption">Choose at least one measure to include.</p>}
          <div className="new-bundle-extra-picker"><Field label="Measure to add"><Select value={version} onChange={event => setVersion(event.target.value)}>
            <option value="">{available.length ? 'Choose a measure' : 'All profile measures included'}</option>
            {available.map(item => <option key={item.version} value={item.version}>{item.name}</option>)}
          </Select></Field><Button type="button" disabled={!version} onClick={() => { change('instrumentVersions', [...selected, version]); setVersion(''); }}>Add measure</Button></div>
        </section>
        {error && <p role="alert" className="field-error">{error}</p>}
      </div>
      <ActionGroup className="modal-footer"><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary">Save Assessment Pack</Button></ActionGroup>
    </form>
    <ConfirmRemoval item={pendingParameterRemoval ? { name: `${parameterOptions.find(([value]) => value === pendingParameterRemoval)?.[1]} condition`, type: 'condition' } : null}
      onCancel={() => setPendingParameterRemoval(null)} onConfirm={() => {
        const key = pendingParameterRemoval;
        setParameters(current => current.filter(value => value !== key));
        setDraft(current => key === 'profileValue'
          ? { ...current, triggerDataEnabled: false, triggerDataField: '', triggerDataValue: '' }
          : { ...current, [key]: key === 'careLevel' || key === 'programStream' ? 'All' : null });
        setError('');
        setPendingParameterRemoval(null);
      }} />
  </Modal>;
}
