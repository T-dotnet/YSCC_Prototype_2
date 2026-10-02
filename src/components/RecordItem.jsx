import { useLayoutEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { ActionGroup, Badge } from "./UI";
import { displayTerminology } from "../terminology.js";

export function RecordFacts({ facts, columns = 3, verbatimValues = false }) {
  return <dl className={`record-item-facts${columns === 2 ? ' record-facts-two-columns' : ''}`}>
    {facts.map(({ label, value, wide }) => (
      <div key={label} className={wide ? "record-item-fact-wide" : undefined}>
        <dt>{displayTerminology(label)}</dt>
        <dd>{verbatimValues ? value : displayTerminology(value)}</dd>
      </div>
    ))}
  </dl>;
}

export default function RecordItem({
  title,
  eyebrow,
  subtitle,
  status,
  headingAction,
  summaryMeta,
  verbatimText = false,
  tableRow = false,
  collapsible = false,
  initiallyExpanded = false,
  selected = false,
  headingLevel = 3,
  className = "",
  id,
  lead,
  facts = [],
  secondary,
  note,
  actions,
}) {
  const detailsRef = useRef(null);
  useLayoutEffect(() => {
    if (initiallyExpanded && detailsRef.current) detailsRef.current.open = true;
  }, [initiallyExpanded]);
  const Heading = `h${headingLevel}`;
  const heading = tableRow ? (
    <>
      <span className="record-item-table-type">{displayTerminology(eyebrow || "Record")}</span>
      <span className="record-item-heading-text">
        <Heading>{verbatimText ? title : displayTerminology(title)}</Heading>
        {subtitle && <small>{verbatimText ? subtitle : displayTerminology(subtitle)}</small>}
      </span>
      {summaryMeta && <span className="record-item-table-meta">{summaryMeta}</span>}
      <span className="record-item-table-status">{status ? <Badge>{status}</Badge> : "—"}</span>
    </>
  ) : (
    <>
      <span className="record-item-heading-text">
        {eyebrow && <span className="record-item-eyebrow">{displayTerminology(eyebrow)}</span>}
        <Heading>{verbatimText ? title : displayTerminology(title)}</Heading>
        {subtitle && <small>{verbatimText ? subtitle : displayTerminology(subtitle)}</small>}
      </span>
      {status && <Badge>{status}</Badge>}
      {headingAction && <div className="record-item-heading-action">{headingAction}</div>}
    </>
  );
  const classes = `record-item${selected ? " selected-collection" : ""}${tableRow ? " record-item-table-row" : ""}${className ? ` ${className}` : ""}`;
  const content = (
    <div className="record-item-content">
      <div className="record-item-body">
        {lead && <div className="record-item-lead">{displayTerminology(lead)}</div>}
        {facts.length > 0 && (
          <RecordFacts facts={facts} verbatimValues={verbatimText} />
        )}
        {secondary && <div className="record-item-secondary">{secondary}</div>}
      </div>
      {(note || actions) && (
        <footer className="record-item-footer">
          {note && <span className="record-item-note">{displayTerminology(note)}</span>}
          {actions && <ActionGroup className="record-item-actions">{actions}</ActionGroup>}
        </footer>
      )}
    </div>
  );

  return collapsible ? (
    <details className={classes} id={id} ref={detailsRef}>
      <summary className="record-item-heading">
        {heading}
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      {content}
    </details>
  ) : (
    <article className={classes} id={id}>
      <div className="record-item-heading">{heading}</div>
      {content}
    </article>
  );
}
