export default function SectionActionHeader({ title, description, action, className = "", mvp = false }) {
  return mvp ? (
    <div className={`section-toolbar${className ? ` ${className}` : ""}`}>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action && <div className="button-row">{action}</div>}
    </div>
  ) : (
    <div className={`section-action-header${className ? ` ${className}` : ""}`}>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="section-action-header-actions">{action}</div>
    </div>
  );
}
