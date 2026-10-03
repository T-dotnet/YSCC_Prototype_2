# YSCC product terminology

<!-- Generated from src/terminology.js. Run npm run terminology:generate after editing that source. -->

The shared product vocabulary lives in [src/terminology.js](../src/terminology.js). UI labels, option labels, **Help & guidance → Product terminology** and this glossary read the same source. These are prototype content decisions, not approved clinical policy or reporting codes.

## Methods: use the label for the record being described

| Context | Preferred label | Values / meaning |
| --- | --- | --- |
| Assessment Pack setup, measure filters, response sessions and answer evidence | **Collection method** | Clinician entry, Clinic tablet, SMS link |
| Service-contact forms, details and care chronology | **Contact method** | How the contact takes place; for example In person, Phone or Video |
| Consent-request forms, details and filters | **Delivery method** | How the request is delivered or presented |

An in-person contact can collect answers through Clinic tablet or Clinician entry. Those fields describe different facts. SMS link is a measure collection method; SMS is a contact-method value. Do not map one to the other automatically.

Use **Collection Occasion methods** for the setting that enables method selection for a Collection Occasion. Use the complete option labels in compact and full views alike. Use **Planned collection method** when a Collection Occasion has a selected method but no response session yet.

## Shared glossary

| Preferred term | Meaning | Replace these aliases in this context | Existing data fields |
| --- | --- | --- | --- |
| **Measures** | Multiple standardised instruments; each completed measure yields a Response. | — |  |
| **Contacts** | Recorded pieces of service activity in a young person’s episode. | — |  |
| **Episode** | A young person’s episode of care. | Care episode | `episode` |
| **Contact** | One recorded piece of service activity. | Service contact | `episode.appointments[]` |
| **Measure** | A single standardised instrument, such as K10 or SOFAS. | Instrument (when referring to a standardised measure) | `collection.version`, `instrument.questions` |
| **Assessment Pack** | A defined set of measures issued at a particular point in care. Pack is an acceptable short form in discussion. | Assessment bundle; Bundle | `settings.assessmentScheduleRules[]` |
| **Collection Occasion** | One Assessment Pack issued to one young person at one point in time. Collection is an acceptable short form in discussion. | Collection | `episode.assessmentBundleInstances[]`, `collection.bundleId` |
| **Response** | One completed measure within a Collection Occasion. | — | `collection.answers`, `collection.submittedAt` |
| **Collection method** | How measure responses are collected within a Collection Occasion. Each response session records the method used. | Modality; Assessment modality; Delivery channel; Channel; Delivery method | `collection.channel`, `attempt.channel`, `bundle.assessments[].channel` |
| **Contact method** | How a service contact takes place, such as in person, by phone or by video. This is separate from the method used to collect measure answers during that contact. | Delivery mode; Delivery method | `appointment.deliveryMode`, `externalAppointment.deliveryMode` |
| **Delivery method** | How a consent request is delivered or presented. Use this label in consent forms, details and filters. | Delivery channel; Channel | `consentRequest.channel` |
| **Respondent** | The person supplying answers to a measure: the young person or a clinician. The respondent can differ from the person entering the answers. | Recipient (assessment only) | `collection.respondent`, `attempt.respondent`, `bundle.assessments[].recipient` |
| **Recipient** | The person receiving a service contact or a consent request. Use Respondent when referring to the person supplying measure answers. | — | `appointment.recipientType` |
| **Assistance** | Support provided while completing a response. Record this separately from collection method, respondent and recorder. | Completion support; Support level | `collection.assistance`, `attempt.assistance` |
| **Recorder** | The person entering or transcribing measure answers. Recording answers does not make the recorder the respondent. | — | `collection.recorder`, `attempt.recorderName` |
| **Service contact** | A planned or actual direct service contact, with attendance and contact details. A recorded contact is one piece of service activity; appointment describes the booked arrangement. | — | `episode.appointments[]` |
| **Care chronology** | The combined care chronology, including contacts, collection occasions, contextual events and structured care records. Each source record retains its own meaning. | Care event; Care events | `derived care chronology` |
| **Program stream** | The program stream recorded for a care period, also used by assessment conditions. Use the full label in fields, tables and conditions. | Program; Stream (field label) | `carePeriod.programStream`, `bundle.programStream` |
| **Care level** | The level recorded for an effective-dated care period. Terminology consolidation does not establish approved care-intensity or reporting mappings. | — | `carePeriod.careLevel`, `bundle.careLevel` |

## Usage and compatibility

- Import shared labels and collection-method options from `src/terminology.js`. Do not create a new local list or shorten option labels to Clinician, Tablet or SMS.
- Use **Respondent** for the person supplying measure answers. **Recipient** remains valid for contacts and consent requests.
- A Pack is the defined set; a Collection Occasion is that Pack issued to one young person at one point in time; each completed measure in it is a Response. Do not use Measure for a Pack or Collection Occasion.
- Keep Created, Draft and Completed in the simple collection view. Full views retain separate assignment, response and clinical-review statuses; these dimensions are not interchangeable.
- The current persisted `episode.collections[]` items represent individual assigned measures. A Collection Occasion is represented by their shared pack instance; the existing storage shape is retained.
- Preserve existing storage keys (including `channel`, `deliveryMode`, `recipient` and `assessmentModality`), persisted values, identifiers and historical audit records. Changing a visible label does not migrate data or alter a workflow.
- Dated stakeholder documents and earlier handovers are historical snapshots. Use this glossary for current vocabulary; do not silently rewrite those snapshots.
- Eligibility, mandatory measure/contact linkage, care-intensity mappings and clinical intervals require separate decisions. This glossary does not settle them.

After changing the vocabulary, run `npm run terminology:generate`, `npm run terminology:check`, the relevant domain tests, typecheck and build. Review the rendered fields in both assessment views and in narrow layouts.
