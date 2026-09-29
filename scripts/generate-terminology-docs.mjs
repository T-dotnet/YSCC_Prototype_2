import { readFile, writeFile } from 'node:fs/promises';
import { TERMINOLOGY, COLLECTION_METHOD_SETTING_LABEL } from '../src/terminology.js';

const target = new URL('../docs/terminology.md', import.meta.url);
const cell = value => value.replaceAll('|', '\\|').replaceAll('\n', ' ');
const glossary = `# YSCC product terminology

<!-- Generated from src/terminology.js. Run npm run terminology:generate after editing that source. -->

The shared product vocabulary lives in [src/terminology.js](../src/terminology.js). UI labels, option labels, **Help & guidance → Product terminology** and this glossary read the same source. These are prototype content decisions, not approved clinical policy or reporting codes.

## Methods: use the label for the record being described

| Context | Preferred label | Values / meaning |
| --- | --- | --- |
| Assessment setup, instrument filters, response sessions and answer evidence | **${TERMINOLOGY.collectionMethod.label}** | ${TERMINOLOGY.collectionMethod.options.map(([, label]) => label).join(', ')} |
| Service-contact forms, details and care chronology | **${TERMINOLOGY.contactMethod.label}** | How the contact takes place; for example In person, Phone or Video |
| Consent-request forms, details and filters | **${TERMINOLOGY.deliveryMethod.label}** | How the request is delivered or presented |

An in-person service contact can collect answers through Clinic tablet or Clinician entry. Those fields describe different facts. SMS link is an assessment collection method; SMS is a contact-method value. Do not map one to the other automatically.

Use **${COLLECTION_METHOD_SETTING_LABEL}** for the setting that enables assessment method selection. Use the complete option labels in compact and full views alike. Use **Planned collection method** when an assessment has a selected method but no response session yet.

## Shared glossary

| Preferred term | Meaning | Replace these aliases in this context | Existing data fields |
| --- | --- | --- | --- |
${Object.values(TERMINOLOGY).map(term => `| **${cell(term.label)}** | ${cell(term.definition)} | ${cell(term.aliases.join('; ') || '—')} | ${term.fields.map(field => '\u0060' + cell(field) + '\u0060').join(', ')} |`).join('\n')}

## Usage and compatibility

- Import shared labels and collection-method options from \u0060src/terminology.js\u0060. Do not create a new local list or shorten option labels to Clinician, Tablet or SMS.
- Use **Respondent** throughout assessments and individual instruments. **Recipient** remains valid for service contacts and consent requests.
- Keep Created, Draft and Completed in the simple assessment view. Full views retain separate assignment, response and clinical-review statuses; these dimensions are not interchangeable.
- Preserve existing storage keys (including \u0060channel\u0060, \u0060deliveryMode\u0060, \u0060recipient\u0060 and \u0060assessmentModality\u0060), persisted values, identifiers and historical audit records. Changing a visible label does not migrate data or alter a workflow.
- Dated stakeholder documents and earlier handovers are historical snapshots. Use this glossary for current vocabulary; do not silently rewrite those snapshots.
- Eligibility, mandatory instrument/contact linkage, care-intensity mappings and clinical intervals require separate decisions. This glossary does not settle them.

After changing the vocabulary, run \u0060npm run terminology:generate\u0060, \u0060npm run terminology:check\u0060, the relevant domain tests, typecheck and build. Review the rendered fields in both assessment views and in narrow layouts.
`;

if (process.argv.includes('--check')) {
  const existing = await readFile(target, 'utf8').catch(() => '');
  if (existing !== glossary) {
    console.error('Terminology glossary is out of date. Run npm run terminology:generate.');
    process.exitCode = 1;
  } else console.log('Terminology glossary matches the shared source.');
} else {
  await writeFile(target, glossary);
  console.log('Generated docs/terminology.md from src/terminology.js.');
}
