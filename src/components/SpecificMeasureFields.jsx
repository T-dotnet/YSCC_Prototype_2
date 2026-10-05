import { measureSourceOptions, measureTriggerIds, measureTriggerStatuses, MEASURE_STATUS_OPTIONS } from '../measureTriggers';
import { FieldSelect } from './UI';
import CheckboxMultiSelect from './CheckboxMultiSelect';

export default function SpecificMeasureFields({ draft, settings, change, sourceOptions }) {
  if (draft.after !== 'specific-measure') return null;
  const packs = sourceOptions || measureSourceOptions(settings, draft.id);
  if (measureTriggerIds(draft).length > 1 || measureTriggerStatuses(draft).length > 1) return <>
    <CheckboxMultiSelect label="Assessment Packs (existing rule)" placeholder="Choose Assessment Packs"
      options={packs.map(item => ({ value:item.id, label:item.name }))}
      values={measureTriggerIds(draft)} onChange={values => change('triggerMeasureIds', values)} />
    <CheckboxMultiSelect label="Assessment statuses (existing rule)" placeholder="Choose statuses"
      options={MEASURE_STATUS_OPTIONS.map(([value, label]) => ({ value, label }))}
      values={measureTriggerStatuses(draft)} onChange={values => change('triggerMeasureStatuses', values)} />
  </>;
  return <>
    <FieldSelect label="Assessment Pack" required value={measureTriggerIds(draft)[0] || ''}
      onChange={event => change('triggerMeasureIds', [event.target.value])}>
      <option value="">Choose an Assessment Pack</option>
      {packs.map(item =>
        <option key={item.id} value={item.id}>{item.name}</option>)}
    </FieldSelect>
    <FieldSelect label="Assessment status" required value={measureTriggerStatuses(draft)[0] || ''}
      onChange={event => change('triggerMeasureStatuses', [event.target.value])}>
      <option value="">Choose an assessment status</option>
      {MEASURE_STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </FieldSelect>
  </>;
}
