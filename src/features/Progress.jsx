import { useState } from "react";
import QuestionnaireEvidence from "./QuestionnaireEvidence";
import ProgressDashboard from "../components/ProgressDashboard";
import { formatDate } from "../model";
import { reportEvidence, responseDate } from "../progress";

export default function Progress({ person, episode, openModal }) {
  const [questionnaireVersion, setQuestionnaireVersion] = useState(null);
  const latestResponse = reportEvidence(person, episode).dated.at(-1);
  const latestResponseDate = responseDate(latestResponse);

  return (
    <div className="stack patient-progress">
      <div className="section-toolbar report-toolbar">
        <div>
          <h2>Analysis</h2>
          <p>
            {latestResponseDate
              ? `Latest response ${formatDate(latestResponseDate)}`
              : "No dated responses yet"}
          </p>
        </div>
      </div>
      <ProgressDashboard
        person={person}
        episode={episode}
        selectedVersion={questionnaireVersion}
        onSelectedVersionChange={setQuestionnaireVersion}
        details={
          <QuestionnaireEvidence
            person={person}
            episode={episode}
            openModal={openModal}
            questionnaireVersion={questionnaireVersion}
          />
        }
      />
    </div>
  );
}
