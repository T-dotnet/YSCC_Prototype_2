export function ReportBar({ value, maximum = 100, tone = "year-2026" }) {
  return <div className="report-graph-track" aria-hidden="true">
    <span className={`report-graph-bar report-graph-bar-${tone}`} style={{ width: `${Math.max(0, Math.min(100, value / maximum * 100))}%` }} />
  </div>;
}

export function ReportDeltaBar({ value, extent }) {
  const magnitude = Math.abs(value) / extent * 50;
  return <div className="report-graph-delta-track" aria-hidden="true">
    <span className="report-graph-delta-zero" />
    <span className={`report-graph-delta-bar ${value < 0 ? "decrease" : "increase"}`} style={{ left: `${value < 0 ? 50 - magnitude : 50}%`, width: `${magnitude}%` }} />
  </div>;
}
