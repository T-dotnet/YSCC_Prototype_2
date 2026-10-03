import { useEffect, useId, useState } from 'react';
import { dataDictionaryCatalog, DICTIONARY_CHANGED } from '../dataDictionaryCatalog';
import { Field, FieldSelect } from './UI';

export default function ProfileValueTriggerFields({ draft, change }) {
  const listId = useId();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener(DICTIONARY_CHANGED, refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(DICTIONARY_CHANGED, refresh); window.removeEventListener('storage', refresh); };
  }, []);
  const fields = dataDictionaryCatalog();
  const display = field => `${field.label} · ${field.measure} · ${field.variable || field.questionId || field.id}`;
  const selected = fields.find(item => item.id === draft.triggerDataField);
  const [search, setSearch] = useState('');
  useEffect(() => { setSearch(selected ? display(selected) : ''); }, [draft.triggerDataField, revision]);
  return <>
    <Field label="Data field" hint={selected?.draft ? 'Draft questions have no recorded answers for Assessment Pack rules.' : undefined}><input type="search" list={listId} required autoComplete="off"
      placeholder="Search data dictionary items" value={search}
      onChange={event => {
        const value = event.target.value;
        setSearch(value);
        const match = fields.find(field => display(field) === value);
        change('triggerDataField', match?.id || '');
        change('triggerDataValue', '');
      }} />
      <datalist id={listId}>{fields.map(field => <option key={field.id} value={display(field)} />)}</datalist>
    </Field>
    {selected?.values.length ? <FieldSelect label="Value" verbatim required value={draft.triggerDataValue || ''}
      onChange={event => change('triggerDataValue', event.target.value)}>
      <option value="">Choose a value</option>
      {selected.values.map(value => <option key={value} value={value}>{value}</option>)}
    </FieldSelect> : <Field label="Value"><input required value={draft.triggerDataValue || ''}
      placeholder={selected ? 'Enter a value' : 'Choose a data field first'} disabled={!selected}
      onChange={event => change('triggerDataValue', event.target.value)} /></Field>}
  </>;
}
