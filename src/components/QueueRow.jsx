import { displayTerminology } from "../terminology.js";

export function QueueRow({ children, className = "", ...props }) {
  return <tr className={`queue-row ${className}`.trim()} data-interactive={props.onClick ? "true" : undefined} {...props}>{children}</tr>;
}

export function QueueCell({ label, slot, className = "", children, verbatim = false, ...props }) {
  return (
    <td className={`queue-cell ${className}`.trim()} data-label={displayTerminology(label)} data-slot={slot} {...props}>
      {verbatim ? children : displayTerminology(children)}
    </td>
  );
}
