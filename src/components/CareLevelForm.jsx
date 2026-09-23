import { Button, Field, Modal, Notice, ValidatedForm } from "./UI";
import { CARE_LEVELS, CARE_LEVEL_REASONS, PROGRAM_STREAMS, currentCarePeriod, nextDate } from "../carePeriods";
import { formatDate, TODAY } from "../model";

export default function CareLevelForm({ episode, clinicians, error, onClose, onSave }) {
  const current = currentCarePeriod(episode);
  const initial = !current;
  const reviewedCollections = (episode.collections || []).filter((item) => item.review === "Reviewed");
  return (
    <Modal
      title={initial ? "Record program stream and starting level" : "Change care level"}
      subtitle={`Care episode ${episode.number} · ${formatDate(episode.start)}–${episode.end ? formatDate(episode.end) : "present"}`}
      onClose={onClose}
    >
      <ValidatedForm onSubmit={(event) => {
        event.preventDefault();
        onSave({
          type: initial ? "SET_INITIAL_CARE_LEVEL" : "CHANGE_CARE_LEVEL",
          ...Object.fromEntries(new FormData(event.currentTarget)),
        });
      }}>
        <div className="form-body care-level-form">
          <Notice>Record the program stream for this episode and its dated level history.</Notice>
          {initial ? (
            <p>Confirm the level in effect from the episode start, {formatDate(episode.start)}. No earlier level will be inferred.</p>
          ) : (
            <p>Current level: <strong>{current.careLevel}</strong> since {formatDate(current.startDate)}. The change closes that period and starts the next one on the effective date.</p>
          )}
          <div className="form-grid">
            {initial && !episode.programStream && (
              <Field label="Program stream">
                <select name="programStream" defaultValue="" required>
                  <option value="">Choose stream</option>
                  {PROGRAM_STREAMS.map((stream) => <option key={stream} value={stream}>{stream}</option>)}
                </select>
              </Field>
            )}
            {episode.programStream && <p>Program stream: <strong>{episode.programStream}</strong></p>}
            {!initial && (
              <Field label="Effective date">
                <input name="effectiveDate" type="date" min={nextDate(current.startDate)} max={TODAY} defaultValue={TODAY} required />
              </Field>
            )}
            <Field label={initial ? "Starting care level" : "New care level"}>
              <select name="careLevel" defaultValue="" required>
                <option value="">Choose level</option>
                {CARE_LEVELS.filter((level) => level !== current?.careLevel).map((level) => <option key={level}>{level}</option>)}
              </select>
            </Field>
            <Field label="Delivering team or pod">
              <input name="deliveringUnit" defaultValue={current?.deliveringUnit || ""} required placeholder="Enter the team responsible at this level" />
            </Field>
            {!initial && (
              <>
                <Field label="Reason for change">
                  <select name="entryReason" defaultValue="" required>
                    <option value="">Choose reason</option>
                    {CARE_LEVEL_REASONS.map((reason) => <option key={reason}>{reason}</option>)}
                  </select>
                </Field>
                <Field label="Authorising clinician">
                  <select name="authorisingPractitionerId" defaultValue="" required>
                    <option value="">Choose clinician</option>
                    {clinicians.map((clinician) => <option key={clinician.id} value={clinician.id}>{clinician.name}</option>)}
                  </select>
                </Field>
                <Field label="Triggering clinical review (optional)">
                  <select name="triggeringReviewId" defaultValue="">
                    <option value="">No linked review</option>
                    {reviewedCollections.map((collection) => <option key={collection.id} value={collection.id}>{collection.label} · {collection.reviewDate ? formatDate(collection.reviewDate) : "date not recorded"}</option>)}
                  </select>
                </Field>
              </>
            )}
          </div>
          {error && <p className="field-error" role="alert">{error}</p>}
        </div>
        <div className="modal-footer">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">{initial ? "Record starting level" : "Save level change"}</Button>
        </div>
      </ValidatedForm>
    </Modal>
  );
}
