import { MEASURE_STATUS_CHANGES } from '../measureStatusChange';

export function StatusChangeValue({ value }) {
  return value || 'No status change';
}

export default function StatusChangeFields({ value, onChange }) {
  return <section className="bundle-editor-assessments" aria-label="Status change">
    <header className="bundle-editor-assessments-heading">
      <h3>Status change</h3>
      <p className="muted">Set the current status when every instrument in this measure is completed.</p>
    </header>
    <div className="assessment-schedule-fields">
      <label className="bundle-name-field"><span>New status at completion</span>
        <select value={value || ''} onChange={event => onChange(event.target.value)}>
          <option value="">No status change</option>
          {MEASURE_STATUS_CHANGES.map(status => <option key={status} value={status}>{status}</option>)}
        </select>
      </label>
    </div>
  </section>;
}
