import { Children, cloneElement, isValidElement, useEffect, useRef, useId, useState } from "react";
import {
  X,
  Search,
  ChevronDown,
  Info,
  Pencil,
  Trash2,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Check,
  Clock3,
} from "lucide-react";
import { DEMO_STAFF, initials } from "../model";
import { badgeTone } from "../badgeTone";
import { displayTerminology } from "../terminology.js";
const displayChildren = children => Array.isArray(children)
  ? Children.map(children, displayChildren)
  : isValidElement(children)
    ? children.props.verbatim ? children : cloneElement(children, {
        ...(children.props.children !== undefined ? { children: displayChildren(children.props.children) } : {}),
        ...(children.props["aria-label"] ? { "aria-label": displayTerminology(children.props["aria-label"]) } : {}),
        ...(children.props.title ? { title: displayTerminology(children.props.title) } : {}),
        ...(children.props.placeholder ? { placeholder: displayTerminology(children.props.placeholder) } : {}),
      })
  : displayTerminology(children);
export function Logo() {
  return (
    <span className="brand">
      <svg
        viewBox="0 0 48 48"
        aria-hidden="true"
        className="brand-icon floral-logo"
      >
        <defs>
          <clipPath id="yscc-y-clip">
            {/* Bold geometric humanist Y shape matching the reference image */}
            <path d="M 9.5 7 L 18.5 7 L 24 18.5 L 29.5 7 L 38.5 7 L 28.5 24.5 L 28.5 41 L 19.5 41 L 19.5 24.5 Z" />
          </clipPath>
        </defs>

        {/* Soft rounded container background */}
        <rect
          width="48"
          height="48"
          rx="11"
          fill="#edf3f0"
          className="floral-logo-bg"
        />

        {/* Clipped botanical illustration inside the Y */}
        <g clipPath="url(#yscc-y-clip)">
          {/* Deep forest green letter Y body fill */}
          <rect width="48" height="48" fill="#14362b" />

          {/* Botanical motifs: Vines and stems (soft mint / sage) */}
          {/* Lower stem central branch */}
          <path
            d="M 24 40 Q 23.5 32 24 25"
            stroke="#7cbfa3"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
          {/* Left arm branch */}
          <path
            d="M 23 27 Q 19 22 13 11"
            stroke="#ff542e"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Right arm branch (mint) */}
          <path
            d="M 24 26 Q 27 20 34 11"
            stroke="#7cbfa3"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />

          {/* Mint fern / leaves on lower stem */}
          <ellipse cx="21" cy="37" rx="3" ry="1.6" transform="rotate(-35 21 37)" fill="#9ad4be" />
          <ellipse cx="27" cy="35" rx="3.2" ry="1.6" transform="rotate(30 27 35)" fill="#9ad4be" />
          <ellipse cx="21" cy="32" rx="3.3" ry="1.7" transform="rotate(-28 21 32)" fill="#81c4a9" />
          <ellipse cx="27" cy="29.5" rx="3.4" ry="1.7" transform="rotate(32 27 29.5)" fill="#81c4a9" />
          <ellipse cx="21.5" cy="26" rx="3.2" ry="1.8" transform="rotate(-40 21.5 26)" fill="#68af92" />

          {/* Left upper branch: Vibrant coral botanical foliage */}
          <ellipse cx="14.5" cy="14" rx="4.8" ry="2.4" transform="rotate(-48 14.5 14)" fill="#fa532c" />
          <ellipse cx="18.5" cy="11.5" rx="4.5" ry="2.2" transform="rotate(-35 18.5 11.5)" fill="#fa532c" />
          <ellipse cx="17" cy="17.5" rx="4.2" ry="2.3" transform="rotate(-55 17 17.5)" fill="#fa532c" />
          <ellipse cx="21" cy="16" rx="4.6" ry="2.4" transform="rotate(-40 21 16)" fill="#ff6d48" />
          <ellipse cx="20.5" cy="22" rx="3.8" ry="2.1" transform="rotate(-52 20.5 22)" fill="#fa532c" />

          {/* Center cluster: Peach blossom petals & bright orange leaf highlights */}
          <ellipse cx="24" cy="21" rx="4.5" ry="2.2" transform="rotate(18 24 21)" fill="#ffa190" />
          <ellipse cx="26.5" cy="17.5" rx="4.8" ry="2.3" transform="rotate(15 26.5 17.5)" fill="#ffb4a6" />
          <ellipse cx="24.5" cy="25" rx="3.8" ry="1.9" transform="rotate(25 24.5 25)" fill="#fa532c" />
          <ellipse cx="28.5" cy="23" rx="4.2" ry="2" transform="rotate(45 28.5 23)" fill="#ff643d" />

          {/* Right upper branch: delicate mint / sage sprig with rounded leaf buds */}
          <circle cx="34" cy="13" r="1.7" fill="#8fd0b7" />
          <circle cx="31.5" cy="11" r="1.6" fill="#8fd0b7" />
          <ellipse cx="30" cy="14.5" rx="3" ry="1.6" transform="rotate(35 30 14.5)" fill="#8fd0b7" />
          <ellipse cx="33" cy="17" rx="3.2" ry="1.7" transform="rotate(25 33 17)" fill="#76c3a6" />
          <ellipse cx="28" cy="18" rx="3" ry="1.6" transform="rotate(-20 28 18)" fill="#76c3a6" />
          <circle cx="35" cy="16" r="1.5" fill="#8fd0b7" />
          <circle cx="32" cy="20.5" r="1.6" fill="#76c3a6" />
        </g>
      </svg>
      <span className="brand-text">
        <span className="brand-name">YSCC</span>
        <span className="brand-tag">Youth Care</span>
      </span>
    </span>
  );
}
export function Button({ children, variant = "", className = "", ...props }) {
  return (
    <button className={`button ${variant} ${className}`} {...props} aria-label={displayTerminology(props["aria-label"])} title={displayTerminology(props.title)}>
      {displayChildren(children)}
    </button>
  );
}
export function SplitButton({ label, onClick, disabled = false, items, menuLabel = "More actions", variant = "primary" }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus();
    const outside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div ref={root} className="split-button" role="group" aria-label={displayTerminology(typeof label === "string" ? `${label} actions` : menuLabel)}>
      <div className="split-button-controls">
        <Button type="button" variant={variant} disabled={disabled} onClick={onClick}>{label}</Button>
        <button
          ref={trigger}
          type="button"
          className={`button ${variant} split-button-trigger`}
          aria-label={displayTerminology(menuLabel)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          disabled={disabled && items.every(item => item.disabled)}
          onClick={() => setOpen(value => !value)}
          onKeyDown={event => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
            }
          }}
        ><ChevronDown size={16} aria-hidden="true" /></button>
      </div>
      {open && <div id={menuId} className="split-button-menu" role="menu" aria-label={menuLabel}
        onKeyDown={event => {
          const buttons = [...event.currentTarget.querySelectorAll('[role="menuitem"]:not(:disabled)')];
          const index = buttons.indexOf(document.activeElement);
          let next;
          if (event.key === "ArrowDown") next = (index + 1) % buttons.length;
          if (event.key === "ArrowUp") next = (index - 1 + buttons.length) % buttons.length;
          if (event.key === "Home") next = 0;
          if (event.key === "End") next = buttons.length - 1;
          if (next !== undefined) { event.preventDefault(); buttons[next]?.focus(); }
          if (event.key === "Tab") setOpen(false);
        }}>
        {items.map(item => <button key={item.label} type="button" role="menuitem" tabIndex={-1}
          disabled={item.disabled} onClick={() => {
            setOpen(false);
            trigger.current?.focus();
            item.onClick();
          }}>{displayTerminology(item.label)}</button>)}
      </div>}
    </div>
  );
}
export function Avatar({ name, tone = "", large = false }) {
  return (
    <span
      className={`avatar ${tone} ${large ? "large" : ""}`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
export function PersonIdentity({ name, descriptor, className = "" }) {
  return (
    <span className={`person-identity ${className}`}>
      <strong>{name}</strong>
      {descriptor && <small>{descriptor}</small>}
    </span>
  );
}
export function Badge({ children, tone, className = "", verbatim = false }) {
  return (
    <span
      className={`badge ${tone || badgeTone(children)} ${className}`.trim()}
    >
      <span />
      {verbatim ? children : displayChildren(children)}
    </span>
  );
}
export function ProgressBar({ value, max = 100, label, className = "progress-track" }) {
  const maximum = Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : 1;
  const current = Number.isFinite(Number(value)) ? Math.min(maximum, Math.max(0, Number(value))) : 0;
  const complete = Number(max) > 0 && current === maximum;
  return (
    <span
      className={`${className}${complete ? " complete-100" : ""}`}
      role="progressbar"
      aria-label={displayTerminology(label)}
      aria-valuemin={0}
      aria-valuemax={maximum}
      aria-valuenow={current}
    >
      <span style={{ width: `${current / maximum * 100}%` }} />
    </span>
  );
}
export function AlertLabel({ children, tone = "attention" }) {
  return <span className={`alert-label ${tone}`}>{children}</span>;
}
export function SearchInput({
  value,
  onChange,
  placeholder = "Search by name or ID",
}) {
  return (
    <label className="search">
      <Search size={20} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={displayTerminology(placeholder)}
        aria-label={displayTerminology(placeholder)}
      />
      {value && (
        <button aria-label="Clear search" onClick={() => onChange("")}>
          <X size={16} />
        </button>
      )}
    </label>
  );
}
export function Select({ label, children, className = "", verbatim = false, ...props }) {
  return (
    <div className={`select-wrap ${className}`}>
      <select aria-label={displayTerminology(label)} {...props}>
        {verbatim ? children : displayChildren(children)}
      </select>
      <ChevronDown size={16} />
    </div>
  );
}
export function Checkbox({ label, className = "", verbatim = false, ...props }) {
  return <label className={`check-field checkbox-control ${className}`.trim()}>
    <input {...props} type="checkbox" />
    <span>{verbatim ? label : displayTerminology(label)}</span>
  </label>;
}
export function RadioInput({ className = "", ...props }) {
  return <input {...props} className={`radio-input ${className}`.trim()} type="radio" />;
}

export function RadioCard({ className = "", selected = false, children, ...inputProps }) {
  return (
    <label className={`${className} ${selected ? "selected" : ""}`.trim()}>
      <RadioInput {...inputProps} />
      {children}
    </label>
  );
}
export function Switch({ label, onLabel = "On", offLabel = "Off", className = "", checked, ...props }) {
  return <label className={`admin-setting-toggle ${className}`.trim()}>
    <input {...props} type="checkbox" role="switch" aria-label={displayTerminology(label)} checked={checked} />
    <span>{checked ? onLabel : offLabel}</span>
  </label>;
}
export function Field({ label, hint, error, children, className = "" }) {
  const hintId = useId();
  const errorId = useId();
  const requiredId = useId();
  const isControl = isValidElement(children) && (
    ["input", "select", "textarea"].includes(children.type) ||
    children.type === StaffPicker || children.type === Select
  );
  const describedBy = isControl
    ? [children.props["aria-describedby"], hint && hintId, error && errorId,
        children.props.required && requiredId]
        .filter(Boolean).join(" ")
    : undefined;
  const control = isControl
    ? cloneElement(children, {
        "aria-describedby": describedBy || undefined,
        "aria-invalid": error ? true : children.props["aria-invalid"],
      })
    : children;
  return (
    <label className={`field ${error ? "has-error" : ""} ${className}`.trim()}>
      <span>{displayTerminology(label)}</span>
      {control}
      {hint && <small id={hintId}>{displayTerminology(hint)}</small>}
      {error && <small id={errorId} className="field-inline-error">{displayTerminology(error)}</small>}
      <small id={requiredId} className="field-required-hint" aria-live="polite">
        This field is required.
      </small>
    </label>
  );
}
export function FieldInput({ label, hint, error, className = "", ...props }) {
  return <Field label={label} hint={hint} error={error} className={className}><input {...props} /></Field>;
}
export function FieldSelect({ label, hint, error, className = "", verbatim = false, children, ...props }) {
  return <Field label={label} hint={hint} error={error} className={className}>
    <Select verbatim={verbatim} {...props}>{children}</Select>
  </Field>;
}
export function StaffPicker({
  name,
  value,
  defaultValue = "",
  onChange,
  required = false,
  invalid = false,
  placeholder = "Choose team member",
  ...controlProps
}) {
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = controlled ? value : internalValue;

  return (
    <Select
      label={placeholder}
      name={name}
      value={selectedValue}
      required={required}
      aria-invalid={invalid || undefined}
      {...controlProps}
      onChange={(event) => {
        if (!controlled) setInternalValue(event.target.value);
        onChange?.(event.target.value);
      }}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {DEMO_STAFF.map((person) => (
        <option key={person.id} value={person.name}>
          {person.name} · {person.role}
        </option>
      ))}
    </Select>
  );
}
export function FormErrorSummary({
  title = "Check the highlighted fields",
  description = "Correct the errors, then try again.",
  items = [],
  containerRef,
  id,
}) {
  return (
    <div className="form-error-summary" role="alert" tabIndex={-1} ref={containerRef} id={id}>
      <strong>{title}</strong>
      <p>{description}</p>
      {items.length > 0 && (
        <ul>
          {items.map(({ id: fieldId, label, message }) => (
            <li key={fieldId}>
              <button type="button" onClick={() => document.getElementById(fieldId)?.focus()}>
                {label}: {message}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
function nativeFormErrors(form, idPrefix) {
  return Array.from(form.querySelectorAll("input:invalid, select:invalid, textarea:invalid"))
    .map((control, index) => {
      if (!control.id) control.id = `${idPrefix}-${index}`;
      const fieldLabel = control.labels?.[0]?.querySelector(":scope > span")?.textContent?.trim();
      const label = fieldLabel || control.getAttribute("aria-label") || control.labels?.[0]?.textContent?.trim() || control.name || "Field";
      const message = control.validity.valueMissing
        ? "This field is required."
        : control.validity.typeMismatch
          ? "Enter a valid value."
          : control.validationMessage || "Check this value.";
      return { id: control.id, label, message };
    });
}
export function ValidatedForm({
  children,
  className = "",
  onSubmit,
  onInput,
  ...props
}) {
  const errorIdPrefix = useId();
  const [validationItems, setValidationItems] = useState([]);
  return (
    <form
      className={`${className} ${validationItems.length ? "has-validation-errors" : ""}`}
      onInvalidCapture={(event) => {
        setValidationItems(nativeFormErrors(event.currentTarget, errorIdPrefix));
      }}
      onInput={(event) => {
        if (validationItems.length) {
          setValidationItems(nativeFormErrors(event.currentTarget, errorIdPrefix));
        }
        onInput?.(event);
      }}
      onSubmit={(event) => {
        setValidationItems([]);
        onSubmit?.(event);
      }}
      {...props}
    >
      {children}
      {validationItems.length > 0 && (
        <FormErrorSummary
          title={`${validationItems.length} ${validationItems.length === 1 ? "field" : "fields"} to check`}
          description="Correct the highlighted fields, then try again."
          items={validationItems}
        />
      )}
    </form>
  );
}
export function Notice({ children, tone = "" }) {
  return (
    <div className={`notice ${tone}`}>
      <Info size={18} />
      <div>{displayChildren(children)}</div>
    </div>
  );
}
export function Empty({ title = "No matching work", children, action, visual = "search" }) {
  return (
    <div className="empty">
      <div className="empty-visual">
        {visual === "search" ? (
          <Search size={32} />
        ) : (
          <img src="/src/assets/images/empty_state_botanical_1790002756211.jpg" alt="" referrerPolicy="no-referrer" />
        )}
      </div>
      <h3>{displayTerminology(title)}</h3>
      <p>{displayChildren(children) || "Try a different search or adjust your filters."}</p>
      {action && action}
    </div>
  );
}
export function Pagination({ page, pageCount, onPageChange, label }) {
  if (pageCount <= 1) return null;
  return (
    <nav className="pagination" aria-label={`${label} pagination`}>
      <Button
        className="pagination-button"
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label={`Previous ${label.toLowerCase()} page`}
      >
        <ChevronLeft size={16} aria-hidden="true" />
        Previous
      </Button>
      <span className="pagination-status" aria-live="polite">
        Page {page} of {pageCount}
      </span>
      <Button
        className="pagination-button"
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page === pageCount}
        aria-label={`Next ${label.toLowerCase()} page`}
      >
        Next
        <ChevronRight size={16} aria-hidden="true" />
      </Button>
    </nav>
  );
}
export function Panel({ title, action, children, className = "", verbatim = false }) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-heading">
          <h2>{verbatim ? title : displayChildren(title)}</h2>
          {action}
        </div>
      )}
      {verbatim ? children : displayChildren(children)}
    </section>
  );
}
export function Continuity({ person = false }) {
  return (
    <div className="continuity">
      <Clock3 size={24} />
      <strong>
        {person ? "One episode, a connected history" : "Continuity of care"}
      </strong>
      <span>
        {person
          ? "Each follow-up adds a new collection point to this episode."
          : "Reviews stay within the same care episode, keeping each person’s history connected."}
      </span>
    </div>
  );
}
export function PageHeading({ title, subtitle, meta, children }) {
  return (
    <div className="page-heading">
      <div>
        <h1>{displayTerminology(title)}</h1>
        {subtitle && <p>{displayTerminology(subtitle)}</p>}
        {meta && <div className="page-meta">{meta}</div>}
      </div>
      {children && <ActionGroup className="actions">{children}</ActionGroup>}
    </div>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
  closeLabel = "Close dialog",
  className = "",
  initialFocusRef,
}) {
  const ref = useRef(null),
    id = useId();
  useEffect(() => {
    const prior = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    initialFocusRef?.current?.focus();
    return () => {
      dialog.close();
      prior?.focus?.();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""} ${className}`}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-heading">
        <div>
          <h2 id={id}>{displayChildren(title)}</h2>
          {subtitle && <p>{displayTerminology(subtitle)}</p>}
        </div>
        <button
          className="icon-button"
          aria-label={closeLabel}
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      {displayChildren(children)}
    </dialog>
  );
}
export function Success({ title, children, action, heading = "h2" }) {
  const Heading = heading;
  return (
    <div className="success">
      <span className="success-icon">
        <Check size={26} />
      </span>
      <Heading tabIndex={-1}>{displayTerminology(title)}</Heading>
      <p>{displayChildren(children)}</p>
      {action}
    </div>
  );
}
export function ProductCopy({ children }) {
  return displayChildren(children);
}
export { Tabs, RecordTabs, FilterTabs } from "./Tabs";

// Tertiary actions retain a visible label. Icon-only utilities use icon-button.
export function TertiaryAction({ children, icon: Icon, iconPosition = "start", className = "", type = "button", ...props }) {
  const icon = Icon && <Icon size={16} aria-hidden="true" />;
  return <button type={type} className={`tertiary-action ${className}`.trim()} {...props} aria-label={displayTerminology(props["aria-label"])} title={displayTerminology(props.title)}>
    {iconPosition === "start" && icon}
    {displayChildren(children)}
    {iconPosition === "end" && icon}
  </button>;
}
export function EditAction(props) {
  return <TertiaryAction icon={Pencil} {...props} />;
}
export function TextLink({ icon = ArrowRight, iconPosition = "end", className = "", ...props }) {
  return <TertiaryAction icon={icon} iconPosition={iconPosition} className={`text-link ${className}`.trim()} {...props} />;
}

// Use one spacing contract for related actions, including wrapping on narrow screens.
export function ActionGroup({ as: Element = "div", children, className = "", ...props }) {
  return <Element className={`action-group ${className}`.trim()} {...props}>{children}</Element>;
}
export function ModalFooter({ children, className = "", ...props }) {
  return <ActionGroup className={`modal-footer modal-footer-stacked ${className}`.trim()} {...props}>{children}</ActionGroup>;
}
export function DeleteAction(props) {
  return <TertiaryAction icon={Trash2} {...props} />;
}
export function IconButton({ icon: Icon, label, className = "", type = "button", ...props }) {
  return <button type={type} className={`icon-button ${className}`.trim()} aria-label={displayTerminology(label)} title={displayTerminology(label)} {...props}><Icon size={18} aria-hidden="true" /></button>;
}
