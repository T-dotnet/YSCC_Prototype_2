# YSCC Storybook collection

Run `npm run storybook` from `YSCC_Prototype_2` and open `http://127.0.0.1:6006`. Run `npm run build-storybook` to verify a static build. The build output is ignored at `storybook-static/`.

This collection accompanies the visible-app audit in `../output/design-system-audit-2026-09-26/` (relative to the parent YSCC Platform folder). Stories use the current components, `src/styles.css`, the app fonts, and `createSeed()` sample records. The Storybook chrome uses the app's light canvas, ink, forest, and action coral colours. These stories document the prototype rather than declare approved canonical components.

| Level | Stories | Audit IDs |
| --- | --- | --- |
| Foundations | Semantic colours, typography, spacing and shape | F01–F03 |
| Primitives | Buttons, badges, identity, search, fields, pickers, validation | A01, A03–A04, A06–A09, A12 |
| Compositions | Tabs, consent and Care events filters, queue, applied chips, record item, panel, dialog, empty/success, report evidence, person-record surfaces | M01–M08, M11, M16; person surfaces |
| Templates | Person record context, current People heading/panel excerpt, and assessment collection cards | O03–O05, partial |

## Visual parity reference

| Story | App reference | Production source |
| --- | --- | --- |
| Record Navigation | Kai Thompson person record | `src/features/Person.jsx`, `src/components/UI.jsx` |
| Filter Toolbar | Kai Thompson / Consent & respondents | `src/features/Person.jsx`, `src/components/ListFilterBar.jsx`, `src/components/RecordItem.jsx` |
| Care Event Filters | Kai Thompson / Care events | `src/features/CareEvents.jsx`, `src/components/ActivityTimeline.jsx` |
| Page Heading And Panel | People | `src/features/People.jsx`, `src/components/UI.jsx` |
| Record Section | Kai Thompson assessment collection cards, ungrouped presentation | `src/components/AssessmentCollectionCard.jsx` |
| Responsive Queue | Current sample people and assessment status | `src/components/QueueRow.jsx`, `src/components/QueueControls.jsx` |
| Overview Summary | Kai Thompson / Overview; bordered Current assessment and borderless Current care episode | `src/features/Person.jsx`, `src/styles.css` |
| Contact Participant Context | Kai Thompson / Consent; light-bordered contact and participant context | `src/features/Person.jsx`, `src/styles.css` |

The person header in navigation stories is a Storybook fixture that supplies the same page classes and current sample text. Buttons that would navigate or save a record in the app are visual examples in Storybook. Filter, tab, sort, collapse, and dialog interactions run locally within their stories. Check the app for complete workflows and persisted state.

## Capture next

- Semantic `StatusBadge`, `SeverityBadge`, `CategoryLabel`, `CountChip`, and `RemovableTag` components. The current Badge uses status-text lookup and a neutral fallback.
- One filter toolbar contract spanning ListFilterBar, Care events, History, and Appointments; the current variants are both documented.
- Assessment summary rows, dated timeline entries, and type-specific RecordItem variants.
- Dialog footer and validation arrangements used by the 33 modal call sites.
- Full shell, intake, participant questionnaire, and report templates with isolated fixtures.
- 390 px and keyboard states for each extracted component.

Do not flatten direct service contacts, indirect activity, contextual Care events, assessment collections, and audit changes into one data type while consolidating their presentation.
