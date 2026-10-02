import { displayTerminology } from "../terminology.js";

export default function SectionActionHeader({ title, description, action, className = "", mvp = false }) {
  return mvp ? (
    <div className={`section-toolbar${className ? ` ${className}` : ""}`}>
      <div>
        <h2>{displayTerminology(title)}</h2>
        <p>{displayTerminology(description)}</p>
      </div>
      {action && <div className="button-row">{action}</div>}
    </div>
  ) : (
    <div className={`section-action-header${className ? ` ${className}` : ""}`}>
      <h2>{displayTerminology(title)}</h2>
      <p>{displayTerminology(description)}</p>
      <div className="section-action-header-actions">{action}</div>
    </div>
  );
}
