import { useState } from "react";
import { useStore } from "../store";
import { getInstrument } from "../instruments";
import { Empty, Button } from "../components/UI";
import ReviewResponses from "../components/ReviewResponses";
import ProgressDashboard from "../components/ProgressDashboard";
import QuestionnaireEvidence from "./QuestionnaireEvidence";

export default function AssessmentReviewRecord({
  personId,
  collectionId,
  navigate,
}) {
  const { state } = useStore();
  const person = state.people.find((item) => item.id === personId);
  const episode = person?.episodes.find((item) =>
    item.collections.some((collection) => collection.id === collectionId),
  );
  const collection = episode?.collections.find(
    (item) => item.id === collectionId,
  );
  const [questionnaireVersion, setQuestionnaireVersion] = useState(
    collection?.version || "",
  );

  if (!person || !episode || !collection)
    return (
      <Empty title="Assessment review record unavailable">
        <Button onClick={() => navigate(`/people/${personId}?tab=assessment`)}>
          Back to Assessment
        </Button>
      </Empty>
    );

  const instrument = getInstrument(collection.version);
  const hasLikertQuestions = instrument?.questions.some(
    (question) => question.responseType === "likert",
  );
  const returnToAssessment = () =>
    navigate(
      `/people/${person.id}?tab=assessment&episode=${episode.id}&collection=${collection.id}`,
      { scroll: false },
    );
  const openReviewRecord = (target) =>
    navigate(`/people/${person.id}/assessment-review/${target.id}`, {
      scroll: false,
    });

  const analysis = hasLikertQuestions ? (
    <section
      className="assessment-review-analysis"
      aria-label="Likert analysis"
    >
      <ProgressDashboard
        person={person}
        episode={episode}
        selectedVersion={questionnaireVersion}
        onSelectedVersionChange={setQuestionnaireVersion}
        fixedVersion={collection.version}
        includeSummary={false}
      />
    </section>
  ) : (
    <section
      className="assessment-review-analysis"
      aria-label="Questionnaire comparison and details"
    >
      <QuestionnaireEvidence
        person={person}
        episode={episode}
        questionnaireVersion={collection.version}
        initialLatestId={collection.id}
        openModal={(action) => {
          const target = episode.collections.find(
            (item) => item.id === action.collectionId,
          );
          if (action.type === "review" && target) openReviewRecord(target);
        }}
      />
    </section>
  );

  return (
    <ReviewResponses
      person={person}
      episode={episode}
      collection={collection}
      onClose={returnToAssessment}
      notify={() => {}}
      fullPage
      analysis={analysis}
    />
  );
}
