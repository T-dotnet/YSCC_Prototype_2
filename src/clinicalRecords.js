export const CLINICAL_RECORD_TYPES = [
  {
    value: "risk",
    label: "Risk record",
    description:
      "A dated, source-attributed risk status record. It does not create a safety plan, escalation or clinical decision.",
  },
  {
    value: "diagnosis",
    label: "Diagnosis record",
    description:
      "A dated diagnosis record with its recorded status and source. The prototype does not infer or validate a diagnosis.",
  },
  {
    value: "medication",
    label: "Medication record",
    description:
      "A local medication-chart record. It is not a prescription, administration record or medication decision-support tool.",
  },
  {
    value: "outcome",
    label: "Outcome record",
    description:
      "A dated outcome-measure collection record. It retains the reported value without scoring or interpreting it.",
  },
];

export const RISK_LEVELS = [
  "No risk identified",
  "Low",
  "Moderate",
  "High",
  "Unable to determine",
];

export const DIAGNOSIS_STATUSES = ["Provisional", "Confirmed", "Historical"];
export const MEDICATION_CHANGES = [
  "Started",
  "Stopped",
  "Dose changed",
  "Reviewed",
  "Other recorded change",
];
export { OUTCOME_STATUSES } from "./measureGovernance.js";
import {
  OUTCOME_STATUSES,
  configuredMeasure,
  outcomeNeedsMissingReason,
} from "./measureGovernance.js";

const validDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
  Number.isFinite(new Date(`${value}T12:00:00`).getTime()) &&
  new Date(`${value}T12:00:00`).toISOString().slice(0, 10) === value;

const clean = (value) => value?.trim() || null;

export const clinicalRecordType = (value) =>
  CLINICAL_RECORD_TYPES.find((type) => type.value === value);

export function clinicalRecordError(episode, action, today) {
  if (!episode) return "The selected care period is unavailable.";
  if (!clinicalRecordType(action.recordType)) return "Choose a record type.";
  if (!validDate(action.recordDate)) return "Enter a valid record date.";
  if (action.recordDate < episode.start)
    return "The record date must be within this care period.";
  const latestDate = episode.end && episode.end < today ? episode.end : today;
  if (action.recordDate > latestDate)
    return "The record date cannot be after this care period or in the future.";
  if (!action.source?.trim()) return "Enter the source or authority for this record.";

  if (action.recordType === "risk" && !RISK_LEVELS.includes(action.riskLevel))
    return "Choose the recorded risk status.";
  if (action.recordType === "diagnosis") {
    if (!action.diagnosisName?.trim()) return "Enter the diagnosis as recorded.";
    if (!DIAGNOSIS_STATUSES.includes(action.diagnosisStatus))
      return "Choose the diagnosis status.";
  }
  if (action.recordType === "medication") {
    if (!action.medicationName?.trim()) return "Enter the medication name.";
    if (!MEDICATION_CHANGES.includes(action.medicationChange))
      return "Choose the recorded medication change.";
  }
  if (action.recordType === "outcome") {
    const measure = configuredMeasure(action.measureKey);
    if (!measure) return "Choose a configured measure from the governed set.";
    if (!measure.respondents.includes(action.measureRespondent))
      return "Choose an eligible respondent for this measure.";
    if (!measure.timings.includes(action.collectionPoint))
      return "Choose an allowed collection occasion for this measure.";
    if (!OUTCOME_STATUSES.includes(action.outcomeStatus))
      return "Choose the collection status.";
    if (action.outcomeStatus === "Complete" && !action.measureValue?.trim())
      return "Enter the recorded measure value or mark it incomplete.";
    if (
      outcomeNeedsMissingReason(action.outcomeStatus) &&
      !action.missingDataReason?.trim()
    )
      return "Explain why the measure is incomplete or missing.";
  }
  return null;
}

export function clinicalRecordContent(action) {
  const common = {
    source: action.source.trim(),
    notes: clean(action.notes),
  };
  if (action.recordType === "risk")
    return {
      title: `Risk status: ${action.riskLevel}`,
      detail: `Recorded risk status · ${action.source.trim()}`,
      fields: {
        ...common,
        riskLevel: action.riskLevel,
        reviewDate: clean(action.reviewDate),
      },
    };
  if (action.recordType === "diagnosis")
    return {
      title: action.diagnosisName.trim(),
      detail: `${action.diagnosisStatus} diagnosis · ${action.source.trim()}`,
      fields: {
        ...common,
        diagnosisName: action.diagnosisName.trim(),
        diagnosisCode: clean(action.diagnosisCode),
        diagnosisStatus: action.diagnosisStatus,
      },
    };
  if (action.recordType === "medication")
    return {
      title: `${action.medicationName.trim()} · ${action.medicationChange}`,
      detail: `Medication record · ${action.source.trim()}`,
      fields: {
        ...common,
        medicationName: action.medicationName.trim(),
        medicationChange: action.medicationChange,
        dose: clean(action.dose),
      },
    };
  const measure = configuredMeasure(action.measureKey);
  return {
    title: measure.name,
    detail: `${action.collectionPoint} · ${action.outcomeStatus} · ${action.source.trim()}`,
    fields: {
      ...common,
      measureKey: measure.key,
      measureName: measure.name,
      measureVersion: measure.version,
      measureRespondent: action.measureRespondent,
      collectionPoint: action.collectionPoint,
      outcomeStatus: action.outcomeStatus,
      measureValue: clean(action.measureValue),
      missingDataReason: clean(action.missingDataReason),
      scoringRule: measure.scoring,
      missingDataRule: measure.missingData,
    },
  };
}

export function clinicalRecordDetails(record) {
  const fields = record.fields ?? {};
  const specific = {
    risk: [
      ["Recorded risk status", fields.riskLevel],
      ["Review date", fields.reviewDate],
    ],
    diagnosis: [
      ["Diagnosis", fields.diagnosisName],
      ["Code", fields.diagnosisCode],
      ["Status", fields.diagnosisStatus],
    ],
    medication: [
      ["Medication", fields.medicationName],
      ["Recorded change", fields.medicationChange],
      ["Dose as recorded", fields.dose],
    ],
    outcome: [
      ["Measure", fields.measureName],
      ["Pinned version", fields.measureVersion],
      ["Respondent", fields.measureRespondent],
      ["Collection occasion", fields.collectionPoint],
      ["Collection status", fields.outcomeStatus],
      ["Recorded value", fields.measureValue],
      ["Missing-data reason", fields.missingDataReason],
      ["Scoring rule", fields.scoringRule],
      ["Missing-data rule", fields.missingDataRule],
    ],
  };
  return [
    ...(specific[record.recordType] ?? []),
    ["Source or authority", fields.source],
    ["Notes", fields.notes],
  ].filter(([, value]) => value);
}

export function clinicalRecordChanges(record) {
  return clinicalRecordDetails(record).map(([label, after]) => ({
    key: label.toLowerCase().replaceAll(" ", "-"),
    label,
    before: null,
    after,
  }));
}

export function recordedClinicalRecords(episode) {
  return (episode?.clinicalRecords ?? []).toSorted(
    (a, b) =>
      (b.recordDate || "").localeCompare(a.recordDate || "") ||
      (b.timestamp || "").localeCompare(a.timestamp || ""),
  );
}
