// The field map below is deliberately a sample implementation. It gives the
// prototype a transparent quality contract without claiming to be the current
// PMHC-MDS specification or an approved submission schema.
export const QUALITY_STATUSES = [
  "Open",
  "In Progress",
  "Awaiting Information",
  "Resolved",
  "Closed",
];

export const QUALITY_SEVERITIES = ["Critical", "High", "Medium", "Low"];

export const QUALITY_REQUIREMENT_GROUPS = [
  {
    key: "mandatory",
    label: "Mandatory PMHC-MDS fields",
    description: "Required before this sample submission can be prepared.",
  },
  {
    key: "organisation",
    label: "Organisation-required fields",
    description:
      "Required by Northside Centre for accountable local follow-up.",
  },
  {
    key: "optional",
    label: "Optional fields",
    description: "Useful context that never blocks sample submission.",
  },
];

export const validISODate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
  Number.isFinite(new Date(`${value}T12:00:00`).getTime()) &&
  new Date(`${value}T12:00:00`).toISOString().slice(0, 10) === value;

const nonEmpty = (value) => Boolean(value?.trim?.());
const activeEpisode = (person) =>
  person.episodes?.find((episode) => episode.status === "Active") || null;
const completedIntake = (person) =>
  person.intakes?.some(
    (intake) => intake.status === "Completed" && intake.outcome === "Proceed",
  );

const RULES = [
  {
    key: "name",
    group: "mandatory",
    label: "Client name",
    workflow: "Person details",
    complete: (person) => nonEmpty(person.name),
  },
  {
    key: "dob",
    group: "mandatory",
    label: "Date of birth",
    workflow: "Person details",
    complete: (person, today) =>
      validISODate(person.dob) && person.dob <= today,
  },
  {
    key: "consent",
    group: "mandatory",
    label: "Assessment consent status",
    workflow: "Consent & respondents",
    complete: (person) => person.consent === "Recorded",
  },
  {
    key: "intake-outcome",
    group: "mandatory",
    label: "Intake outcome",
    workflow: "Intake",
    applicable: (person) => Boolean(person.episodes?.length),
    complete: (person) => completedIntake(person),
  },
  {
    key: "episode-start",
    group: "mandatory",
    label: "Care episode start date",
    workflow: "Overview",
    applicable: (person) => Boolean(person.episodes?.length),
    complete: (person, today) => {
      const episode = activeEpisode(person) || person.episodes?.[0];
      return validISODate(episode?.start) && episode.start <= today;
    },
  },
  {
    key: "owner",
    group: "organisation",
    label: "Accountable care owner",
    workflow: "Overview",
    complete: (person) => nonEmpty(person.owner),
  },
  {
    key: "contact-status",
    group: "organisation",
    label: "Contact suitability",
    workflow: "Person details",
    complete: (person) =>
      nonEmpty(person.contact) && person.contact !== "Not yet assessed",
  },
  {
    key: "pronouns",
    group: "optional",
    label: "Pronouns",
    workflow: "Person details",
    complete: (person) => nonEmpty(person.pronouns),
  },
  {
    key: "family-contact",
    group: "optional",
    label: "Family or carer contact",
    workflow: "Consent & respondents",
    complete: (person) => nonEmpty(person.family),
  },
];

export function recordCompleteness(person, today) {
  const entries = RULES.filter(
    (rule) => rule.applicable?.(person) !== false,
  ).map((rule) => ({ ...rule, complete: rule.complete(person, today) }));
  const groups = Object.fromEntries(
    QUALITY_REQUIREMENT_GROUPS.map(({ key }) => {
      const values = entries.filter((entry) => entry.group === key);
      const completed = values.filter((entry) => entry.complete).length;
      return [
        key,
        {
          total: values.length,
          completed,
          missing: values.filter((entry) => !entry.complete),
          percentage: values.length
            ? Math.round((completed / values.length) * 100)
            : 100,
        },
      ];
    }),
  );
  const required = [
    ...groups.mandatory.missing,
    ...groups.organisation.missing,
  ];
  const requiredTotal = groups.mandatory.total + groups.organisation.total;
  const requiredCompleted =
    groups.mandatory.completed + groups.organisation.completed;
  return {
    entries,
    groups,
    required,
    requiredPercentage: requiredTotal
      ? Math.round((requiredCompleted / requiredTotal) * 100)
      : 100,
    mandatoryComplete: groups.mandatory.missing.length === 0,
  };
}

const finding = (person, values) => ({
  id: `RULE-${person.id}-${values.ruleKey}`,
  personId: person.id,
  organisation: "Northside Centre",
  submissionPeriod: "Sep 2026",
  status: "Open",
  owner: person.owner || "Unassigned",
  detectedAt: "2026-09-15T09:00:00Z",
  lastUpdated: "2026-09-15T09:00:00Z",
  history: [],
  source: "rule",
  ...values,
});

const openReferral = (referral) =>
  ![
    "Resolved handover",
    "Resolved alternative",
    "Cancelled with plan",
  ].includes(referral.handover);

export function detectQualityFindings(state, today) {
  const findings = [];
  for (const person of state.people) {
    const completeness = recordCompleteness(person, today);
    for (const missing of completeness.groups.mandatory.missing) {
      if (
        (missing.key === "dob" && person.dob) ||
        (missing.key === "episode-start" && person.episodes?.[0]?.start)
      )
        continue;
      const workflow =
        missing.key === "consent" && !person.episodes?.length
          ? "Intake"
          : missing.workflow;
      findings.push(
        finding(person, {
          ruleKey: `missing-${missing.key}`,
          severity: "High",
          type: "Missing mandatory field",
          title: `${missing.label} is missing`,
          description: `${missing.label} is required before a sample PMHC-MDS submission can be prepared.`,
          remediation: `Open ${workflow} and record the required information.`,
          workflow,
          blocking: true,
        }),
      );
    }
    for (const missing of completeness.groups.organisation.missing) {
      findings.push(
        finding(person, {
          ruleKey: `missing-${missing.key}`,
          severity: "Medium",
          type: "Missing organisation-required field",
          title: `${missing.label} needs confirmation`,
          description: `${missing.label} is required by the Northside Centre sample rule set for accountable follow-up.`,
          remediation: `Open ${missing.workflow} and record or confirm this information.`,
          workflow: missing.workflow,
          blocking: false,
        }),
      );
    }

    if (person.dob && !validISODate(person.dob)) {
      findings.push(
        finding(person, {
          ruleKey: "invalid-dob",
          severity: "High",
          type: "Invalid date",
          title: "Date of birth is not a valid date",
          description: "The date of birth cannot be read as a calendar date.",
          remediation:
            "Check the verified source and correct the date of birth.",
          workflow: "Person details",
          blocking: true,
        }),
      );
    } else if (person.dob && person.dob > today) {
      findings.push(
        finding(person, {
          ruleKey: "future-dob",
          severity: "High",
          type: "Future date",
          title: "Date of birth is in the future",
          description:
            "Date of birth cannot be after the sample reporting date.",
          remediation:
            "Check the verified source and correct the date of birth.",
          workflow: "Person details",
          blocking: true,
        }),
      );
    }

    if (
      person.demographicReference?.dob &&
      person.dob &&
      person.demographicReference.dob !== person.dob
    ) {
      findings.push(
        finding(person, {
          ruleKey: "demographic-reference-dob",
          severity: "High",
          type: "Inconsistent demographic information",
          title: "Date of birth differs from the verified reference",
          description: `The person record and ${person.demographicReference.source || "the verified reference"} contain different dates of birth.`,
          remediation:
            "Compare the verified source with the person record, then retain the correction rationale.",
          workflow: "Person details",
          blocking: true,
        }),
      );
    }

    if (
      person.contactReference?.status &&
      person.contact &&
      person.contactReference.status !== person.contact
    ) {
      findings.push(
        finding(person, {
          ruleKey: "contact-suitability",
          severity: "Medium",
          type: "Inconsistent demographic information",
          title: "Contact suitability differs from the verified reference",
          description: `The person record and ${person.contactReference.source || "the reference"} describe different contact suitability.`,
          remediation:
            "Confirm the current contact arrangement with the care team and retain the source checked.",
          workflow: "Person details",
          blocking: false,
        }),
      );
    }

    for (const episode of person.episodes || []) {
      if (episode.start && !validISODate(episode.start)) {
        findings.push(
          finding(person, {
            ruleKey: `invalid-episode-start-${episode.id}`,
            severity: "High",
            type: "Invalid date",
            title: "Care episode start date is not a valid date",
            description:
              "The care episode start date cannot be read as a calendar date.",
            remediation:
              "Check the verified source and correct the care episode start date.",
            workflow: "Overview",
            blocking: true,
          }),
        );
      } else if (episode.start && episode.start > today) {
        findings.push(
          finding(person, {
            ruleKey: `future-episode-start-${episode.id}`,
            severity: "High",
            type: "Future date",
            title: "Care episode start date is in the future",
            description:
              "A care episode cannot start after the sample reporting date.",
            remediation:
              "Check the verified source and correct the care episode start date.",
            workflow: "Overview",
            blocking: true,
          }),
        );
      }
      const appointments = episode.appointments || [];
      const duplicates = new Map();
      for (const appointment of appointments) {
        const key = [
          appointment.plannedDate,
          appointment.plannedTime,
          appointment.practitionerService,
        ].join("|");
        duplicates.set(key, [...(duplicates.get(key) || []), appointment]);
        if (appointment.actualDate && !validISODate(appointment.actualDate)) {
          findings.push(
            finding(person, {
              ruleKey: `invalid-appointment-${appointment.id}`,
              severity: "High",
              type: "Invalid date",
              title: "Actual appointment date is not a valid date",
              description:
                "The actual appointment date cannot be read as a calendar date.",
              remediation:
                "Check the source record, then correct the actual appointment date.",
              workflow: "Appointments",
              blocking: true,
            }),
          );
        } else if (appointment.actualDate && appointment.actualDate > today) {
          findings.push(
            finding(person, {
              ruleKey: `future-appointment-${appointment.id}`,
              severity: "High",
              type: "Future date",
              title: "Actual appointment date is in the future",
              description:
                "An attended contact cannot have an actual date after the sample reporting date.",
              remediation:
                "Check the source record, then correct the actual appointment date.",
              workflow: "Appointments",
              blocking: true,
            }),
          );
        }
      }
      for (const [key, matches] of duplicates) {
        if (matches.length < 2) continue;
        findings.push(
          finding(person, {
            ruleKey: `duplicate-appointment-${key}`,
            severity: "High",
            type: "Duplicate appointment",
            title: "Possible duplicate appointment",
            description: `${matches.length} contacts share the same planned date, time and practitioner or service.`,
            remediation:
              "Check whether the contacts represent one event; retain a correction rather than silently deleting a record.",
            workflow: "Appointments",
            blocking: true,
          }),
        );
      }

      for (const record of episode.clinicalRecords || []) {
        if (record.recordDate && !validISODate(record.recordDate)) {
          findings.push(
            finding(person, {
              ruleKey: `invalid-clinical-record-date-${record.id}`,
              severity: "High",
              type: "Invalid date",
              title: "Structured record date is not a valid date",
              description:
                "The structured record date cannot be read as a calendar date.",
              remediation:
                "Check the source record, then correct the recorded date.",
              workflow: "Appointments",
              blocking: true,
            }),
          );
        } else if (record.recordDate && record.recordDate > today) {
          findings.push(
            finding(person, {
              ruleKey: `future-clinical-record-date-${record.id}`,
              severity: "High",
              type: "Future date",
              title: "Structured record date is in the future",
              description:
                "The structured record date cannot be after the sample reporting date.",
              remediation:
                "Check the source record, then correct the recorded date.",
              workflow: "Appointments",
              blocking: true,
            }),
          );
        }
        if (record.recordType !== "outcome") continue;
        const fields = record.fields || {};
        const invalidCombination =
          (fields.outcomeStatus === "Complete" && !fields.measureValue) ||
          (fields.outcomeStatus !== "Complete" && fields.measureValue);
        if (!invalidCombination) continue;
        findings.push(
          finding(person, {
            ruleKey: `outcome-combination-${record.id}`,
            severity: "High",
            type: "Invalid outcome measure combination",
            title: "Outcome status and recorded value do not agree",
            description:
              "A complete outcome needs a recorded value; an incomplete outcome cannot retain one as a completed value.",
            remediation:
              "Correct the recorded outcome status or value and retain the source of the correction.",
            workflow: "Appointments",
            blocking: true,
          }),
        );
      }

      if (episode.status === "Closed") {
        for (const referral of person.referrals || []) {
          if (referral.episodeId !== episode.id || !openReferral(referral))
            continue;
          findings.push(
            finding(person, {
              ruleKey: `referral-discharge-${referral.id}`,
              severity: "High",
              type: "Invalid referral/discharge sequence",
              title: "Care period closed before referral reconciliation",
              description:
                "The care period is closed while its linked referral has no resolved handover or alternative plan.",
              remediation:
                "Record the receiving-service outcome or an approved alternative plan before closing reconciliation.",
              workflow: "Referrals",
              blocking: true,
            }),
          );
        }
      }
    }
  }
  return findings;
}

const normaliseIssue = (issue, person) => ({
  ...issue,
  organisation: issue.organisation || "Northside Centre",
  submissionPeriod: issue.submissionPeriod || "Sep 2026",
  severity: issue.severity || "Medium",
  type: issue.type || "Data quality review",
  description: issue.description || issue.detail,
  remediation:
    issue.remediation ||
    issue.nextStep ||
    "Review the source and record the next action.",
  workflow: issue.workflow || "Person details",
  owner: issue.owner || person?.owner || "Unassigned",
  detectedAt: issue.detectedAt || "2026-09-15T09:00:00Z",
  lastUpdated: issue.lastUpdated || issue.detectedAt || "2026-09-15T09:00:00Z",
  history: issue.history || [],
  source: "workflow",
  blocking: issue.blocking ?? true,
});

export function getQualityIssues(state, today) {
  const manual = (state.issues || []).map((issue) =>
    normaliseIssue(
      issue,
      state.people.find((person) => person.id === issue.personId),
    ),
  );
  const manualKeys = new Set(
    manual.map((issue) => issue.ruleKey).filter(Boolean),
  );
  const detected = detectQualityFindings(state, today).filter(
    (issue) => !manualKeys.has(issue.ruleKey),
  );
  return [...manual, ...detected]
    .map((issue) => {
      const workflow = state.qualityIssueWorkflow?.[issue.id];
      return workflow ? { ...issue, ...workflow, source: issue.source } : issue;
    })
    .toSorted(
      (a, b) =>
        QUALITY_SEVERITIES.indexOf(a.severity) -
          QUALITY_SEVERITIES.indexOf(b.severity) ||
        a.detectedAt.localeCompare(b.detectedAt) ||
        a.id.localeCompare(b.id),
    );
}

export function submissionReadiness(state, today) {
  const issues = getQualityIssues(state, today);
  const blockers = issues.filter(
    (issue) => issue.blocking && !["Resolved", "Closed"].includes(issue.status),
  );
  return {
    issues,
    blockers,
    ready: blockers.length === 0,
    people: state.people.map((person) => ({
      person,
      completeness: recordCompleteness(person, today),
    })),
  };
}
