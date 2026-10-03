export default function ReportEvidenceCard({
  variant,
  title,
  children,
  metric,
  headingLevel = 5,
}) {
  const Heading = `h${headingLevel}`;
  return (
    <article className={`report-evidence-card ${variant}`}>
      <div className="report-evidence-card-copy">
        <Heading>{title}</Heading>
        <p>{children}</p>
      </div>
      {metric}
    </article>
  );
}
