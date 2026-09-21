const STANDARD_TIMING = ["Baseline", "Review", "Discharge"];

// This is a governed catalogue, not a copy of licensed questionnaires.
// Programme-level approval, licensing and exact version pinning remain required.
export const GOVERNED_MEASURES = [
  {
    key: "k10-plus",
    name: "Kessler 10+ (K10+)",
    version: "PMHC-MDS K10+ current",
    status: "Configured PMHC-MDS reference",
    recordable: true,
    respondents: ["Person"],
    timings: STANDARD_TIMING,
    scoring: "PMHC-MDS K10+ scoring rule; store item-level data before a total.",
    missingData: "One missing item may be prorated; more than one makes the total missing.",
  },
  {
    key: "k5",
    name: "Kessler 5 (K5)",
    version: "PMHC-MDS K5 current",
    status: "Configured PMHC-MDS reference",
    recordable: true,
    respondents: ["Person"],
    timings: STANDARD_TIMING,
    scoring: "PMHC-MDS K5 total score rule.",
    missingData: "Any missing item makes the total missing.",
  },
  {
    key: "sdq",
    name: "Strengths and Difficulties Questionnaire (SDQ)",
    version: "PC101/PC202 · PY101/PY201 · YR101/YR201",
    status: "Configured PMHC-MDS reference",
    recordable: true,
    respondents: ["Parent/carer", "Young person (11–17)"],
    timings: STANDARD_TIMING,
    scoring: "Use the licensed, version-specific PMHC-MDS SDQ scoring rules.",
    missingData: "Use the instrument rule; insufficient completed items produce missing summary scores.",
  },
  {
    key: "sidas",
    name: "Suicidal Ideation Attributes Scale (SIDAS)",
    version: "PMHC-MDS SIDAS current",
    status: "Configured PMHC-MDS reference",
    recordable: true,
    respondents: ["Person"],
    timings: STANDARD_TIMING,
    scoring: "Use the approved five-item scoring rule; do not infer clinical action from the total.",
    missingData: "Any incomplete required item makes the total missing.",
  },
  {
    key: "who-5",
    name: "WHO-5 Well-Being Index",
    version: "PMHC-MDS WHO-5 current",
    status: "Configured PMHC-MDS reference",
    recordable: true,
    respondents: ["Person"],
    timings: STANDARD_TIMING,
    scoring: "Use the approved WHO-5 scoring method for the pinned version.",
    missingData: "Store the collection status and missing-data reason; do not calculate an incomplete score.",
  },
  {
    key: "iar-dst",
    name: "IAR-DST",
    version: "Version and scoring method to be confirmed",
    status: "Prototype visualisation fixture — not enabled",
    recordable: false,
    respondents: ["To be approved"],
    timings: STANDARD_TIMING,
    scoring: "Version, scoring method and interpretation rules must be approved before use.",
    missingData: "Missing-data rule must be approved before use.",
  },
];

export const configuredMeasures = () =>
  GOVERNED_MEASURES.filter((measure) => measure.recordable);

export const governedMeasure = (key) =>
  GOVERNED_MEASURES.find((measure) => measure.key === key) || null;

export const configuredMeasure = (key) => {
  const measure = governedMeasure(key);
  return measure?.recordable ? measure : null;
};

export const MISSING_OUTCOME_STATUSES = [
  "Incomplete — follow-up required",
  "Not collected — person declined",
  "Not collected — unavailable",
  "Not applicable",
  "Recorded missing",
];

export const OUTCOME_STATUSES = ["Complete", ...MISSING_OUTCOME_STATUSES];

export const outcomeNeedsMissingReason = (status) =>
  MISSING_OUTCOME_STATUSES.includes(status) && status !== "Not applicable";
