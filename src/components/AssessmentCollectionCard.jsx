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
  scheduleAssessments = true,
  linkAssessmentAppointments = true,
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
  const scoreValue = assessmentScoreLabel(score);
  const simpleStatus = col.response === "Submitted" ? "Completed" : col.response === "Draft" ? "Draft" : "Created";
  if (compactGrouped) return (
    <article className={`assessment-grouped-record${col.id === selectedId ? " selected-collection" : ""}`}>
      <div className="assessment-grouped-record-heading">
        <div className="assessment-grouped-record-title">
          <span className="assessment-grouped-record-eyebrow">Assessment</span>
          <h4>{col.label}</h4>
          {col.readOnly && <small>Historical assessment · view only · version retained</small>}
          {linkAssessmentAppointments && col.externalAppointment && <small>External contact · {formatDate(col.externalAppointment.date)} at {col.externalAppointment.time}</small>}
        </div>
        <Badge>{scheduleAssessments ? collectionStatus(col) : simpleStatus}</Badge>
      </div>
      <dl className="record-item-facts assessment-grouped-record-facts">
        <div><dt>Created</dt><dd>{col.createdAt ? formatDate(col.createdAt.slice(0, 10)) : "Not recorded"}</dd></div>
        {scheduleAssessments && col.due && <div><dt>Due</dt><dd>{formatDate(col.due)}</dd></div>}
        <div><dt>Completed</dt><dd>{submittedDate ? formatDate(submittedDate) : "—"}</dd></div>
        <div className={col.response === "Submitted" ? undefined : "assessment-record-action"}>
          <dt className={col.response === "Submitted" ? undefined : "sr-only"}>{col.response === "Submitted" ? "Score" : "Response action"}</dt>
          <dd>{col.response === "Submitted" ? scoreValue : <Button variant="secondary" onClick={() => onCollect(col)}>{col.response === "Draft" ? "Continue response" : "Collect response"}</Button>}</dd>
        </div>
      </dl>
      {linkAssessmentAppointments && <RelatedRecordsAccordion inline kind="contacts" records={relatedContacts} collection={col} />}
    </article>
  );
  return (
    <RecordItem
      title={col.label}
      subtitle={`${scheduleAssessments && col.due ? `${formatDate(col.due)} · ` : ""}${col.version}${simpleAssessments ? "" : scoreText}`}
      status={scheduleAssessments ? collectionStatus(col) : simpleStatus}
      collapsible={simpleAssessments || inTimeline || isPrior}
      initiallyExpanded={simpleAssessments ? col.response !== "Submitted" : initiallyExpanded}
      selected={col.id === selectedId}
      headingLevel={headingLevel}
      className={`assessment-collection-card${inTimeline ? " record-item-compact assessment-timeline-item" : ""}`}
      facts={simpleAssessments ? [
        { label: "Created", value: col.createdAt ? formatDate(col.createdAt.slice(0, 10)) : "Not recorded" },
        ...(scheduleAssessments && col.due ? [{ label: "Due date", value: formatDate(col.due) }] : []),
        ...(linkAssessmentAppointments && col.externalAppointment ? [{ label: "External contact", value: `${formatDate(col.externalAppointment.date)} at ${col.externalAppointment.time}` }] : []),
        { label: "Completed", value: submittedDate ? formatDate(submittedDate) : "—" },
        { label: "Score", value: scoreValue },
      ] : [
        {
          label: "Respondent",
          value: <PersonIdentity name={respondent.name} descriptor={respondent.role} />,
        },
        ...(scheduleAssessments && col.due ? [{ label: "Due date", value: formatDate(col.due) }] : []),
        ...(linkAssessmentAppointments && col.externalAppointment ? [{ label: "External contact", value: `${formatDate(col.externalAppointment.date)} at ${col.externalAppointment.time}` }] : []),
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
          {linkAssessmentAppointments && <RelatedRecordsAccordion kind="contacts" records={relatedContacts} collection={col} />}
        </>
      }
      note={col.readOnly ? "Historical assessment · view only · version retained" : null}
      actions={(!simpleAssessments || col.response !== "Submitted" || linkAssessmentAppointments || scheduleAssessments) && (
        <>
          {(!simpleAssessments || linkAssessmentAppointments || scheduleAssessments) && <TextLink aria-haspopup="dialog" onClick={() => onViewDetails(col)}>View details</TextLink>}
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
            <Button variant="secondary" disabled={!col.due && !col.scheduleFree} onClick={() => onCollect(col)}>
              {simpleAssessments && col.response === "Draft" ? "Continue response" : "Collect response"}
            </Button>
          )}
        </>
      )}
    />
  );
}
