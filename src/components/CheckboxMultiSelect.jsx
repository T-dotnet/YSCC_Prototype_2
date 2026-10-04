import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Checkbox } from './UI';

export default function CheckboxMultiSelect({ label, options, values, onChange, placeholder }) {
  const id = useId();
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const dialog = buttonRef.current?.closest('dialog');
  const names = options.filter(item => values.includes(item.value)).map(item => item.label);

  useLayoutEffect(() => {
    if (!open || !dialog) return;
    const place = () => {
      const anchor = buttonRef.current?.getBoundingClientRect();
      const bounds = dialog.getBoundingClientRect();
      const height = menuRef.current?.getBoundingClientRect().height || 0;
      if (!anchor || !height) return;
      const below = bounds.bottom - anchor.bottom;
      const above = anchor.top - bounds.top;
      setPosition({ left: anchor.left - bounds.left,
        top: (below >= height || below >= above ? anchor.bottom : anchor.top - height) - bounds.top,
        width: anchor.width });
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
  }, [open, dialog, options.length]);

  const toggle = value => onChange(values.includes(value)
    ? values.filter(item => item !== value)
    : options.map(item => item.value).filter(item => values.includes(item) || item === value));

  return <div className="field allowed-collection-methods checkbox-multi-select">
    <span id={id}>{label}</span>
    <button ref={buttonRef} type="button" className="allowed-collection-trigger"
      aria-labelledby={id} aria-expanded={open} aria-controls={`${id}-options`}
      onClick={() => { setPosition(null); setOpen(current => !current); }}>
      {names.length ? names.length <= 2 ? names.join(', ') : `${names.length} selected` : placeholder}
    </button>
    {open && dialog && createPortal(<div ref={menuRef} id={`${id}-options`}
      className="allowed-collection-options allowed-collection-popover checkbox-multi-select-options"
      role="group" aria-labelledby={id}
      style={{ ...position, visibility: position ? 'visible' : 'hidden' }}>
      {options.map(item => <Checkbox key={item.value} label={item.label}
        checked={values.includes(item.value)} onChange={() => toggle(item.value)} />)}
    </div>, dialog)}
  </div>;
}
