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
  simpleAssessments = false,
  compactGrouped = false,
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
  const simpleStatus = col.response === "Submitted" ? "Completed" : col.response === "Draft" ? "Draft" : "Created";
  if (compactGrouped) return (
    <article className={`assessment-grouped-record${col.id === selectedId ? " selected-collection" : ""}`}>
      <div className="assessment-grouped-record-title">
        <h4>{col.label}</h4>
        {col.readOnly && <small>Historical assessment · view only · version retained</small>}
      </div>
      <Badge>{simpleStatus}</Badge>
      <dl className="assessment-grouped-record-facts">
        <div><dt>Created</dt><dd>{col.createdAt ? formatDate(col.createdAt.slice(0, 10)) : "Not recorded"}</dd></div>
        <div><dt>Completed</dt><dd>{submittedDate ? formatDate(submittedDate) : "—"}</dd></div>
        <div>
          <dt>{col.response === "Submitted" ? "Score" : "Next step"}</dt>
          <dd>{col.response === "Submitted" ? scoreValue : <Button variant="secondary" onClick={() => onCollect(col)}>Collect response</Button>}</dd>
        </div>
      </dl>
    </article>
  );
  return (
    <RecordItem
      title={col.label}
      subtitle={simpleAssessments ? col.version : `${formatDate(col.due)} · ${col.version}${scoreText}`}
      status={simpleAssessments ? simpleStatus : collectionStatus(col)}
      collapsible={simpleAssessments || inTimeline || isPrior}
      initiallyExpanded={simpleAssessments ? col.response !== "Submitted" : initiallyExpanded}
      selected={col.id === selectedId}
      headingLevel={headingLevel}
      className={`assessment-collection-card${inTimeline ? " record-item-compact assessment-timeline-item" : ""}`}
      facts={simpleAssessments ? [
        { label: "Created", value: col.createdAt ? formatDate(col.createdAt.slice(0, 10)) : "Not recorded" },
        { label: "Completed", value: submittedDate ? formatDate(submittedDate) : "—" },
        { label: "Score", value: scoreValue },
      ] : [
        {
          label: "Respondent",
          value: <PersonIdentity name={respondent.name} descriptor={respondent.role} />,
        },
        { label: "Due date", value: formatDate(col.due) },
        { label: "Submitted", value: submittedDate ? formatDate(submittedDate) : "Not submitted" },
        { label: "Score", value: scoreValue },
      ]}
      secondary={simpleAssessments ? null :
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
      actions={(!simpleAssessments || col.response !== "Submitted") && (
        <>
          {!simpleAssessments && <TextLink aria-haspopup="dialog" onClick={() => onViewDetails(col)}>View details</TextLink>}
          {!simpleAssessments && col.response === "Submitted" &&
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
            <Button variant="secondary" disabled={!col.due && !simpleAssessments && !col.scheduleFree} onClick={() => onCollect(col)}>
              Collect response
            </Button>
          )}
        </>
      )}
    />
  );
}
