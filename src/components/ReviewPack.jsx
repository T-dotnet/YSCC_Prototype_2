import { ClipboardCheck, Flag, ListChecks } from "lucide-react";
import { recordedCareEvents } from "../careEvents";
import { formatDate, hasPendingClinicalReview } from "../model";
import {
  compareResponses,
  patientProgress,
  questionnaireProgress,
  responseDate,
} from "../progress";
import { Badge, Button, Notice, Panel, TextLink } from "./UI";

const countLabel = (count, noun) => `${count} ${noun}${count === 1 ? "" : "s"}`;

export default function ReviewPack({
  person,
  episode,
  owner,
  nextStep,
  questionnaireVersion,
  onOpenAssessment,
  onOpenEvents,
  onPlanFollowUp,
  inModal = false,
}) {
  const progress = questionnaireProgress(person, episode, questionnaireVersion);
  const episodeProgress = patientProgress(person, episode);
  const comparison = compareResponses(
    person,
    progress.baseline,
    progress.latest,
  );
  const pendingReviews = episode.collections.filter(hasPendingClinicalReview);
  const incompleteCollections = episodeProgress.open;
  const events = recordedCareEvents(episode).slice(0, 3);
  const changeSummary = comparison.reason
    ? comparison.reason
    : `${countLabel(comparison.changed, "changed answer")} across ${countLabel(comparison.comparable, "comparable answer")}.`;

  const Surface = inModal ? "div" : Panel;

  return (
    <Surface className={`review-pack${inModal ? " review-pack-modal" : ""}`}>
      {!inModal && (
        <header className="review-pack-heading">
          <div>
            <h3>90-day review pack</h3>
            <p>
              Recorded context to prepare the next multidisciplinary review.
            </p>
          </div>
          <Badge>Preparation</Badge>
        </header>
      )}
      <div className="panel-body">
        <Notice>
          This pack brings together recorded work, answer-level change and
          contextual events. It does not determine clinical meaning or show an
          event as the cause of a response change.
        </Notice>
        <div className="review-pack-grid">
          <section className="review-pack-section">
            <ClipboardCheck size={19} aria-hidden="true" />
            <div>
              <h4>Review work</h4>
              <p>
                {pendingReviews.length
                  ? `${countLabel(pendingReviews.length, "submitted response")} await${pendingReviews.length === 1 ? "s" : ""} clinical review.`
                  : "No submitted response currently needs a clinical review."}
              </p>
              <p>
                {incompleteCollections.length
                  ? `${countLabel(incompleteCollections.length, "assessment collection")} ${incompleteCollections.length === 1 ? "is" : "are"} incomplete.`
                  : "No assessment collections are incomplete."}
              </p>
              <small>
                {nextStep?.dueText || "Current due date not recorded"}
              </small>
            </div>
            {onOpenAssessment && (
              <Button variant="secondary" onClick={onOpenAssessment}>
                Open assessment
              </Button>
            )}
          </section>
          <section className="review-pack-section">
            <ListChecks size={19} aria-hidden="true" />
            <div>
              <h4>Outcome evidence</h4>
              <p>{changeSummary}</p>
              {progress.latest && (
                <small>
                  Latest response: {formatDate(responseDate(progress.latest))}
                </small>
              )}
            </div>
            <small className="review-pack-note">
              Open Report to inspect literal answers and provenance.
            </small>
          </section>
          <section className="review-pack-section">
            <Flag size={19} aria-hidden="true" />
            <div>
              <h4>Contextual events</h4>
              <p>
                {events.length
                  ? `${countLabel(events.length, "recent contextual event")} recorded in this care period.`
                  : "No contextual events have been recorded in this care period."}
              </p>
              {events.length > 0 && (
                <ul>
                  {events.map((event) => (
                    <li key={event.id}>
                      <time dateTime={event.eventDate || event.date}>
                        {formatDate(event.eventDate || event.date)}
                      </time>
                      {event.title}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {onOpenEvents && (
              <TextLink onClick={onOpenEvents}>Review events</TextLink>
            )}
          </section>
        </div>
        <footer className="review-pack-footer">
          <span>
            Key clinician: <strong>{owner || "Not recorded"}</strong>
          </span>
          {onPlanFollowUp && (
            <TextLink onClick={onPlanFollowUp}>Plan follow-up</TextLink>
          )}
        </footer>
      </div>
    </Surface>
  );
}
