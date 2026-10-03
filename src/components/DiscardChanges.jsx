import { useEffect, useRef, useId } from "react";
import { Button, ModalFooter } from "./UI";

export default function DiscardChanges({ onKeepEditing, onDiscard }) {
  const keep = useRef(null);
  const id = useId();
  const prior = useRef(document.activeElement);
  useEffect(() => {
    keep.current?.focus();
  }, []);
  return (
    <div className="discard-changes" role="alert" aria-labelledby={id}>
      <div>
        <h3 id={id}>Discard your unsaved changes?</h3>
        <p>Your saved record will stay as it is.</p>
      </div>
      <ModalFooter>
        <Button
          ref={keep}
          type="button"
          variant="primary"
          onClick={() => {
            onKeepEditing();
            requestAnimationFrame(() => prior.current?.focus?.());
          }}
        >
          Keep editing
        </Button>
        <Button type="button" onClick={onDiscard}>
          Discard changes
        </Button>
      </ModalFooter>
    </div>
  );
}
