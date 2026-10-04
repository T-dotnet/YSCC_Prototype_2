import { measureSourceOptions, measureTriggerIds, measureTriggerStatuses, MEASURE_STATUS_OPTIONS } from '../measureTriggers';
import CheckboxMultiSelect from './CheckboxMultiSelect';

export default function SpecificMeasureFields({ draft, settings, change, sourceOptions }) {
  if (draft.after !== 'specific-measure') return null;
  return <>
    <CheckboxMultiSelect label="Assessment Packs" placeholder="Choose Assessment Packs"
      options={(sourceOptions || measureSourceOptions(settings, draft.id)).map(item => ({ value:item.id, label:item.name }))}
      values={measureTriggerIds(draft)} onChange={values => change('triggerMeasureIds', values)} />
    <CheckboxMultiSelect label="Statuses" placeholder="Choose statuses"
      options={MEASURE_STATUS_OPTIONS.map(([value, label]) => ({ value, label }))}
      values={measureTriggerStatuses(draft)} onChange={values => change('triggerMeasureStatuses', values)} />
  </>;
}
