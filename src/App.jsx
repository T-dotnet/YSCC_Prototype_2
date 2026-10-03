import { lazy, Suspense, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CheckCircle2, X } from "lucide-react";
import { useStore } from "./store";
import Shell from "./components/Shell";
import { getQualityIssues } from "./dataQuality";
import { TODAY } from "./model";
import { Empty, Button } from "./components/UI";
const Forms = lazy(() => import("./components/Forms"));
const Worklist = lazy(() => import("./features/Worklist"));
const People = lazy(() => import("./features/People"));
const Person = lazy(() => import("./features/Person"));
const SampleClientPreview = lazy(() => import("./features/SampleClientPreview"));
const AssessmentReviewRecord = lazy(() => import("./features/AssessmentReviewRecord"));
const Quality = lazy(() => import("./features/Operations").then(module => ({ default: module.Quality })));
const Administration = lazy(() => import("./features/Operations").then(module => ({ default: module.Administration })));
const Help = lazy(() => import("./features/Operations").then(module => ({ default: module.Help })));
const AssessmentFeatures = lazy(() => import("./features/AssessmentFeatures"));
const GeneralReport = lazy(() => import("./features/GeneralReport"));
const GlobalChangeLog = lazy(() => import("./features/GlobalChangeLog"));
const Questionnaire = lazy(() => import("./features/Questionnaire"));
const BundleQuestionnaire = lazy(() => import("./components/BundleQuestionnaire"));
const ConsentRequest = lazy(() => import("./features/ConsentRequest"));
const routeFallback = <div className="boot" role="status">Opening view…</div>;
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
      <Suspense fallback={routeFallback}>
        <ConsentRequest
          session={session?.kind === "consent" ? session : null}
          navigate={navigate}
          onEnd={finishSession}
        />
      </Suspense>
    );
  const activeQuestionnaireSession = linkedCollectionId ? linkedQuestionnaireSession : session;
  const bundlePerson = state.people.find(person => person.id === activeQuestionnaireSession?.personId);
  const bundleEpisode = bundlePerson?.episodes.find(episode => episode.id === activeQuestionnaireSession?.episodeId);
  const bundleCollection = bundleEpisode?.collections.find(collection => collection.id === activeQuestionnaireSession?.collectionId);
  if (path === "/questionnaire" && (bundleCollection?.bundleId || bundleCollection?.scheduleRuleId || (bundleCollection && new URLSearchParams(window.location.search).get("overview") === "1")))
    return <Suspense fallback={routeFallback}><BundleQuestionnaire key={bundleCollection.id} person={bundlePerson} episode={bundleEpisode}
      collection={bundleCollection} participant initialAttemptId={activeQuestionnaireSession?.attemptId} onClose={() => {
        finishSession();
        navigate(`/people/${encodeURIComponent(bundlePerson.id)}?${new URLSearchParams({tab:'assessment',episode:bundleEpisode.id})}`);
      }} /></Suspense>;
  if (path === "/preview" || path === "/questionnaire")
    return (
      <Suspense fallback={routeFallback}>
        <Questionnaire
          key={path}
          session={path === "/preview" ? null : linkedCollectionId
            ? linkedQuestionnaireSession || { unavailable: true }
            : session || { unavailable: true }}
          navigate={navigate}
          onEnd={finishSession}
        />
      </Suspense>
    );
  const shared = { navigate, openModal: setModal };
  const qualityCount = getQualityIssues(state, TODAY).filter(
    (issue) => !["Resolved", "Closed"].includes(issue.status),
  ).length;
  const assessmentReviewMatch = path.match(
    /^\/people\/([^/]+)\/assessment-review\/([^/]+)$/,
  );
  const sampleClientMatch = path.match(/^\/(?:administration|people)\/sample\/([^/]+)$/);
  let page =
    path === "/" ? (
      <Worklist {...shared} />
    ) : path === "/people" ? (
      <People {...shared} />
    ) : sampleClientMatch ? (
      <SampleClientPreview id={sampleClientMatch[1]} navigate={navigate} />
    ) : assessmentReviewMatch ? (
      <AssessmentReviewRecord
        personId={assessmentReviewMatch[1]}
        collectionId={assessmentReviewMatch[2]}
        navigate={navigate}
        openModal={setModal}
      />
    ) : path.startsWith("/people/") ? (
      <Person key={path} id={path.split("/")[2]} {...shared} />
    ) : path === "/general-report" ? (
      <GeneralReport />
    ) : path === "/quality" ? (
      <Quality {...shared} />
    ) : path === "/change-log" ? (
      <GlobalChangeLog {...shared} />
    ) : path === "/administration" ? (
      <Administration {...shared} />
    ) : (path === "/assessment-features" || path === "/settings") ? (
      <AssessmentFeatures {...shared} />
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
        <Suspense fallback={routeFallback}>{page}</Suspense>
      </Shell>
      {modal && <Suspense fallback={routeFallback}>
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
      </Suspense>}
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
