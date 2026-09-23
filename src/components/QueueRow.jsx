export function QueueRow({ children, className = "", ...props }) {
  return <tr className={`queue-row ${className}`.trim()} {...props}>{children}</tr>;
}

export function QueueCell({ label, slot, className = "", children, ...props }) {
  return (
    <td className={`queue-cell ${className}`.trim()} data-label={label} data-slot={slot} {...props}>
      {children}
    </td>
  );
}
