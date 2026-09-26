import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CheckCircle2, X } from "lucide-react";
import { useStore } from "./store";
import Shell from "./components/Shell";
import Forms from "./components/Forms";
import Worklist from "./features/Worklist";
import People from "./features/People";
import Person from "./features/Person";
import AssessmentReviewRecord from "./features/AssessmentReviewRecord";
import { Quality, Administration, Help } from "./features/Operations";
import GlobalChangeLog from "./features/GlobalChangeLog";
import Questionnaire from "./features/Questionnaire";
import ConsentRequest from "./features/ConsentRequest";
import { getQualityIssues } from "./dataQuality";
import { TODAY } from "./model";
import { Empty, Button } from "./components/UI";
export default function App() {
  const path = usePathname(),
    router = useRouter(),
    { state, storageError } = useStore();
  const [modal, setModal] = useState(null),
    [toast, setToast] = useState("");
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("yscc-session"));
    } catch {
      return null;
    }
  });
  const navigate = (href, options) => {
    router.push(href, options);
  };
  useEffect(() => {
    setModal(null);
  }, [path]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  const startQuestionnaire = (context) => {
    const value = { ...context, id: crypto.randomUUID() };
    setSession(value);
    try {
      sessionStorage.setItem("yscc-session", JSON.stringify(value));
    } catch {}
    navigate("/questionnaire");
  };
  const startConsentRequest = (context) => {
    const value = { ...context, kind: "consent", id: crypto.randomUUID() };
    setSession(value);
    try {
      sessionStorage.setItem("yscc-session", JSON.stringify(value));
    } catch {}
    navigate("/consent");
  };
  const finishSession = () => {
    try {
      sessionStorage.removeItem("yscc-session");
    } catch {}
  };
  const questionnaireParams = path === "/questionnaire"
    ? new URLSearchParams(window.location.search)
    : null;
  const linkedPersonId = questionnaireParams?.get("person");
  const linkedEpisodeId = questionnaireParams?.get("episode");
  const linkedCollectionId = questionnaireParams?.get("collection");
  const linkedCollection = state.people.find((person) => person.id === linkedPersonId)
    ?.episodes.find((episode) => episode.id === linkedEpisodeId)
    ?.collections.find((collection) => collection.id === linkedCollectionId);
  const linkedQuestionnaireSession = linkedCollection ? {
    personId: linkedPersonId,
    episodeId: linkedEpisodeId,
    collectionId: linkedCollectionId,
    channel: linkedCollection.channel,
    respondent: linkedCollection.respondent,
    assistance: linkedCollection.assistance,
    attemptId: linkedCollection.attempts?.at(-1)?.id,
  } : null;
  if (path === "/consent")
    return (
      <ConsentRequest
        session={session?.kind === "consent" ? session : null}
        navigate={navigate}
        onEnd={finishSession}
      />
    );
  if (path === "/preview" || path === "/questionnaire")
    return (
      <Questionnaire
        key={path}
        session={path === "/preview" ? null : linkedCollectionId
          ? linkedQuestionnaireSession || { unavailable: true }
          : session || { unavailable: true }}
        navigate={navigate}
        onEnd={finishSession}
      />
    );
  const shared = { navigate, openModal: setModal };
  const qualityCount = getQualityIssues(state, TODAY).filter(
    (issue) => !["Resolved", "Closed"].includes(issue.status),
  ).length;
  const assessmentReviewMatch = path.match(
    /^\/people\/([^/]+)\/assessment-review\/([^/]+)$/,
  );
  let page =
    path === "/" ? (
      <Worklist {...shared} />
    ) : path === "/people" ? (
      <People {...shared} />
    ) : assessmentReviewMatch ? (
      <AssessmentReviewRecord
        personId={assessmentReviewMatch[1]}
        collectionId={assessmentReviewMatch[2]}
        navigate={navigate}
        openModal={setModal}
      />
    ) : path.startsWith("/people/") ? (
      <Person key={path} id={path.split("/")[2]} {...shared} />
    ) : path === "/quality" ? (
      <Quality {...shared} />
    ) : path === "/change-log" ? (
      <GlobalChangeLog {...shared} />
    ) : path === "/administration" ? (
      <Administration {...shared} />
    ) : path === "/help" ? (
      <Help {...shared} />
    ) : (
      <Empty title="This view is unavailable">
        <Button onClick={() => navigate("/")}>Go to My work</Button>
      </Empty>
    );
  return (
    <>
      <Shell
        path={path}
        {...shared}
        qualityCount={qualityCount}
        storageError={storageError}
      >
        {page}
      </Shell>
      {modal && (
        <Forms
          key={JSON.stringify(modal)}
          modal={modal}
          openModal={setModal}
          onClose={() =>
            setModal(
              modal.returnToCollection ||
                modal.returnToReview ||
                modal.returnToDetails
                ? {
                    type: modal.returnToCollection
                      ? "collection"
                      : modal.returnToReview
                        ? "review"
                        : "collection-details",
                    reviewDraft: modal.reviewDraft,
                    collectionDraft: modal.collectionDraft,
                    personId: modal.personId,
                    episodeId: modal.episodeId,
                    collectionId: modal.collectionId,
                    collectResponse: modal.collectResponse,
                  }
                : null,
            )
          }
          navigate={navigate}
          startQuestionnaire={startQuestionnaire}
          startConsentRequest={startConsentRequest}
          notify={setToast}
        />
      )}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast">
            <CheckCircle2 size={20} />
            <span>{toast}</span>
            <button aria-label="Dismiss message" onClick={() => setToast("")}>
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
