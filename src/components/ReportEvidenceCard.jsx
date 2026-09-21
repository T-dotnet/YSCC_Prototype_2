export default function ReportEvidenceCard({
  variant,
  title,
  children,
  metric,
}) {
  return (
    <article className={`report-evidence-card ${variant}`}>
      <div className="report-evidence-card-copy">
        <h5>{title}</h5>
        <p>{children}</p>
      </div>
      {metric}
    </article>
  );
}
