import { useState } from "react";
import { Button, Field, Modal, Notice, ValidatedForm } from "./UI";
import {
  DIAGNOSIS_STATUSES,
  MEDICATION_CHANGES,
  OUTCOME_STATUSES,
  RISK_LEVELS,
} from "../clinicalRecords";
import {
  configuredMeasures,
  outcomeNeedsMissingReason,
} from "../measureGovernance";
import { formatDate, TODAY } from "../model";

export const TIMELINE_RECORD_TYPES = [
  {
    value: "appointment",
    label: "Appointment or service contact",
    scope: "appointment",
    description: "A planned appointment or recorded service contact.",
  },
  {
    value: "outcome",
    label: "Outcome measure record",
    scope: "structured",
    description:
      "A candidate PMHC-MDS-aligned outcome measure record.",
  },
  {
    value: "risk",
    label: "Risk status record",
    scope: "structured",
    description:
      "A candidate PMHC-MDS-aligned risk status record.",
  },
  {
    value: "diagnosis",
    label: "Diagnosis record",
    scope: "structured",
    description:
      "A candidate PMHC-MDS-aligned diagnosis record.",
  },
  {
    value: "medication",
    label: "Medication chart record",
    scope: "structured",
    description:
      "A local candidate record of a prescribed medication change.",
  },
  {
    value: "care-transition",
    label: "Major care or service transition",
    scope: "contextual",
    description:
      "A step-up, step-down or other major change in care coordination, support, service or provider.",
  },
  {
    value: "indirect-activity",
    label: "Indirect service activity",
    scope: "contextual",
    description:
      "Service work completed on behalf of the person without a direct contact.",
  },
  {
    value: "harm",
    label: "Harm to self or others",
    scope: "contextual",
    description:
      "A factual contextual record. This does not replace an approved safety or risk-management record.",
  },
  {
    value: "medication-adverse",
    label: "Medication adverse event",
    scope: "contextual",
    description:
      "A contextual record of an adverse medication event, not a medication chart or prescription instruction.",
  },
  {
    value: "housing",
    label: "Housing instability or homelessness",
    scope: "contextual",
    description:
      "A contextual record of a housing change that may affect care coordination.",
  },
  {
    value: "other",
    label: "Other contextual event",
    scope: "contextual",
    description: "Another event that may help explain the care journey.",
  },
];

const formValues = (event) =>
  Object.fromEntries(new FormData(event.currentTarget));

export default function CareTimelineEntryForm({
  episode,
  event: existingEvent,
  initialType,
  error,
  onClose,
  onSave,
  onSelectAppointment,
}) {
  const isCorrection = Boolean(existingEvent);
  const [entryType, setEntryType] = useState(
    existingEvent?.eventType ||
      existingEvent?.recordType ||
      initialType ||
      "",
  );
  const [measureKey, setMeasureKey] = useState(configuredMeasures()[0].key);
  const [outcomeStatus, setOutcomeStatus] = useState("");

  const latestDate = episode.end && episode.end < TODAY ? episode.end : TODAY;
  const selectedType = TIMELINE_RECORD_TYPES.find((type) => type.value === entryType);
  const isStructured = selectedType?.scope === "structured";
  const selectedMeasure = configuredMeasures().find(
    (measure) => measure.key === measureKey,
  );

  return (
    <Modal
      title={
        isCorrection
          ? "Correct event"
          : entryType === "indirect-activity"
            ? "Record event"
            : "Add event"
      }
      subtitle={`Care period ${episode.number} · ${formatDate(episode.start)}–${episode.end ? formatDate(episode.end) : "present"}`}
      onClose={onClose}
    >
      <ValidatedForm
        onSubmit={(formEvent) => {
          formEvent.preventDefault();
          if (!selectedType) return;
          const values = formValues(formEvent);
          if (isStructured) {
            onSave({
              type: "ADD_CLINICAL_RECORD",
              recordType: entryType,
              recordDate: values.recordDate,
              ...values,
            });
          } else if (isCorrection) {
            onSave({
              type: "CORRECT_CARE_EVENT",
              eventId: existingEvent.id,
              eventType: entryType,
              eventDate: values.eventDate,
              ...values,
            });
          } else {
            onSave({
              type: "ADD_CARE_EVENT",
              eventType: entryType,
              eventDate: values.eventDate,
              ...values,
            });
          }
        }}
      >
        <div className="form-body care-event-form">
          {!selectedType ? (
            <Notice>Choose a record type to see the fields for this event.</Notice>
          ) : isStructured ? (
            <Notice>
              Candidate PMHC-MDS-aligned data structure only. It does not submit
              data, score measures, generate a safety plan or make a clinical
              decision.
            </Notice>
          ) : (
            <Notice>
              {entryType === "indirect-activity"
                ? "Record work completed for the person without a direct contact. This is saved to care history."
                : "Record contextual events only. This does not replace a safety plan, medication chart or source clinical record."}
            </Notice>
          )}

          <div className="form-grid">
            <Field label="Record type">
              <select
                name="entryType"
                value={entryType}
                onChange={(e) => {
                  if (e.target.value === "appointment") {
                    onSelectAppointment?.();
                  } else {
                    setEntryType(e.target.value);
                  }
                }}
                required
              >
                <option value="" disabled>Choose record type</option>
                {TIMELINE_RECORD_TYPES.filter((type) => !isCorrection || type.scope !== "appointment").map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </Field>

            {selectedType && (isStructured ? (
              <Field
                label="Record date"
                hint="The date recorded by the source."
              >
                <input
                  type="date"
                  name="recordDate"
                  defaultValue={latestDate}
                  min={episode.start}
                  max={latestDate}
                  required
                />
              </Field>
            ) : (
              <Field
                label="Event date"
                hint="The date the event happened."
              >
                <input
                  type="date"
                  name="eventDate"
                  defaultValue={existingEvent?.eventDate || latestDate}
                  min={episode.start}
                  max={latestDate}
                  required
                />
              </Field>
            ))}
          </div>

          {selectedType && <>
          <p className="event-type-description">{selectedType.description}</p>

          <div className="care-event-fields">
            {entryType === "risk" && (
              <>
                <Field label="Recorded risk status">
                  <select name="riskLevel" defaultValue="" required>
                    <option value="" disabled>
                      Choose status
                    </option>
                    {RISK_LEVELS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Next review date (optional)">
                  <input type="date" name="reviewDate" min={episode.start} />
                </Field>
              </>
            )}

            {entryType === "diagnosis" && (
              <>
                <Field label="Diagnosis as recorded">
                  <input name="diagnosisName" autoFocus required />
                </Field>
                <Field label="Diagnosis code (optional)">
                  <input name="diagnosisCode" />
                </Field>
                <Field label="Diagnosis status">
                  <select name="diagnosisStatus" defaultValue="" required>
                    <option value="" disabled>
                      Choose status
                    </option>
                    {DIAGNOSIS_STATUSES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}

            {entryType === "medication" && (
              <>
                <Field label="Medication name">
                  <input name="medicationName" autoFocus required />
                </Field>
                <Field label="Recorded medication change">
                  <select name="medicationChange" defaultValue="" required>
                    <option value="" disabled>
                      Choose change
                    </option>
                    {MEDICATION_CHANGES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Dose as recorded (optional)">
                  <input name="dose" placeholder="For example, 20 mg daily" />
                </Field>
              </>
            )}

            {entryType === "outcome" && (
              <>
                <Field label="Governed measure">
                  <select
                    name="measureKey"
                    value={measureKey}
                    onChange={(e) => setMeasureKey(e.target.value)}
                  >
                    {configuredMeasures().map((measure) => (
                      <option key={measure.key} value={measure.key}>
                        {measure.name} · {measure.version}
                      </option>
                    ))}
                  </select>
                </Field>
                {selectedMeasure && (
                  <div className="measure-record-rules">
                    <strong>{selectedMeasure.version}</strong>
                    <span>
                      Respondents: {selectedMeasure.respondents.join(" · ")}
                    </span>
                    <span>Timing: {selectedMeasure.timings.join(" · ")}</span>
                    <span>{selectedMeasure.scoring}</span>
                    <span>{selectedMeasure.missingData}</span>
                  </div>
                )}
                <Field label="Respondent">
                  <select
                    name="measureRespondent"
                    key={selectedMeasure?.key}
                    defaultValue=""
                    required
                  >
                    <option value="" disabled>
                      Choose respondent
                    </option>
                    {selectedMeasure?.respondents.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Collection occasion">
                  <select
                    name="collectionPoint"
                    key={selectedMeasure?.key}
                    defaultValue=""
                    required
                  >
                    <option value="" disabled>
                      Choose occasion
                    </option>
                    {selectedMeasure?.timings.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Collection status">
                  <select
                    name="outcomeStatus"
                    value={outcomeStatus}
                    onChange={(e) => setOutcomeStatus(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Choose status
                    </option>
                    {OUTCOME_STATUSES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Recorded value"
                  hint="Required only when complete; scoring is not calculated in this prototype."
                >
                  <input name="measureValue" />
                </Field>
                {outcomeNeedsMissingReason(outcomeStatus) && (
                  <Field label="Missing-data reason">
                    <textarea name="missingDataReason" rows="2" required />
                  </Field>
                )}
              </>
            )}

            {isStructured && (
              <Field
                label="Source or authority"
                hint="For example, source clinical record, treating practitioner or completed measure."
              >
                <input name="source" required />
              </Field>
            )}

            {entryType === "medication-adverse" && (
              <Field label="Medication name">
                <input
                  name="medicationName"
                  autoFocus
                  defaultValue={existingEvent?.fields?.medicationName || ""}
                  required
                />
              </Field>
            )}

            {!isStructured && (
              <Field label="Factual event summary">
                <input
                  name="summary"
                  autoFocus={entryType !== "medication-adverse"}
                  defaultValue={
                    existingEvent?.title?.replace(/^Correction: /, "") || ""
                  }
                  placeholder="Describe what happened without interpreting its cause"
                  required
                />
              </Field>
            )}

            {!isStructured && (
              <>
                <Field
                  label="Source or observer (optional)"
                  hint="For example, person, treating clinician, hospital update or documented source."
                >
                  <input
                    name="source"
                    defaultValue={existingEvent?.fields?.source || ""}
                  />
                </Field>
                <Field label="Impact on care or coordination (optional)">
                  <textarea
                    name="impact"
                    rows="3"
                    defaultValue={existingEvent?.fields?.impact || ""}
                  />
                </Field>
              </>
            )}

            <Field label="Notes (optional)">
              <textarea
                name="notes"
                rows="3"
                defaultValue={
                  !isStructured ? existingEvent?.fields?.notes || "" : ""
                }
              />
            </Field>

            {isCorrection && (
              <Field label="Reason for correction">
                <textarea name="correctionReason" rows="2" required />
              </Field>
            )}
          </div>
          </>}
        </div>

        <div className="modal-footer">
          {error && (
            <p className="field-error form-save-error" role="alert">
              {error}
            </p>
          )}
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!selectedType}>
            {isCorrection
              ? "Add correction"
              : !selectedType
                ? "Add event"
              : isStructured
                ? "Add structured record"
                : "Add contextual event"}
          </Button>
        </div>
      </ValidatedForm>
    </Modal>
  );
}
