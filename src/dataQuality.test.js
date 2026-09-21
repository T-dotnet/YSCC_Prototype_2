import test from "node:test";
import assert from "node:assert/strict";
import {
  detectQualityFindings,
  getQualityIssues,
  recordCompleteness,
  submissionReadiness,
} from "./dataQuality.js";

const today = "2026-09-15";
const person = {
  id: "YS-TEST",
  name: "Test Person",
  dob: "2009-04-18",
  consent: "Recorded",
  owner: "Jess Taylor",
  contact: "Suitable",
  pronouns: "They/them",
  intakes: [{ status: "Completed", outcome: "Proceed" }],
  episodes: [
    {
      id: "EP-TEST",
      status: "Active",
      start: "2026-09-01",
      appointments: [],
      clinicalRecords: [],
    },
  ],
};

test("completeness separates mandatory, organisation-required and optional fields", () => {
  const result = recordCompleteness(person, today);
  assert.equal(result.groups.mandatory.percentage, 100);
  assert.equal(result.groups.organisation.percentage, 100);
  assert.equal(result.groups.optional.percentage, 50);
  assert.equal(result.requiredPercentage, 100);
});

test("live quality findings catch the required cross-record conditions", () => {
  const state = {
    people: [
      {
        ...person,
        dob: "2027-01-01",
        demographicReference: { dob: "2009-04-18", source: "Referral" },
        episodes: [
          {
            ...person.episodes[0],
            appointments: [
              {
                id: "A-1",
                plannedDate: "2026-09-10",
                plannedTime: "09:00",
                practitionerService: "Northside Centre",
              },
              {
                id: "A-2",
                plannedDate: "2026-09-10",
                plannedTime: "09:00",
                practitionerService: "Northside Centre",
              },
            ],
            clinicalRecords: [
              {
                id: "O-1",
                recordType: "outcome",
                fields: { outcomeStatus: "Complete", measureValue: null },
              },
            ],
          },
        ],
      },
    ],
  };
  const types = detectQualityFindings(state, today).map((issue) => issue.type);
  assert.ok(types.includes("Future date"));
  assert.ok(types.includes("Duplicate appointment"));
  assert.ok(types.includes("Invalid outcome measure combination"));
  assert.ok(types.includes("Inconsistent demographic information"));
});

test("a blocking unresolved issue prevents sample submission preparation", () => {
  const state = {
    people: [{ ...person, consent: "Not recorded" }],
    issues: [],
  };
  assert.equal(submissionReadiness(state, today).ready, false);
  assert.equal(
    getQualityIssues(state, today)[0].type,
    "Missing mandatory field",
  );
});
