import { useId } from "react";
import { Landmark } from "lucide-react";

const REPORTING_NOTES = {
  outcome: {
    title: "PMHC-MDS outcome measure",
    description: "This measure is in the prototype's PMHC-MDS reference set. The measure expected for an episode depends on age and service rules.",
  },
  aftercare: {
    title: "Program-specific measure",
    description: "PMHC-MDS includes this measure for Universal Aftercare. Its reporting role depends on the episode's program type.",
  },
  unconfigured: {
    title: "Reporting setup incomplete",
    description: "IAR-DST appears in PMHC-MDS, but its version and scoring are not configured in this prototype. This chart is not report-ready.",
  },
  context: {
    title: "Contextual report card",
    description: "This view adds care context. It is not one of the prototype's configured PMHC-MDS outcome measures.",
  },
};

export default function ReportingIndicator({ type = "context" }) {
  const tooltipId = useId();
  const note = REPORTING_NOTES[type] || REPORTING_NOTES.context;

  return (
    <span className={`reporting-indicator reporting-indicator-${type}`}>
      <button
        type="button"
        className="reporting-indicator-trigger"
        aria-label="Government reporting information"
        aria-describedby={tooltipId}
      >
        <Landmark size={16} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <span className="reporting-indicator-tooltip" id={tooltipId} role="tooltip">
        <strong>{note.title}</strong>
        <span>{note.description}</span>
      </span>
    </span>
  );
}
