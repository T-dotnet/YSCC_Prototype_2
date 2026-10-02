import { ActionGroup } from "./UI";
import ReportingIndicator from "./ReportingIndicator";

export default function ReportChartCard({
  title,
  description,
  children,
  className = "",
  isVisible = true,
  onToggle,
  reportingType = "context",
  showReportingIndicator = true,
}) {
  return (
    <section className={`record-two-card ${className}${isVisible ? "" : " report-section-collapsed"}`}>
      {(title || description || showReportingIndicator || onToggle) && <header>
        {(title || description) && <div>
          {title && <h3>{title}</h3>}
          {description && <p>{description}</p>}
        </div>}
        <ActionGroup className="record-two-header-actions">
          {showReportingIndicator && <ReportingIndicator type={reportingType} />}
          {onToggle && (
            <button type="button" className="report-section-toggle" aria-expanded={isVisible} onClick={onToggle}>
              {isVisible ? "Hide" : "Show"}
            </button>
          )}
        </ActionGroup>
      </header>}
      {isVisible && children}
    </section>
  );
}
