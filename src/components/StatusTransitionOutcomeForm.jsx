import { useState } from 'react';
import { visibleStatusOutcomeOptions } from '../statusOutcomeRules.js';
import { ActionGroup, Button, Field, Modal, Select, ValidatedForm } from './UI';

export default function StatusTransitionOutcomeForm({ transition, rule, recordedOutcome, onClose, onSave }) {
  const [outcome, setOutcome] = useState(recordedOutcome || '');
  const [error, setError] = useState('');
  const options = visibleStatusOutcomeOptions(rule);
  return <Modal title="Record outcome" subtitle={`${transition.from} → ${transition.to}`} onClose={onClose}>
    <ValidatedForm onSubmit={event => {
      event.preventDefault();
      if (outcome === recordedOutcome) return onClose();
      const result = onSave(outcome);
      if (result?.error) setError(result.error);
      else onClose();
    }}>
      <div className="form-body">
        <Field label="Outcome" error={error}>
          <Select label="Outcome" value={outcome} required onChange={event => { setOutcome(event.target.value); setError(''); }}>
            <option value="">Choose an outcome</option>
            {recordedOutcome && !options.includes(recordedOutcome) &&
              <option value={recordedOutcome}>{recordedOutcome} (previously recorded)</option>}
            {options.map(option => <option key={option} value={option}>{option}</option>)}
          </Select>
        </Field>
      </div>
      <ActionGroup className="modal-footer">
        <Button type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary">Save outcome</Button>
      </ActionGroup>
    </ValidatedForm>
  </Modal>;
}
