import { PROFILE_TRIGGER_FIELDS } from '../profileValueTriggers';
import { FieldSelect } from './UI';

export default function ProfileValueTriggerFields({ draft, change }) {
  const selected = PROFILE_TRIGGER_FIELDS.find(item => item.id === draft.triggerDataField);
  return <>
    <FieldSelect label="Data field" verbatim required value={draft.triggerDataField || ''}
      onChange={event => { change('triggerDataField', event.target.value); change('triggerDataValue', ''); }}>
      <option value="">Choose a data field</option>
      {PROFILE_TRIGGER_FIELDS.map(field => <option key={field.id} value={field.id}>{field.label}</option>)}
    </FieldSelect>
    <FieldSelect label="Value" verbatim required value={draft.triggerDataValue || ''}
      onChange={event => change('triggerDataValue', event.target.value)}>
      <option value="">Choose a value</option>
      {selected?.values.map(value => <option key={value} value={value}>{value}</option>)}
    </FieldSelect>
  </>;
}
