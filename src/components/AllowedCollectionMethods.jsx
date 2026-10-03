import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { allowedCollectionMethods, collectionMethodSummary } from '../allowedCollectionMethods.js';
import { Checkbox } from './UI.jsx';

export default function AllowedCollectionMethods({ bundle, methods, onChange }) {
  const id = useId();
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const selected = allowedCollectionMethods(bundle, methods);
  const any = !Array.isArray(bundle.allowedCollectionMethods);
  const dialog = buttonRef.current?.closest('dialog');

  useLayoutEffect(() => {
    if (!open || !dialog) return;
    const place = () => {
      const anchor = buttonRef.current?.getBoundingClientRect();
      const bounds = dialog.getBoundingClientRect();
      const height = menuRef.current?.getBoundingClientRect().height || 0;
      if (!anchor || !height) return;
      const below = bounds.bottom - anchor.bottom;
      const above = anchor.top - bounds.top;
      setPosition({
        left: anchor.left - bounds.left,
        top: (below >= height || below >= above ? anchor.bottom : anchor.top - height) - bounds.top,
        width: anchor.width,
      });
    };
    const outside = event => {
      if (!buttonRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    const escape = event => {
      if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); buttonRef.current?.focus(); }
    };
    place();
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, dialog, methods.length]);

  const choose = value => {
    if (value === null) return onChange(null);
    if (any) return onChange([value]);
    const next = selected.includes(value) ? selected.filter(item => item !== value)
      : methods.filter(item => selected.includes(item) || item === value);
    onChange(next.length ? next : null);
  };

  return <div className="field allowed-collection-methods">
    <span id={id}>Allowed collection methods</span>
    <button ref={buttonRef} type="button" className="allowed-collection-trigger"
      aria-labelledby={id} aria-expanded={open} aria-controls={`${id}-options`}
      onClick={() => { setPosition(null); setOpen(current => !current); }}>
      {collectionMethodSummary(bundle, methods)}
    </button>
    {open && dialog && createPortal(<div ref={menuRef} id={`${id}-options`}
      className="allowed-collection-options allowed-collection-popover" role="group" aria-labelledby={id}
      style={{ ...position, visibility: position ? 'visible' : 'hidden' }}>
      <Checkbox label="Any" checked={any} onChange={() => choose(null)} />
      {methods.map(value => <Checkbox key={value} label={value}
        checked={!any && selected.includes(value)} onChange={() => choose(value)} />)}
    </div>, dialog)}
  </div>;
}
