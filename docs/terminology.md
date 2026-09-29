# YSCC product terminology

<!-- Generated from src/terminology.js. Run npm run terminology:generate after editing that source. -->

The shared product vocabulary lives in [src/terminology.js](../src/terminology.js). UI labels, option labels, **Help & guidance → Product terminology** and this glossary read the same source. These are prototype content decisions, not approved clinical policy or reporting codes.

## Methods: use the label for the record being described

| Context | Preferred label | Values / meaning |
| --- | --- | --- |
| Assessment setup, instrument filters, response sessions and answer evidence | **Collection method** | Clinician entry, Clinic tablet, SMS link |
| Service-contact forms, details and care chronology | **Contact method** | How the contact takes place; for example In person, Phone or Video |
| Consent-request forms, details and filters | **Delivery method** | How the request is delivered or presented |

An in-person service contact can collect answers through Clinic tablet or Clinician entry. Those fields describe different facts. SMS link is an assessment collection method; SMS is a contact-method value. Do not map one to the other automatically.

Use **Assessment collection methods** for the setting that enables assessment method selection. Use the complete option labels in compact and full views alike. Use **Planned collection method** when an assessment has a selected method but no response session yet.

## Shared glossary

| Preferred term | Meaning | Replace these aliases in this context | Existing data fields |
| --- | --- | --- | --- |
| **Collection method** | How instrument responses are collected within an assessment. An assessment has a shared collection method; each response session records the method used. | Modality; Assessment modality; Delivery channel; Channel; Delivery method | `collection.channel`, `attempt.channel`, `bundle.assessments[].channel` |
| **Contact method** | How a service contact takes place, such as in person, by phone or by video. This is separate from the method used to collect instrument answers during that contact. | Delivery mode; Delivery method | `appointment.deliveryMode`, `externalAppointment.deliveryMode` |
| **Delivery method** | How a consent request is delivered or presented. Use this label in consent forms, details and filters. | Delivery channel; Channel | `consentRequest.channel` |
| **Respondent** | The person supplying instrument answers within an assessment: the patient or a family respondent. The respondent can differ from the person entering the answers. | Recipient (assessment only) | `collection.respondent`, `attempt.respondent`, `bundle.assessments[].recipient` |
| **Recipient** | The person receiving a service contact or a consent request. Use Respondent when referring to the person supplying instrument answers. | — | `appointment.recipientType` |
| **Assistance** | Support provided while completing a response. Record this separately from collection method, respondent and recorder. | Completion support; Support level | `collection.assistance`, `attempt.assistance` |
| **Recorder** | The person entering or transcribing instrument answers. Recording answers does not make the recorder the respondent. | — | `collection.recorder`, `attempt.recorderName` |
| **Assessment** | A collection of instruments with a shared name, respondent, collection method and schedule. Completion tracks the responses to each included instrument. | Assessment bundle; Bundle | `settings.assessmentScheduleRules[]`, `episode.assessmentBundleInstances[]`, `collection.bundleId` |
| **Instrument** | A versioned set of questions included in an assessment. Each assigned instrument has its own answers, response status and collection sessions. Instruments can also be recorded individually. | Questionnaire; Collection (record name) | `collection.version`, `instrument.questions`, `episode.collections[]` |
| **Service contact** | A planned or actual direct service contact, with attendance and contact details. Contact is an acceptable short label; appointment describes the booked arrangement. Indirect activity remains separate. | — | `episode.appointments[]` |
| **Care events** | The combined care chronology, including service contacts, assessments, contextual events and structured care records. Each source record retains its own meaning. | — | `derived care chronology` |
| **Program stream** | The program stream recorded for a care period, also used by assessment conditions. Use the full label in fields, tables and conditions. | Program; Stream (field label) | `carePeriod.programStream`, `bundle.programStream` |
| **Care level** | The level recorded for an effective-dated care period. Terminology consolidation does not establish approved care-intensity or reporting mappings. | — | `carePeriod.careLevel`, `bundle.careLevel` |

## Usage and compatibility

- Import shared labels and collection-method options from `src/terminology.js`. Do not create a new local list or shorten option labels to Clinician, Tablet or SMS.
- Use **Respondent** throughout assessments and individual instruments. **Recipient** remains valid for service contacts and consent requests.
- Keep Created, Draft and Completed in the simple assessment view. Full views retain separate assignment, response and clinical-review statuses; these dimensions are not interchangeable.
- Preserve existing storage keys (including `channel`, `deliveryMode`, `recipient` and `assessmentModality`), persisted values, identifiers and historical audit records. Changing a visible label does not migrate data or alter a workflow.
- Dated stakeholder documents and earlier handovers are historical snapshots. Use this glossary for current vocabulary; do not silently rewrite those snapshots.
- Eligibility, mandatory instrument/contact linkage, care-intensity mappings and clinical intervals require separate decisions. This glossary does not settle them.

After changing the vocabulary, run `npm run terminology:generate`, `npm run terminology:check`, the relevant domain tests, typecheck and build. Review the rendered fields in both assessment views and in narrow layouts.
