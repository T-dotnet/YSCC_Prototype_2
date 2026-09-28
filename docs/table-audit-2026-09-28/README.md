# YSCC table consistency audit
28 September 2026 · Local working copy based on HEAD `93550c8`

## Verdict

**Partially consistent. The tables do not yet use one component and one behaviour contract.**

People and the assessment bundle ledger use `StandardTable`; other tables use a separate related-record wrapper, native markup, or an ARIA table built from divs. Most reuse colours and some controls, but headers, cell spacing, density, responsive behaviour, sortable columns, missing values, and default ordering differ.

This is an audit and implementation specification. No application code was changed by this audit. The local server was verified as running from this checkout. The source contained existing uncommitted changes and changed during the audit; the ledger's new visible Status column, migration to Badge, and column-count fallback were rechecked and are included here.

## Coverage and evidence

Every native-table and ARIA-table implementation in `src` was inventoried, including wrapper consumers and Storybook examples. Representative application tables were rendered in the in-app browser at desktop width and 390px width. Sorting was exercised on Worklist, People, bundle completion, and the bundle editor's Status column. A direct invocation of the existing comparator checked case handling, numeric text, and missing values.

Rows in this inventory represent table purposes; shared wrappers can serve more than one purpose.

| Table / surface | Current implementation | Sorting / values | Audit coverage |
| --- | --- | --- | --- |
| People | StandardTable + QueueRow/QueueCell | Person, status, required %, owner, episode; hidden priority default | Browser desktop/mobile; Person sorting; source |
| My work | Native work-table + QueueRow/QueueCell | Person, item, progress/due, status | Browser desktop/mobile; Person sorting; source |
| Validation issues | Native quality-table + QueueRow/QueueCell | Severity, issue, owner, status, due; Client static | Browser desktop; source |
| Assessment bundle ledger | StandardTable + QueueRow/QueueCell | Due, method, respondent, completion ratio; name and Status static | Browser desktop/mobile; completion ascending/descending; source |
| Bundle details, assessments | RelatedRecordsTable | Status only; custom localeCompare | Source; editable equivalent rendered |
| Bundle editor, assessments | RelatedRecordsTable | Status only; custom localeCompare | Browser; Status sorting; source |
| Bundle details, contacts | RelatedRecordsTable | Fixed newest-first date; no user sorting | Browser; source |
| Related contacts | RelatedRecordsTable | Fixed oldest-first date; plain status text | Source |
| Linked assessments | RelatedRecordsTable | Fixed oldest-first response/due date; plain status text | Source |
| Delivery attempts | Div/span ARIA table | Array order; dates and session times; contribution badge/count | Source |
| Outcome-measure comparison | Native comparison table | Fixed chronological order, measures in selected columns | Browser; source |
| Questionnaire answer comparison | Native progress-table | Question order; earlier/latest answer values and change | Source |
| Bundle configuration, instrument list | Native bundle-assessments-table + QueueRow/QueueCell | Configuration order; no user sorting | Browser; source |
| Imported sample care events | Native people-table/sample-events-table | Model event order; source-field disclosure row | Source |
| Storybook table examples | StandardTable in StandardTable/Compositions; native work-table in DataDisplay | Examples do not all exercise the canonical wrapper/comparator | Source |

Care events, Change log, and the alternative assessment-type ledger use columns within disclosure lists rather than table semantics. They need the same typography and value tokens, with their existing disclosure behaviour retained. Appointments and Referrals are record lists. General report currently has no data table.

### Captured steps

| Step | What was inspected | Health | Evidence |
| --- | --- | --- | --- |
| 1 | Worklist, desktop | Sorting/value and footer inconsistencies | 01-worklist.png |
| 2 | People, desktop | Shared wrapper, but Person sorting mismatches visible IDs | 02-people.png |
| 3 | Bundle ledger, desktop | Shared wrapper; sectioned sort and static Status/name columns | 03-assessment-ledger.png |
| 4 | Bundle assessment editor | Status sort works; separate density and table wrapper | 04-bundle-details.png |
| 5 | Bundle contacts | Readable; fixed newest-first order differs from related contacts | 05-bundle-contacts.png |
| 6 | Validation issues | Readable; separate wrapper and missing-date policy | 06-data-quality.png |
| 7 | Bundle configuration instrument list | Readable; different header surface and no shared wrapper | 07-settings.png |
| 8 | People at 390px | Labelled rows readable; visible sort controls disappear | 08-people-mobile.png |
| 9 | Worklist at 390px | Labelled rows readable; visible sort controls disappear | 09-worklist-mobile.png |
| 10 | Outcome-measure comparison | Readable chronological comparison; separate table styling | 10-measure-comparison.png |
| 11 | Bundle ledger at 390px | Compact sort selector works; separate implementation from other queues | 11-ledger-mobile.png |

## Findings and required changes

### 1. P1 — “Person” sorts a hidden value

People and Worklist render `patientIdentifier(person)`, normally the YS record ID, but the sort accessor uses `person.name`. Clicking ascending Person produced YS-1025, YS-1034, YS-1033, YS-1024 on People. Worklist likewise started with YS-1025 followed by YS-1034 rows. This is not ascending order of the displayed IDs.

**Required:** use the same displayed identity for rendering and sorting. Give the column an explicit value/accessor contract so display changes cannot leave stale sort logic.

Sources: [People accessors](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/features/People.jsx:74), [Worklist accessors](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/features/Worklist.jsx:162), [displayed identity](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/patientIdentity.js:3). Steps 1–2.

### 2. P1 — Mobile loses visible sorting on People and Worklist

At 390px the table header is clipped to a screen-reader-only region. People has no compact sort control, and Care owner / Episode headers are removed from layout while those body values remain. Worklist likewise has no visible replacement sorting control. The bundle ledger has a working Sort bundles selector.

**Required:** generate the same compact Sort by control from sortable column definitions for all sortable tables. Preserve header associations for cells that remain visible and verify keyboard focus cannot disappear into clipped headers.

Sources: [responsive queue styles](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/styles.css:15340), [shared compact controls](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/components/StandardTable.jsx:58), [ledger compact options](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/features/Person.jsx:1059). Steps 8, 9, 11.

### 3. P2 — Sort descriptions are stale and the worklist default is misstated

After Person sorting, Worklist still says “Sorted by priority, then due / review date”. Its initial sort key is `due`, and its sort call has no priority fallback. People always says “Highest-priority assessment shown first” even after another header is selected.

**Required:** derive the footer from the actual sort state. If priority is the intended worklist default, implement that comparator explicitly; otherwise describe the existing due-date order accurately.

Sources: [Worklist initial sort](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/features/Worklist.jsx:65), [Worklist footer](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/features/Worklist.jsx:375), [People footer](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/features/People.jsx:330). Steps 1–2; confirmed in browser after clicking Person.

### 4. P2 — Progress / review sorts a hidden due date

With assessment scheduling off, Worklist displays “Assessment created” or “Draft saved” in Progress / review. The same sortable column still reads `workRecord(task).due`.

**Required:** choose an accessor for the current column meaning. Use explicit progress rank or displayed progress text when this column shows progress; use the raw date when it shows dates.

Source: [Worklist value and header branches](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/features/Worklist.jsx:290), [sort accessors](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/features/Worklist.jsx:162). Step 1; this mode was active in the preview.

### 5. P2 — The comparator does not define natural text or missing-value ordering

The shared comparator uses JavaScript `<` and `>`, converting null/undefined to empty strings. A direct invocation returned Beta before alpha, YS-10 before YS-2, and an absent date before a recorded date in ascending order. Bundle due dates separately use a sentinel to keep missing dates last. Bundle status tables instead use localeCompare.

**Required:** one typed comparator: case-insensitive natural text, raw numeric values, raw ISO dates, explicit status/severity ranks where appropriate, and missing values last in both directions. Use a stable record ID as a deterministic tie-breaker. Keep absent and zero distinct.

Sources: [shared comparator](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/queueSort.js:1), [bundle date exception](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/features/Person.jsx:373), [dialog comparator](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/components/AssessmentBundleDetails.jsx:43). Step 6 shows absent Due values first. Comparator examples were executed against current code.

### 6. P2 — The ledger sorts within implicit sections

The ledger sorts rows, then splits them into incomplete and completed tbody sections. Completion descending showed 6/9, 6/10, 7/13, 0/4, then the completed 4/4 row. Due-date sorting similarly cannot be a single global chronological order.

**Required:** make the grouping explicit with section labels and a description such as “Incomplete bundles first; sorted within each group”, or make selected column sorting global. Preserve the product's completed/incomplete workflow deliberately. Completion currently sorts the fraction rather than the completed count; label this as completion percentage in sorting help/options.

Sources: [completion ratio](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/features/Person.jsx:377), [tbody sections](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/features/Person.jsx:1074). Steps 3, 11.

### 7. P2 — Component use and styling are fragmented

StandardTable only wraps markup and optional column ordering. It does not own values, comparator selection, sortable columns, empty state, pagination, or compact sort options. RelatedRecordsTable duplicates the scroll-region/table wrapper and uses the people-table class. DeliveryAttemptsTable duplicates semantics in div/span markup. Worklist, Quality, settings, and comparison tables construct their own shells.

The stylesheet has global table/th/td rules and many later overrides. Generic rows inherit pointer cursors and hover backgrounds unless individually corrected. Related records use 14px control text and transparent headers; StandardTable cells use 12px padding and 64px height; questionnaire comparison uses 16px padding and a hard-coded grey-blue header background. Some differences are reasonable for long answers, but they are not expressed as a shared variant contract.

**Required:** one table shell with explicit default, compact, and comparison variants; common header/cell tokens; row interactivity only when a row action exists. Migrate wrappers and native render sites to it. Retain semantic row headers for comparison tables and full-width disclosure rows in sample-data tables.

Sources: [StandardTable](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/components/StandardTable.jsx:4), [RelatedRecordsTable](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/components/RelatedRecordsTable.jsx:2), [DeliveryAttemptsTable](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/components/DeliveryAttemptsTable.jsx:24), [global styles](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/styles.css:3078), [related-record styles](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/styles.css:10054), [questionnaire comparison styles](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/styles.css:5686). Steps 1–7, 10.

### 8. P2 — Sortability and ordering vary for equivalent columns

People/Worklist Person is sortable, Quality Client is static. Bundle name and the new ledger Status column are static, while Status is sortable inside bundle assessment dialogs. Related contacts sort oldest first; bundle contacts sort newest first. Delivery attempts use array order. None of these fixed orders have a shared user-facing order description.

**Required:** declare sortable columns consistently by type and document intentional fixed order. Contacts should share a date-order policy. Actions, contribution explanations, and questionnaire question order do not need arbitrary sorting; comparison tables should retain meaningful chronology and questionnaire order.

Sources: [Quality headers](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/features/Operations.jsx:257), [ledger headers](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/features/Person.jsx:1068), [related contacts order](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/components/RelatedRecordsAccordion.jsx:37), [bundle contacts order](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/components/AssessmentBundleDetails.jsx:23). Steps 3–6.

### 9. P2 — Values and status presentation need a common contract

Missing values use “Not set”, “Not scheduled”, “Not recorded”, “Not completed”, “None linked”, and a dash. Several have distinct meanings, but the distinctions are not centralised. Related-record status is plain text, while bundle contact status and the latest ledger Status column use Badge. The ledger was migrated to Badge during the audit, which resolves its separate status-label implementation. Completion uses a percentage in People, a fraction in the ledger, and answer counts in delivery evidence.

**Required:** shared status and value renderers with domain-specific meanings. Use “Not recorded” for absent evidence, “Not scheduled” for an absent schedule, and “None linked” for an empty relationship. Keep these distinct from incomplete work and zero. Reuse the shared Badge/status tokens, date formatter, and completion-bar primitives. Label the underlying unit so data completeness, assessments completed, and answers supplied remain understandable.

Sources: [related-record values](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/components/RelatedRecordsAccordion.jsx:43), [delivery contribution](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/components/DeliveryAttemptsTable.jsx:60), [ledger Status/value cells](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/features/Person.jsx:1102). Steps 2–6, 11.

### 10. P2 — Sorting does not reset pagination

People and Worklist sort all filtered records before slicing, which is correct. However, header clicks only update useQueueSort; the URL page remains unchanged. On a later page, selecting a new sort leaves the user viewing a middle segment of the new order.

**Required:** reset to page 1 whenever sorting changes, and use the same policy for compact sort controls and filters.

Sources: [sort state](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/components/QueueControls.jsx:4), [People pagination](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/features/People.jsx:100), [Worklist pagination](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/src/features/Worklist.jsx:169). Source finding; later-page browser reproduction was not performed.

## Proposed shared standard

| Concern | Standard |
| --- | --- |
| Component | StandardTable owns shell, scroll region, density variant, empty state, and compact controls. Columns declare id, label, render, raw sort value, value type, sortable flag, and mobile label. |
| Default visuals | Use current People reference: existing palette, 12px uppercase headers, 15px primary values, 12px cell padding, 64px minimum row height, subtle separators. |
| Variants | Compact uses shared density tokens; comparison permits multiline answers and semantic row headers. Colours, borders, focus, and value formatting still share tokens. |
| Text sorting | Natural, case-insensitive ascending/descending order of the displayed primary value. |
| Date sorting | Raw ISO date/timestamp, never formatted date strings or relative labels. |
| Numeric sorting | Raw number; percentages sort by ratio, with the unit explained. |
| Status sorting | Explicit domain rank when priority is meaningful; otherwise a shared alphabetical comparator. |
| Missing values | Explicit renderer by meaning; missing sort values last in both directions. |
| Equal values | Deterministic ID tie-breaker. |
| Responsive behaviour | Use available table width; retain all important values with visible cell labels; provide a compact sort selector generated from the same columns. |
| Accessibility | Native table semantics, table label/caption, scoped headers, button-based sortable headers with aria-sort, named scroll region and visible focus. Reorder controls must be discoverable and keyboard tested. |
| Row actions | Named link/button in each interactive row; pointer/hover treatment only for actual row actions. |
| Pagination | Sort/filter before slicing; reset page on sort/filter change; sort description derives from current state. |
| Empty states | One empty-state component with appropriate message and reset-filter action; colspan follows current columns. |
| Column order | Stable column IDs in storage; compatible migration as columns evolve; defined default/reset order. |
| Storybook | Every variant and sortable/empty/compact/reordered state uses the production shell and comparator. |

## Implementation order

1. Fix visible-value sorting, progress sorting, stale footer descriptions, and compact sort controls.
2. Consolidate comparator, column definitions, missing-value renderers, and page-reset behaviour.
3. Migrate Worklist, Quality, RelatedRecordsTable, DeliveryAttemptsTable, settings, sample events, and comparison tables to shared shell variants.
4. Make ledger grouping explicit and align contact ordering and status components.
5. Verify ascending/descending text, dates, percentages, missing values, equal values, page 2 changes, empty filters, keyboard use, desktop, constrained containers, and 390px layouts.

## Limits

This is a complete source inventory with representative rendered verification, not a claim that every feature flag, imported sample, delivery attempt, comparison state, or assistive-technology path was exercised. Questionnaire answer comparison, imported sample care events, standalone related-record dialogs, delivery attempts, and the read-only bundle assessment branch were inspected in source only. No clinical records or bundle settings were saved, no deployment was performed, and no build/full test-suite result is asserted. Column reordering was reviewed in code, not exercised.

Full-page screenshot capture produced duplication/extra blank areas in this browser. Those captures were rejected and replaced with viewport captures.

## Screenshot record

### 1. Worklist — separate table shell and Progress / review column

![1. Worklist — separate table shell and Progress / review column](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/docs/table-audit-2026-09-28/01-worklist.png)

### 2. People — canonical visual reference

![2. People — canonical visual reference](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/docs/table-audit-2026-09-28/02-people.png)

### 3. Ledger — current visible Status column

![3. Ledger — current visible Status column](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/docs/table-audit-2026-09-28/03-assessment-ledger.png)

### 4. Bundle assessments — compact editable table

![4. Bundle assessments — compact editable table](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/docs/table-audit-2026-09-28/04-bundle-details.png)

### 5. Bundle contacts — newest-first order

![5. Bundle contacts — newest-first order](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/docs/table-audit-2026-09-28/05-bundle-contacts.png)

### 6. Validation queue — missing due dates first

![6. Validation queue — missing due dates first](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/docs/table-audit-2026-09-28/06-data-quality.png)

### 7. Settings — instrument list with separate header surface

![7. Settings — instrument list with separate header surface](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/docs/table-audit-2026-09-28/07-settings.png)

### 8. People at 390px — labelled rows without visible sort controls

![8. People at 390px — labelled rows without visible sort controls](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/docs/table-audit-2026-09-28/08-people-mobile.png)

### 9. Worklist at 390px — labelled rows without visible sort controls

![9. Worklist at 390px — labelled rows without visible sort controls](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/docs/table-audit-2026-09-28/09-worklist-mobile.png)

### 10. Measure comparison — chronology and separate styling

![10. Measure comparison — chronology and separate styling](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/docs/table-audit-2026-09-28/10-measure-comparison.png)

### 11. Ledger at 390px — compact sort selector

![11. Ledger at 390px — compact sort selector](/Users/danielenicoletti/Documents/Documents - Daniele’s MacBook Air/ChatGPT/YSCC Platform/YSCC_Prototype_2/docs/table-audit-2026-09-28/11-ledger-mobile.png)

