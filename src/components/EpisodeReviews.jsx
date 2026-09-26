import { useState } from "react";
import { addCalendarMonths, addDays, EPISODE_REVIEW_TYPES, episodeReviewActionError, episodeReviewSchedule, nextRollingOutcomeDate, reviewTiming } from "../episodeReviews";
import { formatDate, TODAY } from "../model";
import { Button, Field, Modal, Panel, TextLink, ValidatedForm } from "./UI";

export default function EpisodeReviews({ episode, personId, commit, canEdit }) {
  const schedule = episodeReviewSchedule(episode, TODAY);
  const [mode, setMode] = useState(null);
  const [error, setError] = useState("");
  const [completedDate, setCompletedDate] = useState(TODAY);
  const [nextDue, setNextDue] = useState("");
  const [nextDueEdited, setNextDueEdited] = useState(false);
  const proposedNextDue = (kind, date) => kind === "outcome"
    ? nextRollingOutcomeDate(episode.reviewAnchorDate || episode.start,
      addDays(date > (schedule.outcome.due || "") ? date : schedule.outcome.due, 1))
    : addCalendarMonths(date, EPISODE_REVIEW_TYPES[kind].months);
  const close = () => { setMode(null); setError(""); };
  const openRecord = (kind) => {
    setCompletedDate(TODAY);
    setNextDue(proposedNextDue(kind, TODAY));
    setNextDueEdited(false);
    setError("");
    setMode(kind);
  };
  const save = (action) => {
    const problem = episodeReviewActionError(episode, action, TODAY);
    if (problem) return setError(problem);
    const result = commit({ ...action, personId, episodeId: episode.id });
    if (result.error) return setError(result.error);
    close();
  };

  return (
    <>
      <Panel
        className="episode-reviews-panel"
        title="Episode reviews"
        action={canEdit && <TextLink aria-haspopup="dialog" onClick={() => { setError(""); setMode("schedule"); }}>Edit schedule</TextLink>}
      >
        <div className="panel-body stack">
          <div className="episode-review-grid">
            {Object.entries(EPISODE_REVIEW_TYPES).map(([kind, config]) => {
              const track = schedule[kind];
              const latest = track.history[0];
              return (
                <section className="episode-review-track" key={kind} aria-label={config.label}>
                  <div className="episode-review-track-heading">
                    <h3>{config.label}</h3>
                    <span>{kind === "outcome" ? "Every 90 days" : "Monthly"}</span>
                  </div>
                  <div className="episode-review-next">
                    <span>{schedule.confirmed ? "Next due" : "Proposed date"}</span>
                    <strong>{track.due ? <time dateTime={track.due}>{formatDate(track.due)}</time> : "Not scheduled"}</strong>
                    {schedule.confirmed && <small className={track.due && track.due < TODAY ? "status-overdue-text" : undefined}>{reviewTiming(track.due, TODAY)}</small>}
                  </div>
                  <p>{latest ? `Last recorded ${formatDate(latest.date)} by ${latest.actor}` : "No completed review recorded"}</p>
                  {canEdit && <Button variant="secondary" disabled={!schedule.confirmed} onClick={() => openRecord(kind)}>Record {kind === "outcome" ? "review" : "check"}</Button>}
                  {track.history.length > 0 && (
                    <details>
                      <summary>History · {track.history.length}</summary>
                      <ol>
                        {track.history.map((item) => (
                          <li key={item.id}>
                            <strong>{formatDate(item.date)}</strong> · {item.summary} · next due {formatDate(item.nextDue)}
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                </section>
              );
            })}
          </div>
          <p className="episode-reviews-context">Episode review dates are tracked separately from questionnaire collections and reviews of submitted answers.</p>
        </div>
      </Panel>
      {mode === "schedule" && (
        <Modal title="Edit episode review schedule" onClose={close}>
          <ValidatedForm onSubmit={(event) => {
            event.preventDefault();
            const values = Object.fromEntries(new FormData(event.currentTarget));
            save({ type: "SCHEDULE_EPISODE_REVIEWS", outcomeDue: values.outcomeDue,
              experienceDue: values.experienceDue, confirmed: values.confirmed === "on", reason: values.reason });
          }}>
            <div className="form-body stack">
              <Field label="Next outcome review">
                <input type="date" name="outcomeDue" min={episode.start} defaultValue={schedule.outcome.due || ""} required />
              </Field>
              <Field label="Next experience check">
                <input type="date" name="experienceDue" min={episode.start} defaultValue={schedule.experience.due || ""} required />
              </Field>
              <label className="check-field">
                <input type="checkbox" name="confirmed" defaultChecked={schedule.confirmed} />
                Service cadence confirmed for this care journey
              </label>
              <Field label="Reason for schedule change">
                <textarea name="reason" rows={3} required />
              </Field>
              {error && <p className="field-error" role="alert">{error}</p>}
            </div>
            <div className="modal-footer"><Button type="button" onClick={close}>Cancel</Button><Button type="submit" variant="primary">Save schedule</Button></div>
          </ValidatedForm>
        </Modal>
      )}
      {mode && mode !== "schedule" && (
        <Modal title={`Record ${EPISODE_REVIEW_TYPES[mode].label.toLowerCase()}`} onClose={close}>
          <ValidatedForm onSubmit={(event) => {
            event.preventDefault();
            const values = Object.fromEntries(new FormData(event.currentTarget));
            save({ type: "RECORD_EPISODE_REVIEW", kind: mode, completedDate,
              nextDue, summary: values.summary });
          }}>
            <div className="form-body stack">
              <Field label="Completed date">
                <input type="date" min={episode.start} max={TODAY} value={completedDate} required
                  onChange={(event) => {
                    const date = event.target.value;
                    setCompletedDate(date);
                    if (!nextDueEdited) setNextDue(proposedNextDue(mode, date) || "");
                  }} />
              </Field>
              <Field label={mode === "outcome" ? "Outcome and next step" : "Experience feedback and next step"}>
                <textarea name="summary" rows={4} required />
              </Field>
              <Field label="Next due date">
                <input type="date" min={completedDate} value={nextDue || ""} required
                  onChange={(event) => { setNextDue(event.target.value); setNextDueEdited(true); }} />
              </Field>
              {error && <p className="field-error" role="alert">{error}</p>}
            </div>
            <div className="modal-footer"><Button type="button" onClick={close}>Cancel</Button><Button type="submit" variant="primary">Record {mode === "outcome" ? "review" : "check"}</Button></div>
          </ValidatedForm>
        </Modal>
      )}
    </>
  );
}
