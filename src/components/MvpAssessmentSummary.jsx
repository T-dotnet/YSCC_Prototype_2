import { useState } from 'react';
import { getInstrument } from '../instruments';
import { formatDate, TODAY } from '../model';
import { assessmentSmsEnabled } from '../assessmentFeatures';
import { ActionGroup, Badge, Button, Field, Modal, Panel, Select } from './UI';

export default function MvpAssessmentSummary({ person, episode, settings, commit, onCollect, onShowResponse }) {
  const [error, setError] = useState('');
  const [familyDialogOpen, setFamilyDialogOpen] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [familyError, setFamilyError] = useState('');
  const addFamilyRespondent = event => {
    event.preventDefault();
    if (!familyName.trim()) return setFamilyError('Enter the family respondent’s name.');
    const result = commit({ type: 'SET_MVP_FAMILY_RESPONDENT', personId: person.id,
      episodeId: episode.id, name: familyName.trim() });
    if (result.error) return setFamilyError(result.error);
    setFamilyDialogOpen(false);
    setFamilyName('');
    setFamilyError('');
  };
  const records = (episode.collections || []).filter(record => record.mvpTimepointId);
  const due = records.map(record => record.due).sort().at(-1);
  const current = records.filter(record => record.due === due);
  const stream = current[0]?.bundleContext?.programStream;
  const groups = ['Person', 'Family respondent'].map(respondent => ({
    respondent, records: current.filter(record => record.mvpRespondent === respondent),
  })).filter(group => group.records.length);
  const dueStatus = due < TODAY ? 'Past due' : due === TODAY ? 'Due today' : 'Due';
  return <Panel title="Scheduled review" className="mvp-assessment-summary"
    action={due && <Badge tone={due < TODAY ? 'coral' : due === TODAY ? 'amber' : 'neutral'}
      className="mvp-assessment-due-badge">{dueStatus} · <time dateTime={due}>{formatDate(due)}</time></Badge>}>
    <div className="panel-body stack">
      <p>{due ? <>{stream} stream · {current.length} scheduled instrument{current.length === 1 ? '' : 's'}.</> : 'No active review is scheduled for this episode.'}</p>
      {due && <div className="mvp-assessment-respondents">{groups.map(({respondent, records: bundle}) => {
        const methodLocked = bundle.some(record => record.response !== 'Not started' ||
          record.draftAnswers?.some(Boolean) || record.answers?.some(Boolean));
        const completed = bundle.filter(record => record.response === 'Submitted').length;
        const pendingRecord = bundle.find(record => record.response !== 'Submitted');
        const channel = bundle[0]?.channel || 'Clinic tablet';
        const label = bundle[0]?.bundleName || (respondent === 'Person' ? 'Young person' : 'Family');
        const familyRespondent = bundle[0]?.respondent === 'Family respondent';
        return <section key={respondent} className="mvp-assessment-respondent" aria-label={`${label} review bundle`}>
          <div className="mvp-assessment-respondent-heading"><h3>{label}</h3><Badge tone={completed === bundle.length ? 'green' : 'neutral'}>{completed} / {bundle.length} complete</Badge></div>
          <p>{bundle.map(record => getInstrument(record.version)?.name || record.label).join(' · ')}</p>
          {familyRespondent && !person.family && <p className="field-error">Add a family respondent to collect this mandatory bundle.</p>}
          <Field label={`Collection method for ${label}`}>
            <Select label={`Collection method for ${label}`}
              value={channel} disabled={methodLocked || !bundle.length}
              onChange={event => {
                const result = commit({ type: 'SET_MVP_BUNDLE_METHOD', personId: person.id, episodeId: episode.id,
                  bundleId: bundle[0].bundleId, channel: event.target.value });
                setError(result.error || '');
              }}>
              <option value="Clinic tablet">Clinic tablet</option>
              <option value="Clinician entry">Clinician entry</option>
              {assessmentSmsEnabled(settings) && <option value="SMS link">SMS link</option>}
            </Select>
          </Field>
          {!pendingRecord ? <Button variant="secondary" className="mvp-assessment-collect"
            aria-label={`Show response for ${label} review bundle`}
            onClick={() => onShowResponse({ name: bundle[0]?.bundleName || '90-day review', records: bundle })}>Show response</Button>
            : familyRespondent && !person.family
              ? <Button variant="secondary" className="mvp-assessment-collect" onClick={() => setFamilyDialogOpen(true)}>Add family respondent</Button>
              : <Button variant="secondary" className="mvp-assessment-collect"
                aria-label={`Collect response for ${label} review bundle`}
                onClick={() => onCollect(pendingRecord)}>Collect response</Button>}
        </section>;
      })}</div>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
    {familyDialogOpen && <Modal title="Add family respondent" onClose={() => { setFamilyDialogOpen(false); setFamilyError(''); }}>
      <form onSubmit={addFamilyRespondent}>
        <div className="form-body stack">
          <Field label="Family respondent name" error={familyError}>
            <input autoFocus value={familyName} onChange={event => { setFamilyName(event.target.value); setFamilyError(''); }} maxLength={120} required />
          </Field>
        </div>
        <ActionGroup className="modal-footer">
          <Button type="button" onClick={() => { setFamilyDialogOpen(false); setFamilyError(''); }}>Cancel</Button>
          <Button type="submit" variant="primary">Save respondent</Button>
        </ActionGroup>
      </form>
    </Modal>}
  </Panel>;
}
