import { useEffect, useState } from "react";
import { ArrowRight, Check, HeartHandshake, ShieldCheck } from "lucide-react";
import { useStore } from "../store";
import { Button, Notice, Success } from "../components/UI";

export default function ConsentRequest({ session, navigate, onEnd }) {
  const { state, commit, storageError } = useStore();
  const person = state.people.find((item) => item.id === session?.personId);
  const episode = person?.episodes.find(
    (item) => item.id === session?.episodeId,
  );
  const request = person?.consentRequests?.find(
    (item) => item.id === session?.consentRequestId,
  );
  const [result, setResult] = useState("");
  const unavailable =
    !person ||
    !episode ||
    !request ||
    !["Sent", "Accepted"].includes(request.status);
  const end = () => {
    onEnd();
    navigate(
      session?.personId
        ? `/people/${session.personId}?tab=consent+%26+respondents`
        : "/",
    );
  };
  const decide = (status) => {
    const outcome = commit({
      type: "CONSENT_DECISION",
      personId: person.id,
      episodeId: episode.id,
      consentRequestId: request.id,
      status,
    });
    if (!outcome.error) setResult(status);
  };
  const withdraw = () => {
    const outcome = commit({
      type: "CONSENT_WITHDRAW",
      personId: person.id,
      episodeId: episode.id,
      consentRequestId: request.id,
    });
    if (!outcome.error) setResult("Withdrawn");
  };
  useEffect(() => {
    document.querySelector(".questionnaire h1")?.focus();
  }, [result, unavailable]);

  return (
    <div className="participant">
      <header className="participant-header">
        <span className="brand">YSCC</span>
        <span>Consent request · sample content</span>
      </header>
      <main className="questionnaire consent-participant">
        {unavailable || result === "Declined" || result === "Withdrawn" ? (
          <Success
            heading="h1"
            title={
              result === "Declined"
                ? "Your decision has been recorded"
                : result === "Withdrawn"
                  ? "Your withdrawal has been recorded"
                  : "This consent request is unavailable"
            }
            action={
              <Button variant="primary" onClick={end}>
                End session <ArrowRight size={18} />
              </Button>
            }
          >
            {result === "Declined"
              ? "You chose not to give this consent. This does not change any unrelated choices."
              : result === "Withdrawn"
                ? "This changes the future activities covered by this consent. Earlier decisions remain in the record."
                : "This request may have ended, been withdrawn, or already been decided. Please contact your care team if you need support."}
          </Success>
        ) : result === "Accepted" || request.status === "Accepted" ? (
          <Success
            heading="h1"
            title="Thank you. Your consent is recorded."
            action={
              <div className="actions consent-actions">
                <Button variant="secondary" onClick={withdraw}>
                  Withdraw consent
                </Button>
                <Button variant="primary" onClick={end}>
                  End session <Check size={18} />
                </Button>
              </div>
            }
          >
            You can withdraw this consent later. This sample demonstrates one
            approved purpose only; a live service must use its approved policy
            and support route.
          </Success>
        ) : (
          <>
            <span className="participant-symbol">
              <HeartHandshake size={35} />
            </span>
            <h1 tabIndex={-1}>A decision about your information.</h1>
            <p className="intro-copy">
              Please read this request and choose what feels right for you. You
              can ask your care team for help before deciding.
            </p>
            <div className="request-facts">
              <span>
                <ShieldCheck size={20} />
                <strong>{request.scope}</strong>
              </span>
              <span>
                <ShieldCheck size={20} />
                <strong>{request.version}</strong>
              </span>
            </div>
            <section className="consent-request-copy">
              <p className="eyebrow">Consent request</p>
              <h2>{request.title}</h2>
              <p>
                Your care team sent this request through {request.channel}. It
                applies only to the purpose shown here.
              </p>
              <Notice>
                Choosing decline does not affect a different consent purpose. In
                this sample, you can also withdraw after accepting.
              </Notice>
            </section>
            {storageError && (
              <Notice tone="error">
                This decision cannot be saved in this browser. Please ask a
                staff member for support.
              </Notice>
            )}
            <div className="actions consent-actions">
              <Button variant="secondary" onClick={() => decide("Declined")}>
                Decline
              </Button>
              <Button variant="primary" onClick={() => decide("Accepted")}>
                Accept <Check size={18} />
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
