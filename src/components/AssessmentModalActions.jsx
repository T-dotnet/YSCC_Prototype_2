import { ModalFooter, Button } from './UI';

/** Footer actions for editing one assessment and its instrument data. */
export default function AssessmentModalActions({ assessment, onMarkNotRequired, onArchive, onCancel, saveLabel = 'Save changes', disabled = false }) {
  return <ModalFooter className="bundle-form-footer assessment-modal-actions" data-assessment={assessment?.key || assessment?.id || undefined}>
    {onMarkNotRequired && <Button type="button" variant="ghost" className="assessment-tertiary-action assessment-not-required-action" onClick={onMarkNotRequired}>Mark as not required</Button>}
    {onArchive && <Button type="button" variant="ghost" className="assessment-tertiary-action assessment-archive-action" onClick={onArchive}>Archive assessment</Button>}
    <Button type="button" onClick={onCancel}>Cancel</Button>
    <Button type="submit" variant="primary" disabled={disabled}>{saveLabel}</Button>
  </ModalFooter>;
}
