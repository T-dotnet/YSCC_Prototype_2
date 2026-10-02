import { measureSourceOptions, MEASURE_STATUS_OPTIONS } from '../measureTriggers';

export default function SpecificMeasureFields({ draft, settings, change, sourceOptions }) {
  if (draft.after !== 'specific-measure') return null;
  return <>
    <label><span>Measure</span><select required value={draft.triggerMeasureId || ''}
      onChange={event => change('triggerMeasureId', event.target.value)}>
      <option value="">Choose a measure</option>
      {(sourceOptions || measureSourceOptions(settings, draft.id)).map(item =>
        <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    <label><span>Status</span><select required value={draft.triggerMeasureStatus || ''}
      onChange={event => change('triggerMeasureStatus', event.target.value)}>
      <option value="">Choose a status</option>
      {MEASURE_STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
  </>;
}
