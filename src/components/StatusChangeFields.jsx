import { MEASURE_STATUS_CHANGES } from '../measureStatusChange';
import { Select } from './UI';

export function StatusChangeValue({ value }) {
  return value || 'No status change';
}

export default function StatusChangeFields({ value, onChange, compact = false }) {
  return <section className="bundle-editor-assessments">
    <header className="bundle-editor-assessments-heading">
      {compact ? <div className="mvp-preset-label">Status change after completion</div> : <h3>Status change after completion</h3>}
    </header>
    <div className="assessment-schedule-fields">
      <Select className="bundle-name-field status-change-select" label="Status change after completion" value={value || ''} onChange={event => onChange(event.target.value)}>
          <option value="">No status change</option>
          {MEASURE_STATUS_CHANGES.map(status => <option key={status} value={status}>{status}</option>)}
      </Select>
    </div>
    <p className="muted">Set the current status when the Collection Occasion is complete.</p>
  </section>;
}
