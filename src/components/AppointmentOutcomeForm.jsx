import { useState } from "react";
import { Field, Modal, Notice, Button, ValidatedForm } from "./UI";
import { APPOINTMENT_ATTENDANCE } from "../appointments";
import { formatDate, TODAY } from "../model";

const formValues = (event) => Object.fromEntries(new FormData(event.currentTarget));

export default function AppointmentOutcomeForm({
  episode,
  appointment,
  error,
  onClose,
  onSave,
}) {
  const [attendance, setAttendance] = useState("Attended");
  const actualLatestDate =
    episode.end && episode.end < TODAY ? episode.end : TODAY;

  return (
    <Modal
      title="Record appointment outcome"
      subtitle={`${appointment.practitionerService} · planned ${formatDate(appointment.plannedDate)} at ${appointment.plannedTime}`}
      onClose={onClose}
    >
      <ValidatedForm
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            type: "RECORD_APPOINTMENT_OUTCOME",
            appointmentId: appointment.id,
            ...formValues(event),
          });
        }}
      >
        <div className="form-body appointment-form">
          <Notice tone="amber">
            This records the outcome of the existing planned contact. It does
            not create or change an external appointment.
          </Notice>
          <dl className="appointment-outcome-plan">
            <div>
              <dt>Planned contact</dt>
              <dd>{formatDate(appointment.plannedDate)} at {appointment.plannedTime}</dd>
            </div>
            <div>
              <dt>Planned duration</dt>
              <dd>{appointment.plannedDurationMinutes} min</dd>
            </div>
            <div>
              <dt>Delivery mode</dt>
              <dd>{appointment.deliveryMode}</dd>
            </div>
          </dl>
          <Field label="Outcome">
            <select
              name="attendance"
              value={attendance}
              onChange={(event) => setAttendance(event.target.value)}
            >
              {APPOINTMENT_ATTENDANCE.filter((value) => value !== "Planned").map(
                (value) => (
                  <option key={value}>{value}</option>
                ),
              )}
            </select>
          </Field>
          {attendance === "Attended" && (
            <div className="appointment-actual-fields">
              <h3>Actual contact</h3>
              <p>Confirm what happened, rather than the planned values.</p>
              <div className="form-grid">
                <Field label="Actual date">
                  <input
                    name="actualDate"
                    type="date"
                    min={episode.start}
                    max={actualLatestDate}
                    defaultValue={appointment.plannedDate}
                    required
                  />
                </Field>
                <Field label="Actual time">
                  <input
                    name="actualTime"
                    type="time"
                    defaultValue={appointment.plannedTime}
                    required
                  />
                </Field>
                <Field label="Actual duration (minutes)">
                  <input
                    name="actualDurationMinutes"
                    type="number"
                    min="1"
                    max="600"
                    defaultValue={appointment.plannedDurationMinutes}
                    required
                  />
                </Field>
              </div>
            </div>
          )}
          <Field label="Outcome notes (optional)">
            <textarea
              name="outcomeNotes"
              rows="3"
              placeholder="Record a factual outcome, cancellation reason or non-attendance detail…"
            />
          </Field>
          {error && <p className="field-error">{error}</p>}
        </div>
        <div className="modal-footer">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save outcome
          </Button>
        </div>
      </ValidatedForm>
    </Modal>
  );
}
