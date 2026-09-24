import { currentCarePeriod, previousDate } from "../carePeriods";
import { formatDate } from "../model";
import { Button, Panel } from "./UI";

export default function CareLevelSection({ episode, canEdit, openModal }) {
  const periods = episode.carePeriods || [];
  const active = currentCarePeriod(episode);
  const latest = periods.at(-1);
  const displayed = active || latest;
  return (
    <Panel
      title="Program stream & care level"
      className="care-level-panel"
    >
      <div className="panel-body">
        <div className="care-level-current">
          <div className="care-level-fact">
            <small>Program stream</small>
            <strong>{episode.programStream || "Not recorded"}</strong>
          </div>
          <div className="care-level-fact">
            <small>{episode.status === "Active" ? "Current level" : "Last recorded level"}</small>
            <strong>{displayed?.careLevel || "Not recorded"}</strong>
            {displayed && <span>{displayed.deliveringUnit} · {formatDate(displayed.startDate)}{displayed.endDateExclusive ? `–${formatDate(previousDate(displayed.endDateExclusive))}` : "–present"}</span>}
          </div>
        </div>
        {!displayed && <p className="care-level-empty-note">Record the starting level to track step up and step down changes over time.</p>}
        {periods.length > 0 && (
          <details className="care-level-history">
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
        {canEdit && (
          <div className="care-level-edit-action">
            <Button variant="secondary" onClick={() => openModal({ type: "care-level", episodeId: episode.id })}>
              {active ? "Edit stream & care level" : "Record starting level"}
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}
