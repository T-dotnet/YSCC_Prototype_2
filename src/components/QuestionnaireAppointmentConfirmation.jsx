import { useEffect, useRef, useState } from "react";
import { APPOINTMENT_ATTENDANCE, CONTACT_TYPES } from "../appointments";
import { currentStaff, formatDate, TODAY } from "../model";
import { useStore } from "../store";
import { Button, Field, Notice, ValidatedForm } from "./UI";

export default function QuestionnaireAppointmentConfirmation({
  appointment,
  collection,
  episode,
  error,
  onBack,
  onConfirm,
  tablet = false,
}) {
  const { state } = useStore();
  const [attendance, setAttendance] = useState("Attended");
  const [recipient, setRecipient] = useState("Young person");
  const [method, setMethod] = useState(collection.channel);
  const [editingOutcome, setEditingOutcome] = useState(false);
  const headingRef = useRef(null);
  const latestDate = episode.end && episode.end < TODAY ? episode.end : TODAY;
  const contactType =
    appointment?.contactType ||
    (appointment?.appointmentType === "Care review"
      ? "Care review"
      : "Assessment");
  const practitioner =
    appointment?.primaryPractitioner ||
    appointment?.practitionerService?.split(" · ")[0] ||
    "";
  const Heading = tablet ? "h1" : "h3";
  const SectionHeading = tablet ? "h2" : "h4";

  useEffect(() => {
    headingRef.current?.closest(".form-body")?.scrollTo({ top: 0 });
    if (tablet) window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [tablet]);

  return (
    <ValidatedForm
      onSubmit={(event) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(event.currentTarget));
        const { completionMethod, ...appointmentValues } = values;
        const defaultOutcome = {
          attendance: "Attended",
          recipientType: "Young person",
          contactType,
          primaryPractitioner: practitioner,
          actualDate:
            appointment?.plannedDate <= latestDate
              ? appointment.plannedDate
              : latestDate,
          actualTime: appointment?.plannedTime,
          actualDurationMinutes: appointment?.plannedDurationMinutes,
        };
        onConfirm({
          completionMethod,
          ...(appointment
            ? {
                appointmentOutcome: {
                  appointmentId: appointment.id,
                  ...defaultOutcome,
                  ...(editingOutcome ? appointmentValues : {}),
                },
              }
            : {}),
        });
      }}
    >
      <section
        className="questionnaire-appointment-confirmation"
        aria-labelledby="appointment-confirmation-heading"
      >
        <Heading
          id="appointment-confirmation-heading"
          tabIndex={-1}
          ref={headingRef}
        >
          {appointment
            ? "Confirm completion and appointment"
            : "Confirm completion"}
        </Heading>
        <p>
          The {collection.label.toLowerCase()} answers are complete. Confirm how
          they were collected
          {appointment ? " and what happened at the linked appointment" : ""}{" "}
          before submitting.
        </p>
        {tablet && appointment && (
          <Notice>
            Pass the tablet to a clinician to confirm the appointment details.
          </Notice>
        )}
        <section
          className="questionnaire-confirmation-panel"
          aria-labelledby="collection-method-heading"
        >
          <SectionHeading id="collection-method-heading">
            Confirm collection method
          </SectionHeading>
          <p>Select how these answers were completed.</p>
          <div
            className="collection-method-cards"
            role="radiogroup"
            aria-labelledby="collection-method-heading"
          >
            {[
              ["Clinic tablet", "Tablet", "Answers entered on a clinic device"],
              [
                "Clinician entry",
                "Clinician",
                "Answers entered by the clinician",
              ],
            ].map(([value, label, description]) => (
              <label
                className={`collection-method-card ${method === value ? "selected" : ""}`}
                key={value}
              >
                <input
                  type="radio"
                  name="completionMethod"
                  value={value}
                  checked={method === value}
                  onChange={() => setMethod(value)}
                  disabled={
                    value === "Clinician entry" &&
                    currentStaff(state)?.role !== "Clinician"
                  }
                  required
                />
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
              </label>
            ))}
          </div>
        </section>
        {appointment && (
          <section
            className="questionnaire-confirmation-panel"
            aria-labelledby="linked-appointment-heading"
          >
            <div className="questionnaire-confirmation-heading">
              <SectionHeading id="linked-appointment-heading">
                Linked appointment
              </SectionHeading>
              {!editingOutcome && (
                <button
                  type="button"
                  className="inline-link"
                  onClick={() => setEditingOutcome(true)}
                >
                  Edit
                </button>
              )}
            </div>
            <dl className="appointment-outcome-plan">
              <div>
                <dt>Planned contact</dt>
                <dd>
                  {formatDate(appointment.plannedDate)} at{" "}
                  {appointment.plannedTime}
                </dd>
              </div>
              <div>
                <dt>Planned duration</dt>
                <dd>{appointment.plannedDurationMinutes} min</dd>
              </div>
              <div>
                <dt>Practitioner or service</dt>
                <dd>{appointment.practitionerService}</dd>
              </div>
              <div>
                <dt>Delivery mode</dt>
                <dd>{appointment.deliveryMode}</dd>
              </div>
              <div>
                <dt>Outcome</dt>
                <dd>
                  {attendance}
                  {!editingOutcome && " (default)"}
                </dd>
              </div>
            </dl>
          </section>
        )}
        {appointment && editingOutcome && (
          <section
            id="appointment-outcome-editor"
            className="questionnaire-confirmation-panel"
            aria-labelledby="appointment-status-heading"
          >
            <SectionHeading id="appointment-status-heading">
              Confirm what happened
            </SectionHeading>
            <Field label="Appointment status">
              <select
                name="attendance"
                value={attendance}
                onChange={(event) => setAttendance(event.target.value)}
              >
                {APPOINTMENT_ATTENDANCE.filter(
                  (value) => value !== "Planned",
                ).map((value) => (
                  <option key={value}>{value}</option>
                ))}
                <option value="Planned">Leave as planned for later</option>
              </select>
            </Field>
            {attendance === "Attended" && (
              <div className="form-grid">
                <Field label="Contact recipient">
                  <select
                    name="recipientType"
                    value={recipient}
                    onChange={(event) => setRecipient(event.target.value)}
                    required
                  >
                    <option>Young person</option>
                    <option>Related person</option>
                  </select>
                </Field>
                {recipient === "Related person" && (
                  <Field label="Related person name">
                    <input name="relatedPersonName" required />
                  </Field>
                )}
                <Field label="Direct contact type">
                  <select
                    name="contactType"
                    defaultValue={contactType}
                    required
                  >
                    {CONTACT_TYPES.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Primary practitioner">
                  <input
                    name="primaryPractitioner"
                    defaultValue={practitioner}
                    required
                  />
                </Field>
                <Field label="Actual date">
                  <input
                    name="actualDate"
                    type="date"
                    min={episode.start}
                    max={latestDate}
                    defaultValue={
                      appointment.plannedDate <= latestDate
                        ? appointment.plannedDate
                        : latestDate
                    }
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
            )}
            {attendance !== "Planned" && (
              <Field label="Outcome notes (optional)">
                <textarea name="outcomeNotes" rows="2" />
              </Field>
            )}
          </section>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="question-controls">
          <Button type="button" onClick={onBack}>
            Back to answer review
          </Button>
          <Button type="submit" variant="primary">
            {appointment
              ? "Save response and appointment outcome"
              : "Save response"}
          </Button>
        </div>
      </section>
    </ValidatedForm>
  );
}
