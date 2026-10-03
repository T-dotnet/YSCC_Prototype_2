# Code consolidation audit — 3 October 2026

## Scope and current checks

This pass covers test reliability, workflow module boundaries, loading, date refresh, and browser storage. The working tree also contains unrelated changes made during this pass; they are outside this audit.

| Check | Before this pass | Current result |
| --- | ---: | ---: |
| Node tests (`node --test src/*.test.js`) | 301 pass / 176 fail (477 tests) | 355 pass / 124 fail (479 tests) |
| Bundle timing and validation tests | 2 pass / 24 fail | 26 pass / 0 fail |
| Bundle UI tests | 3 pass / 13 fail | 16 pass / 0 fail |
| Type check (`npm run lint`) | Passed | Passed |
| Production build (`npm run build`) | One 1,513 kB main JavaScript chunk | Split into route chunks; build passes |

The full-suite counts include other edits made in the same checkout, so they are a status snapshot rather than an isolated measure of this change. A passing build and type check do not make the failing tests safe to ignore.

## Changes in this pass

- Moved response-date parsing into a leaf module so assessment scheduling, groups, bundles, history, and the care timeline do not import the broad progress module. The static import graph no longer has the earlier cycle through the model and progress modules.
- Loaded pages and form surfaces on demand from the app router. The data dictionary now loads when its Administration tab opens.
- Stabilised the store context value and skipped the second full workspace write after a successful committed action.
- Refreshed the local calendar day at midnight and when the page regains focus, then rerendered date-dependent screens.
- Scoped the error boundary's reset to prototype-owned browser keys.
- Updated bundle test fixtures to selectable current measures, and corrected a response-date assertion that expected the current day instead of the submitted day.

## Remaining test work, in order

### Investigation findings

- The Client Profile scheduling and stream tests now pass. Their shared fixture omitted the episode stream required by the current registration form; they also assumed four profile instruments when the configured Client Profile currently has three.
- The catalogue tests now pass against the current nine measure bundles: one Client Profile, four initial stream bundles, and four clinician review bundles. Psychosis uses the EP Batch 2/3 instruments; the other streams use explicitly fictional check-ins until approved instruments are available.
- The bundle UI suite now passes after its fixtures explicitly selected advanced mode, disabled SMS when testing unavailable delivery, and used current selectable person measures. This also verified that an untouched optional record is recoverable after saving and reloading an advanced-mode workspace.
- The scheduling suite now passes. Investigation found one product defect: a legacy single-measure rule was reconciled by both the legacy scheduler and bundle scheduler. With a future draft, this created a second collection for the same due date. Bundle reconciliation now accepts only rules with an assessment list; the legacy scheduler retains responsibility for single-measure rules.
- The default workspace retains seven records using older instrument versions. All seven remain readable through `getInstrument`; one is a planned clinician initial assessment for `YS-1033`, and the others belong to the closure demonstration. Review the `YS-1033` exception before removing legacy support or claiming every current record is selectable from the active catalogue.
- Much of the old intake suite cannot be repaired by changing its shared fixture alone. It starts with a registration that has no birth date and later plans a `General` stream; the current intake form requires a birth date and the active stream list excludes `General`. Giving the fixture current values exposed additional assertions tied to the older intake flow, so that experimental change was reverted.
- Some MVP status assertions assume a submitted initial assessment immediately changes the person to Ongoing review. Current status logic requires a recorded assessment outcome when that outcome setting is enabled. Treat these as workflow-contract checks before changing code or expected statuses.
- The remaining 124 failures are concentrated: `model.test.js` (21), `intake.test.js` (15), `mvpAssessmentPathway.test.js` (15), `mvpProfile.test.js` (12), `appointments.test.js` (11), and `assessmentFeatures.test.js` (9) account for 83. Review these as workflow families; many depend on the same retired sample records, stream names, or measure versions.

The production manifest has two static JavaScript chunks totalling 729,375 bytes before route chunks. This is a build-size measurement, not a measured page-load or interaction improvement.

1. **Reconcile the MVP pathway tests with the present product contract.** The largest failing groups use the retired `General` stream, expect eight review bundles including young-person reviews, or expect legacy instrument versions. Current code uses four program streams, four clinician review bundles, and Batch 2/3 instruments. Confirm the intended rule before rewriting these expectations. Relevant files: `src/mvpAssessmentPathway.test.js`, `src/mvpProfile.test.js`, `src/assessmentFeatures.test.js`.
2. **Update sample-data assertions separately from workflow behavior.** Many tests assume old counts, dates, names, and prefilled bundles. Use stable record identifiers and assert the behavior that matters. Relevant files: `src/model.test.js`, `src/people.test.js`, `src/sampleAssessmentBundles.test.js`, `src/assessmentDueExamples.test.js`.
3. **Review intake and appointment failures as behavior questions.** These tests cover consent, closure, and scheduling. Check the intended current flow and representative records before changing either code or assertions. Relevant files: `src/intake.test.js`, `src/appointments.test.js`, `src/externalAppointmentSlots.test.js`.
4. **Make the full suite a gate only after reconciliation.** Keep failing cases visible until each expectation has been checked against the current workflow. Then add a package test command and run it with type check, build, and rendered route checks before merging.

## Remaining code work

- Extract independent sections from the 1,947-line `Forms.jsx`, 1,789-line `Person.jsx`, and 6,637-line `model.js` in small behavior-preserving steps. Start with form state and validation helpers, followed by Person's assessment views and model action families. Add focused tests for each extracted boundary before moving the next section.
- Profile route navigation and store serialization with a representative workspace before pursuing more optimisation. The build now defers large routes, but it does not prove faster interaction or smaller storage costs in every browser.

## Browser verification

The local assessment route for `YS-1034`, General report, Administration, and Administration's deferred Data dictionary rendered after the split. Browser error logs were empty on those checks. This did not exercise editing or saving records.
