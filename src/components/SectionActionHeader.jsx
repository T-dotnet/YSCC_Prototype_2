export default function SectionActionHeader({ title, description, action, className = "" }) {
  return (
    <div className={`section-action-header${className ? ` ${className}` : ""}`}>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="section-action-header-actions">{action}</div>
    </div>
  );
}
