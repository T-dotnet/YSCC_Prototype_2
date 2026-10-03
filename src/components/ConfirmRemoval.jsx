import { ActionGroup, Button, Modal } from './UI';

export default function ConfirmRemoval({ item, onCancel, onConfirm }) {
  if (!item) return null;
  return <Modal title={`Remove ${item.name}?`} subtitle={item.subtitle} onClose={onCancel}>
    <div className="form-body"><p>{item.description || 'This item will be removed from the current editor. The change is applied when you save or create.'}</p></div>
    <ActionGroup className="modal-footer">
      <Button type="button" onClick={onCancel}>Cancel</Button>
      <Button type="button" variant="primary" onClick={onConfirm}>Remove {item.type || 'item'}</Button>
    </ActionGroup>
  </Modal>;
}
