import { CARE_LEVELS, currentCarePeriod, previousDate } from "../carePeriods";
import { formatDate } from "../model";
import { Button, Panel } from "./UI";

export default function CareLevelSection({ episode, canEdit, openModal }) {
  const periods = episode.carePeriods || [];
  const active = currentCarePeriod(episode);
  const latest = periods.at(-1);
  const displayed = active || latest;
  return (
    <Panel
      title="Care level"
      className="care-level-panel"
      action={canEdit && (
        <Button variant="secondary" onClick={() => openModal({ type: "care-level", episodeId: episode.id })}>
          {active ? "Change level" : "Record starting level"}
        </Button>
      )}
    >
      <div className="panel-body">
        <div className="care-level-current">
          <div>
            <small>{episode.status === "Active" ? "Current level" : "Last recorded level"}</small>
            <strong>{displayed?.careLevel || "Not recorded"}</strong>
            <span>{displayed
              ? `${displayed.deliveringUnit} · ${formatDate(displayed.startDate)}${displayed.endDateExclusive ? `–${formatDate(previousDate(displayed.endDateExclusive))}` : "–present"}`
              : "Record a starting level before a level change can be shown."}</span>
          </div>
          {displayed && <span className="care-level-count">{periods.length} {periods.length === 1 ? "period" : "periods"}</span>}
        </div>
        {periods.length > 0 && (
          <details className="care-level-history" open={periods.length > 1}>
            <summary>Level history</summary>
            <ol>
              {[...periods].reverse().map((period) => {
                const review = episode.collections?.find((item) => item.id === period.triggeringReviewId);
                return (
                  <li key={period.id}>
                    <strong>{period.careLevel}</strong>
                    <span>{formatDate(period.startDate)}–{period.endDateExclusive ? formatDate(previousDate(period.endDateExclusive)) : "present"}</span>
                    <small>{period.deliveringUnit}</small>
                    {period.previousCareLevel && <small>From {period.previousCareLevel} · {period.entryReason}</small>}
                    {review && <small>Review: {review.label}</small>}
                    {period.authorisingPractitioner && <small>Authorised by {period.authorisingPractitioner}</small>}
                  </li>
                );
              })}
            </ol>
          </details>
        )}
        <p className="care-level-prototype-note">{CARE_LEVELS.join(" / ")} are candidate program levels. Service delivery periods remain separate from this level history.</p>
      </div>
    </Panel>
  );
}
