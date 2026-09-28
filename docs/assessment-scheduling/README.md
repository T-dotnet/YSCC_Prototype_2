# Assessment due dates and cadence rules

Updated 28 September 2026. This describes the browser-local prototype, including changes after commit `1d463ba`. It records implemented behaviour separately from decisions awaiting stakeholder confirmation.

## Default configuration

New and reset sample workspaces use these defaults. Existing explicit settings remain saved; an older workspace without the due-date visibility setting receives the new On default.

| Setting | Default | Purpose |
| --- | --- | --- |
| Simple assessments | On | Compact grouped ledger and response view |
| Assessment due dates | On | Display saved due dates and select the next pending record per assessment type |
| Schedule assessments | Off | Future manual assessment scheduling and planned contact booking remain disabled |
| Link appointments and assessments | On | Select and display related service contacts |
| Assessment SMS flow | Off | Sample SMS collection controls are hidden |
| Automatic assessment due dates | Off | Create upcoming assessments from configured cadence rules when enabled |

No cadence rules are supplied by default. Admins must choose a cadence; the prototype does not prescribe a clinical interval. Enabling automatic due dates also turns on due-date visibility, without changing the appointment scheduling switch.

## Due-date display

The Assessment tab groups records by assessment type. Each group shows **Next due [date]** when a pending due date is available. A **Due today** or **Past due** alert follows the date only when applicable. Future dates have no alert. Alerts use a rectangular outline and text, with no dot, fill or rounded corners; record status badges retain their existing appearance.

In the compact ledger, expanded records show **Due date**, **Created** and **Completed**, in that order. Due alerts and individual scores are omitted from these expanded rows. The latest score remains in the group header; assessment details and the fuller view retain their own score information. A completed, paused or cancelled record is not labelled as pending overdue work.

One upcoming pending record per type is selected. Existing completed history and drafts remain available. A draft, in-progress response or Active assignment with a future due date hides the next planned record. An undated draft also hides it. When the current draft's due date is today or earlier, the next planned record may appear. Existing overdue pending records are retained rather than deleted.

Due-date visibility does not enable future contact booking. Turning it off hides the additional display/selection behaviour; it does not delete saved assessments.

## Configure automatic creation

Open **Administration → Assessment due-date rules**, or the same section under **Assessment features**.

1. Add a scheduling rule.
2. Select the assessment type and questionnaire version.
3. Select a program stream or **All program streams**.
4. Select a care level or **All care levels**.
5. Set the interval in whole weeks, from 1 to 104, and enable the rule.
6. Save the rule and turn on **Automatic assessment due dates**.

Rules can be edited, disabled or removed. Duplicate rules for the same questionnaire version, stream and care level are rejected. Removing a rule or switching automation off retains existing assessments and responses. Rule changes apply when the next record is created; existing pending assignments are not rescheduled automatically.

The current editor supports weekly intervals only. **Four weeks is 28 days, not a calendar month.** Calendar-month recurrence, patient-age/profile conditions and additional scheduling factors are not implemented.

### Matching and precedence

Matching uses the care period effective on the prototype's current date, including its program stream and care level. A future care change does not apply before its effective date.

Only one matching rule is selected per assessment type, in this order:

1. Specific program stream and specific care level.
2. Specific program stream and all care levels.
3. All program streams and specific care level.
4. All program streams and all care levels.

The stream-over-level tie-break is a prototype choice requiring stakeholder confirmation.

### Cadence anchor and creation

The cadence is anchored to the effective start date of the current care period, representing the starting care level or a care level/stream change. The first due date is one configured interval after that date. Subsequent dates remain on that cycle, rather than restarting the interval from each completion date. After completion, the next cycle follows the later of the response date and the saved due date; early completion does not recreate the same cycle.

Automatic creation runs when the workspace loads and after a successful state-changing action. It operates on active, editable care episodes with a matching effective care period. Archived people and read-only records are excluded. This is browser-local reconciliation, not a server scheduler or a background service that runs while the application is closed. Reload the workspace to refresh its current date after a day boundary.

An existing unstarted pending assignment prevents another record of the same type being created. A draft/in-progress record prevents creation while its due date is future or missing; once its due date is today or past, the next cycle can be created. Existing answers, drafts and completed records are preserved. Generated records retain the selected questionnaire version, rule identifier and care-period anchor, have no appointment automatically assigned, and do not grant booking permissions.

If the care context changes while a pending assignment exists, that assignment is retained. The new matching rule and anchor apply when the next record can be created. No historical backlog is generated in bulk; an overdue next cycle can remain visible until handled.

### Illustrative example

These intervals illustrate the interaction, not an approved clinical policy:

| Rule | Interval |
| --- | --- |
| K5 · all streams · all levels | Every 4 weeks |
| K5 · General stream · High care level | Every 1 week |

A General/High care period effective **1 October 2026** selects the second rule. Its first K5 assessment is due **8 October**, followed by the next eligible cycle on **15 October**. A General/Low care period effective on the same date selects the default rule, with the first assessment due **29 October**. Existing pending work can delay creation of the next record as described above.

## Independence from Proposed next review

The automatic cadence engine does not use the **Proposed next review** date. Changing that date does not re-anchor or alter automatic assessment cadence. For example, an assessment can remain on a four-week cycle while the proposed next review is six weeks away. Appointment booking is also separate.

This independence is the current prototype behaviour and a stated assumption awaiting stakeholder confirmation. Separate legacy review/outcome schedule controls remain distinct; they should not be treated as the automatic rule engine.

## Decisions to confirm with stakeholders

- Should assessments be created automatically from an admin-defined cadence?
- Is there one shared cadence, a cadence per assessment type, or a cadence determined by assessment type and patient/care context?
- Which factors determine eligibility and interval: program stream, care level, age, patient profile or others?
- Should recurrence use weeks, calendar months, or both?
- Should the anchor be care level/stream change, episode start, last completion or another event?
- Should a care change reschedule an existing pending assignment, or only affect the next one?
- What precedence applies when stream-only and care-level-only overrides both match?
- Should assessment cadence remain independent of **Proposed next review** and appointment booking?

The implemented care-change anchor follows the product instruction for this prototype. It does not establish stakeholder or clinical approval of cadence, requiredness, patient eligibility or completion policy.

## Implementation and verification

- `src/assessmentSchedules.js`: rule validation, effective-period matching and automatic creation.
- `src/components/AssessmentScheduleSettings.jsx`: shared Administration/Assessment features editor.
- `src/model.js` and `src/store.jsx`: saved settings, action reconciliation and load reconciliation.
- `src/assessmentDue.js`: pending dates and per-type visibility.
- `src/features/Person.jsx`, `src/components/AssessmentCollectionCard.jsx` and `src/components/CollectionDetails.jsx`: due-date presentation.

Focused automated coverage checks precedence, effective-date changes, draft blocking and release, cycle advancement, duplicate prevention, saved-record preservation and booking independence. The rule form was exercised for save/reload persistence and phone layout. Typecheck and production build passed. The separate [Storybook audit](../storybook-audit-2026-09-28/README.md) records existing accessibility findings and is a dated snapshot, not a fresh assessment of this change.

Run the focused scheduling checks with:

```sh
node --test src/assessmentSchedules.test.js src/assessmentDue.test.js src/assessmentDueExamples.test.js src/assessmentFeatures.test.js src/simpleAssessments.test.js
npm run lint
npm run build
```
