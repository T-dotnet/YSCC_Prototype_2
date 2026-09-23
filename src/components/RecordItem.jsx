import { ChevronDown } from "lucide-react";
import { Badge } from "./UI";

export default function RecordItem({
  title,
  subtitle,
  status,
  collapsible = false,
  selected = false,
  headingLevel = 3,
  className = "",
  lead,
  facts = [],
  secondary,
  note,
  actions,
}) {
  const Heading = `h${headingLevel}`;
  const heading = (
    <>
      <span className="record-item-heading-text">
        <Heading>{title}</Heading>
        {subtitle && <small>{subtitle}</small>}
      </span>
      <Badge>{status}</Badge>
    </>
  );
  const classes = `record-item${selected ? " selected-collection" : ""}${className ? ` ${className}` : ""}`;
  const content = (
    <div className="record-item-content">
      <div className="record-item-body">
        {lead && <div className="record-item-lead">{lead}</div>}
        {facts.length > 0 && (
          <dl className="record-item-facts">
            {facts.map(({ label, value }) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {secondary && <div className="record-item-secondary">{secondary}</div>}
      </div>
      {(note || actions) && (
        <footer className="record-item-footer">
          {note && <span className="record-item-note">{note}</span>}
          {actions && <div className="record-item-actions">{actions}</div>}
        </footer>
      )}
    </div>
  );

  return collapsible ? (
    <details className={classes}>
      <summary className="record-item-heading">
        {heading}
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      {content}
    </details>
  ) : (
    <article className={classes}>
      <div className="record-item-heading">{heading}</div>
      {content}
    </article>
  );
}
