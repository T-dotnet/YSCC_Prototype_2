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
import { prototypeScoreRange } from "../outcomeMeasures";

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
    label: "Medication",
    scope: "structured",
    description:
      "Record a documented medication change, course or adverse event in one form.",
  },
  {
    value: "medication-course",
    label: "Medication course",
    scope: "contextual",
    description: "Record the documented start and end of a medication course for the Report timeline.",
  },
  {
    value: "service-period",
    label: "Care setting or service period",
    scope: "contextual",
    description: "Record a dated period of care setting, service or support intensity.",
  },
  {
    value: "goal-milestone",
    label: "Goal milestone",
    scope: "contextual",
    description: "Record a dated, sourced update to a care goal.",
  },
  {
    value: "care-transition",
    label: "Care or service change",
    scope: "contextual",
    description:
      "Record a change in care or service, with period dates when a service duration is documented.",
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

export const NEW_RECORD_TYPES = [
  "appointment",
  "outcome",
  "risk",
  "harm",
  "medication",
  "goal-milestone",
  "housing",
  "care-transition",
];
export const recordCategoryLabel = (value) =>
  TIMELINE_RECORD_TYPES.find((type) => type.value === value)?.label;

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
    existingEvent?.eventType || existingEvent?.recordType || initialType || "",
  );
  const [measureKey, setMeasureKey] = useState(configuredMeasures()[0].key);
  const [outcomeStatus, setOutcomeStatus] = useState("");
  const externalSlot = existingEvent?.fields?.externalAppointment || null;

  const latestDate = episode.end && episode.end < TODAY ? episode.end : TODAY;
  const selectedType = TIMELINE_RECORD_TYPES.find((type) => type.value === entryType);
  const isDedicatedType = Boolean(initialType && !NEW_RECORD_TYPES.includes(initialType));
  const isUnlistedType = Boolean(entryType && !NEW_RECORD_TYPES.includes(entryType));
  const isStructured = selectedType?.scope === "structured";
  const isReportEvent = ["medication-course", "service-period", "goal-milestone"].includes(entryType);
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
              externalAppointment: externalSlot,
              ...values,
            });
          } else if (isCorrection) {
            onSave({
              type: "CORRECT_CARE_EVENT",
              eventId: existingEvent.id,
              eventType: entryType,
              eventDate: values.eventDate,
              externalAppointment: externalSlot,
              ...values,
            });
          } else {
            onSave({
              type: "ADD_CARE_EVENT",
              eventType: entryType,
              eventDate: values.eventDate,
              externalAppointment: externalSlot,
              ...values,
            });
          }
        }}
      >
        <div className="form-body care-event-form">
          {!selectedType ? (
            <Notice>Choose a record category to see its fields.</Notice>
          ) : isStructured ? (
            <Notice>
              {entryType === "medication"
                ? "Record only medication facts supported by the source. This is not a prescription, medication chart or clinical decision."
                : "Candidate PMHC-MDS-aligned data structure only. It does not submit data, score measures, generate a safety plan or make a clinical decision."}
            </Notice>
          ) : (
            <Notice>
              {entryType === "indirect-activity"
                ? "Record work completed for the person without a direct contact. This is saved to care history."
                : isReportEvent
                  ? "Record a dated source item for the Report. This does not replace the source clinical record."
                  : "Record contextual events only. This does not replace a safety plan, medication chart or source clinical record."}
            </Notice>
          )}

          <Field label="Record category">
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
              disabled={isCorrection || isDedicatedType}
              required
            >
              <option value="" disabled>Choose category</option>
              {NEW_RECORD_TYPES.filter((type) => !isCorrection || type !== "appointment").map((type) => (
                <option key={type} value={type}>{recordCategoryLabel(type)}</option>
              ))}
              {isUnlistedType && (
                <option value={entryType}>{selectedType?.label || existingEvent?.title || "Original event type"}</option>
              )}
            </select>
          </Field>

          {selectedType && (
            <p className="event-type-description">{selectedType.description}</p>
          )}

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
              label={entryType === "goal-milestone" ? "Milestone date" : ["medication-course", "service-period"].includes(entryType) ? "Start date" : entryType === "care-transition" ? "Change or period start date" : "Event date"}
              hint={entryType === "goal-milestone" ? "The date this goal status was recorded." : ["medication-course", "service-period"].includes(entryType) ? "The documented start of this period." : entryType === "care-transition" ? "The date the change happened or the documented period began." : "The date the event happened."}
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

          {selectedType && <>
          <div className="care-event-fields">
            {entryType === "medication-course" && <>
              <Field label="Medication or course name">
                <input name="courseName" defaultValue={existingEvent?.title || ""} autoFocus required />
              </Field>
              <Field label="End date" hint="A completed course needs a documented end date.">
                <input type="date" name="endDate" defaultValue={existingEvent?.fields?.endDate || ""} min={episode.start} max={latestDate} required />
              </Field>
              <Field label="Source status">
                <select name="reportStatus" defaultValue={existingEvent?.fields?.status || "Start and end recorded"} required>
                  <option>Start and end recorded</option>
                  <option>Completed</option>
                  <option>Stopped early</option>
                </select>
              </Field>
            </>}

            {entryType === "service-period" && <>
              <Field label="Care setting or service">
                <input name="periodName" defaultValue={existingEvent?.title || ""} autoFocus required />
              </Field>
              <Field label="End date (optional)" hint="Leave blank when only the start is documented.">
                <input type="date" name="endDate" defaultValue={existingEvent?.fields?.endDate || ""} min={episode.start} max={latestDate} />
              </Field>
              <Field label="Source status">
                <select name="reportStatus" defaultValue={existingEvent?.fields?.status || "Started"} required>
                  <option>Planned</option>
                  <option>Started</option>
                  <option>Delivered</option>
                  <option>Ended</option>
                </select>
              </Field>
            </>}

            {entryType === "care-transition" && <>
              <Field label="Service or care period name (optional)" hint="Complete this only when the change starts a documented service or care period.">
                <input name="periodName" defaultValue={existingEvent?.fields?.periodName || ""} />
              </Field>
              <Field label="Period end date (optional)" hint="Leave blank when the period is ongoing or only its start is known.">
                <input type="date" name="endDate" defaultValue={existingEvent?.fields?.endDate || ""} min={episode.start} max={latestDate} />
              </Field>
              <Field label="Period status (optional)">
                <select name="reportStatus" defaultValue={existingEvent?.fields?.status || ""}>
                  <option value="">Not recorded</option>
                  <option>Planned</option>
                  <option>Started</option>
                  <option>Delivered</option>
                  <option>Ended</option>
                </select>
              </Field>
            </>}

            {entryType === "goal-milestone" && <>
              <Field label="Goal">
                <input name="goalTitle" defaultValue={existingEvent?.title || ""} autoFocus required />
              </Field>
              <Field label="Milestone status">
                <select name="reportStatus" defaultValue={existingEvent?.fields?.status || "Started"} required>
                  <option>Started</option>
                  <option>Reviewed</option>
                  <option>Progressed</option>
                  <option>Achieved</option>
                  <option>Paused</option>
                  <option>Stopped</option>
                </select>
              </Field>
            </>}
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
                <Field label="Recorded change (optional)" hint="Complete when the source records a start, stop, dose change or review.">
                  <select name="medicationChange" defaultValue="">
                    <option value="">No change recorded</option>
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
                <Field label="Course start date (optional)" hint="A documented course appears as a period in Report when both dates are known.">
                  <input type="date" name="courseStartDate" min={episode.start} max={latestDate} />
                </Field>
                <Field label="Course end date (optional)">
                  <input type="date" name="courseEndDate" min={episode.start} max={latestDate} />
                </Field>
                <Field label="Course status (optional)">
                  <select name="courseStatus" defaultValue="">
                    <option value="">Not recorded</option>
                    <option>Started</option>
                    <option>Start and end recorded</option>
                    <option>Completed</option>
                    <option>Stopped early</option>
                  </select>
                </Field>
                <Field label="Adverse event (optional)" hint="Describe what was observed without assigning a cause.">
                  <textarea name="adverseEvent" rows="2" />
                </Field>
                <Field label="Adverse event date (optional)" hint="If different from the record date, enter when the event happened.">
                  <input type="date" name="adverseEventDate" min={episode.start} max={latestDate} />
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
                  <input name="measureValue" type="number" step="any"
                    min={prototypeScoreRange(measureKey)?.[0]}
                    max={prototypeScoreRange(measureKey)?.[1]} />
                </Field>
                {outcomeNeedsMissingReason(outcomeStatus) && (
                  <Field label="Missing-data reason">
                    <textarea name="missingDataReason" rows="2" required />
                  </Field>
                )}
              </>
            )}

            {isStructured && (
              <>
                <Field
                  label="Source or authority"
                  hint="For example, source clinical record, treating practitioner or completed measure."
                >
                  <input name="source" required />
                </Field>
                <Field label="Impact on care or coordination (optional)" hint="Record an observed change or follow-up only if it is documented by the source.">
                  <textarea name="impact" rows="3" />
                </Field>
              </>
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

            {!isStructured && !isReportEvent && (
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
                  label={isReportEvent || entryType === "care-transition" ? "Source or authority" : "Source or observer (optional)"}
                  hint="For example, person, treating clinician, hospital update or documented source."
                >
                  <input
                    name="source"
                    defaultValue={existingEvent?.fields?.source || ""}
                    required={isReportEvent || entryType === "care-transition"}
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

            <Field
              label={isStructured || isReportEvent ? "Supporting notes (optional)" : "Factual description"}
              hint={!isStructured ? "Describe what happened and any known outcome. Keep interpretation separate from the facts." : undefined}
            >
              <textarea
                name="notes"
                rows="3"
                defaultValue={
                  !isStructured ? existingEvent?.fields?.notes || "" : ""
                }
                required={!isStructured && !isReportEvent && NEW_RECORD_TYPES.includes(entryType)}
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
                ? entryType === "medication" ? "Add medication record" : "Add structured record"
                : isReportEvent
                  ? "Add report source record"
                  : "Add contextual event"}
          </Button>
        </div>
      </ValidatedForm>
    </Modal>
  );
}
