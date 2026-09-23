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
  children,
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

  return collapsible ? (
    <details className={classes}>
      <summary className="record-item-heading">
        {heading}
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <div className="record-item-content">{children}</div>
    </details>
  ) : (
    <article className={classes}>
      <div className="record-item-heading">{heading}</div>
      <div className="record-item-content">{children}</div>
    </article>
  );
}
