import { FileText } from "lucide-react";
import { getInstrument } from "../instruments";
import { isOutstanding } from "../workflow";
import {
  clinicalReviewStatus,
  collectionActorIdentity,
  collectionStatus,
  formatDate,
  noClinicalReviewRequired,
} from "../model";
import RecordItem from "./RecordItem";
import { Badge, Button, PersonIdentity, TextLink } from "./UI";

export default function AssessmentCollectionCard({
  collection: col,
  person,
  score,
  selectedId,
  onViewDetails,
  onReview,
  onCollect,
  inTimeline = false,
  initiallyExpanded = inTimeline,
  headingLevel = inTimeline ? 4 : 3,
}) {
  const isPrior = !isOutstanding(col) && col.id !== selectedId;
  const respondent = collectionActorIdentity(person, col, "respondent");
  const instrument = getInstrument(col.version);
  const scoreLabel = score
    ? `Raw score: ${score.value}${score.range ? ` / ${score.range[1]}` : ""}`
    : col.response === "Submitted" ? "Raw score unavailable" : "Raw score awaiting response";
  return (
    <RecordItem
      title={col.label}
      subtitle={inTimeline || isPrior ? `${formatDate(col.due)} · ${col.version}` : undefined}
      status={collectionStatus(col)}
      collapsible={inTimeline || isPrior}
      initiallyExpanded={initiallyExpanded}
      selected={col.id === selectedId}
      headingLevel={headingLevel}
      className={inTimeline ? "record-item-compact assessment-timeline-item" : ""}
      lead={
        <>
          <span className="record-item-lead-icon"><FileText size={22} /></span>
          <span>
            <strong>{col.version}</strong>
            <small>
              {instrument?.questions.length || "Version-specific"}{" "}
              {instrument?.measureKey
                ? `sample coded items · ${scoreLabel}`
                : "sample questions · no clinical score"}
            </small>
          </span>
        </>
      }
      facts={[
        {
          label: "Respondent",
          value: <PersonIdentity name={respondent.name} descriptor={respondent.role} />,
        },
        { label: "Due date", value: formatDate(col.due) },
        { label: "Collection method", value: col.channel || "Not set up" },
      ]}
      secondary={
        <div className="record-item-statuses">
          <span>Assignment <Badge>{col.assignment}</Badge></span>
          <span>Response <Badge>{col.response}</Badge></span>
          <span>Review <Badge>{clinicalReviewStatus(col)}</Badge></span>
        </div>
      }
      note={
        col.readOnly
          ? "Historical assessment · view only · version retained"
          : col.closureKind && col.attempts.length > 0 &&
            col.attempts.every((attempt) => attempt.status === "Prepared (sample; not sent)")
            ? "Sample link prepared · no SMS sent · version pinned at assignment"
            : <>{col.attempts.length} delivery {col.attempts.length === 1 ? "attempt" : "attempts"} · version pinned at assignment</>
      }
      actions={
        <>
          <TextLink aria-haspopup="dialog" onClick={() => onViewDetails(col)}>View details</TextLink>
          {col.response === "Submitted" &&
            (!noClinicalReviewRequired(col) || collectionStatus(col) === "Completed") && (
              <Button variant="secondary" onClick={() => onReview(col)}>
                {col.needsReview
                  ? "Review updated answers"
                  : col.review === "Reviewed" || collectionStatus(col) === "Completed"
                    ? "Review recorded"
                    : "Review responses"}
              </Button>
            )}
          {col.response !== "Submitted" && (
            <Button variant="secondary" disabled={!col.due} aria-haspopup="dialog" onClick={() => onCollect(col)}>
              Collect response
            </Button>
          )}
        </>
      }
    />
  );
}
