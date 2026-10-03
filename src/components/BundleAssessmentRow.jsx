import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import RecordItem from './RecordItem';
import { ActionGroup, IconButton, Checkbox } from './UI';
import ConfirmRemoval from './ConfirmRemoval';

// Template rows edit the requirement; person rows edit inclusion. Callers own that policy.
export default function BundleAssessmentRow({ name, checkboxLabel, checkboxAriaLabel, checked, disabled = false, onCheckedChange, onRemove, status, secondary }) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  return <><RecordItem headingLevel={4}
    className={`new-bundle-record bundle-editor-assessment-row${secondary ? ' is-editing' : ''}`}
    title={name} verbatimText status={status} secondary={secondary}
    headingAction={<ActionGroup className="bundle-editor-assessment-actions">
      {checkboxLabel && <Checkbox label={checkboxLabel} aria-label={checkboxAriaLabel || `${checkboxLabel}: ${name}`} checked={checked} disabled={disabled}
        onChange={event=>onCheckedChange?.(event.target.checked)}/>}
      {onRemove && <IconButton icon={Trash2} label={`Remove ${name}`} className="bundle-editor-delete" onClick={() => setConfirmRemove(true)} />}
    </ActionGroup>}
  />
    <ConfirmRemoval item={confirmRemove ? { name, type: 'measure' } : null}
      onCancel={() => setConfirmRemove(false)} onConfirm={() => { onRemove(); setConfirmRemove(false); }} />
  </>;
}
