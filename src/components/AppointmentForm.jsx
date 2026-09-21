import { useState } from "react";
import { Field, Modal, Notice, Button, ValidatedForm } from "./UI";
import {
  APPOINTMENT_ATTENDANCE,
  APPOINTMENT_DELIVERY_MODES,
} from "../appointments";
import { formatDate, practitionerServiceOptions, TODAY } from "../model";

const formValues = (event) =>
  Object.fromEntries(new FormData(event.currentTarget));

export default function AppointmentForm({
  episode,
  people,
  error,
  onClose,
  onSave,
}) {
  const [attendance, setAttendance] = useState("Planned");
  const actualLatestDate =
    episode.end && episode.end < TODAY ? episode.end : TODAY;
  const practitionerServices = practitionerServiceOptions(people);

  return (
    <Modal
      title="Add appointment or service contact"
      subtitle={`Care period ${episode.number} · ${formatDate(episode.start)}–${episode.end ? formatDate(episode.end) : "present"}`}
      onClose={onClose}
    >
      <ValidatedForm
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ type: "ADD_APPOINTMENT", ...formValues(event) });
        }}
      >
        <div className="form-body appointment-form">
          <Notice>
            Prototype operational record only. This is not an appointment-booking
            system or an approved PMHC-MDS submission record.
          </Notice>
          <div className="form-grid">
            <Field label="Contact status">
              <select
                name="attendance"
                value={attendance}
                onChange={(event) => setAttendance(event.target.value)}
              >
                {APPOINTMENT_ATTENDANCE.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
            <Field label="Delivery mode">
              <select name="deliveryMode" required defaultValue="In person">
                {APPOINTMENT_DELIVERY_MODES.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
            <Field label="Planned date">
              <input name="plannedDate" type="date" min={episode.start} required />
            </Field>
            <Field label="Planned time">
              <input name="plannedTime" type="time" required />
            </Field>
            <Field label="Planned duration (minutes)">
              <input
                name="plannedDurationMinutes"
                type="number"
                min="1"
                max="600"
                defaultValue="60"
                required
              />
            </Field>
            <Field label="Practitioner or service">
              <select
                name="practitionerService"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Choose practitioner or service
                </option>
                {practitionerServices.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {attendance === "Attended" && (
            <div className="appointment-actual-fields">
              <h3>Actual contact</h3>
              <p>Record what happened, not a planned value.</p>
              <div className="form-grid">
                <Field label="Actual date">
                  <input
                    name="actualDate"
                    type="date"
                    min={episode.start}
                    max={actualLatestDate}
                    required
                  />
                </Field>
                <Field label="Actual time">
                  <input name="actualTime" type="time" required />
                </Field>
                <Field label="Actual duration (minutes)">
                  <input
                    name="actualDurationMinutes"
                    type="number"
                    min="1"
                    max="600"
                    required
                  />
                </Field>
              </div>
            </div>
          )}
          <Field label="Notes (optional)">
            <textarea
              name="notes"
              rows="3"
              placeholder="Record a factual note about the contact, cancellation or non-attendance…"
            />
          </Field>
          {error && <p className="field-error">{error}</p>}
        </div>
        <div className="modal-footer">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save contact record
          </Button>
        </div>
      </ValidatedForm>
    </Modal>
  );
}
