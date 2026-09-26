import { isOutstanding } from "../workflow";
import { assessmentScoreLabel } from "../assessmentGroups";
import { responseDate } from "../progress";
import {
  clinicalReviewStatus,
  collectionActorIdentity,
  collectionStatus,
  formatDate,
  noClinicalReviewRequired,
} from "../model";
import RecordItem from "./RecordItem";
import RelatedRecordsAccordion from "./RelatedRecordsAccordion";
import { Badge, Button, PersonIdentity, TextLink } from "./UI";

export default function AssessmentCollectionCard({
  collection: col,
  person,
  score,
  selectedId,
  onViewDetails,
  onReview,
  onCollect,
  relatedContacts = [],
  inTimeline = false,
  initiallyExpanded = inTimeline,
  headingLevel = inTimeline ? 4 : 3,
}) {
  const isPrior = !isOutstanding(col) && col.id !== selectedId;
  const respondent = collectionActorIdentity(person, col, "respondent");
  const scoreText = score
    ? ` · Raw score: ${score.value}${score.range ? ` / ${score.range[1]}` : ""}`
    : "";
  const submittedDate = responseDate(col);
  const scoreValue = assessmentScoreLabel(col, score);
  return (
    <RecordItem
      title={col.label}
      subtitle={`${formatDate(col.due)} · ${col.version}${scoreText}`}
      status={collectionStatus(col)}
      collapsible={inTimeline || isPrior}
      initiallyExpanded={initiallyExpanded}
      selected={col.id === selectedId}
      headingLevel={headingLevel}
      className={`assessment-collection-card${inTimeline ? " record-item-compact assessment-timeline-item" : ""}`}
      facts={[
        {
          label: "Respondent",
          value: <PersonIdentity name={respondent.name} descriptor={respondent.role} />,
        },
        { label: "Due date", value: formatDate(col.due) },
        { label: "Submitted", value: submittedDate ? formatDate(submittedDate) : "Not submitted" },
        { label: "Score", value: scoreValue },
      ]}
      secondary={
        <>
          <div className="record-item-statuses">
            <span>Assignment <Badge>{col.assignment}</Badge></span>
            <span>Response <Badge>{col.response}</Badge></span>
            <span>Review <Badge>{clinicalReviewStatus(col)}</Badge></span>
          </div>
          <RelatedRecordsAccordion kind="contacts" records={relatedContacts} collection={col} />
        </>
      }
      note={col.readOnly ? "Historical assessment · view only · version retained" : null}
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
