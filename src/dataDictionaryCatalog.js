import { INSTRUMENTS } from './instruments.js';
import extractFields from './epExtractCodebook.json' with { type: 'json' };

export const DICTIONARY_CHANGED = 'yscc-data-dictionary-changed';
export const DICTIONARY_OVERRIDES_KEY = 'yscc-data-dictionary-overrides-v1';
export const DICTIONARY_QUESTIONS_KEY = 'yscc-data-dictionary-questions-v1';
export const DICTIONARY_DELETED_KEY = 'yscc-data-dictionary-deleted-v1';

const profileVariables = {
  clientGender: 'client_gender', clientPostcode: 'client_postcode',
  clientAtsiStatus: 'client_atsi_status', clientLanguageHome: 'client_language_home',
  clientSexuality: 'client_sexuality', clientCountryOfBirth: 'client_country_of_birth',
  clientEthnicity: 'client_ethnicity', clientEducationLevel: 'client_education_level',
  referralDate: 'referral_date', source: 'referral_source',
  commencementDate: 'commencement_date', commencementDateUhr: 'commencement_date_uhr',
  commencementDateFep: 'commencement_date_fep', registeredCentreName: 'centre',
  registeredCentreState: 'centre_state', registeredCentrePostcode: 'centre_postcode',
};

function saved(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}

export function dictionaryValues(format, question) {
  const coded = String(format || '').split('\n').map(line => /^\s*(.+?)\s*=\s*\d+\s*$/.exec(line)?.[1]?.trim()).filter(Boolean);
  return [...new Set(coded.length ? coded : question?.options || [])];
}

export function dataDictionaryCatalog() {
  const overrides = saved(DICTIONARY_OVERRIDES_KEY, {});
  const drafts = saved(DICTIONARY_QUESTIONS_KEY, []);
  const byExtract = new Map(extractFields.map(field => [`${field.batch}:${field.variable}`, field]));
  const rows = INSTRUMENTS.flatMap(instrument => instrument.questions.map((question, index) => {
    const batch = instrument.codebookBatch || (instrument.clientProfileSection ? 1 : null);
    const variable = question.codebookVariable || (instrument.clientProfileSection ? profileVariables[question.id] : null);
    const base = byExtract.get(`${batch}:${variable}`);
    const id = `${instrument.version}:${question.id}:${index}`;
    const field = { ...base, ...overrides[id] };
    return { id, label: question.title, measure: instrument.name, version: instrument.version,
      questionId: question.id, questionIndex: index, variable: field.variable || variable,
      values: dictionaryValues(field.format, question), format: field.format || '',
      profileKey: instrument.clientProfileSection ? question.id : null };
  }));
  const linked = new Set(rows.filter(row => row.variable).map(row => row.variable));
  const derived = extractFields.filter(field => field.derived && !linked.has(field.variable))
    .filter((field, index, fields) => fields.findIndex(other => other.variable === field.variable && other.dataItem === field.dataItem && other.format === field.format) === index)
    .map(field => {
      const id = `derived:${field.batch}:${field.variable}`;
      const current = { ...field, ...overrides[id] };
      return { id, label: current.dataItem || current.variable, measure: 'Derived field', variable: current.variable,
        values: dictionaryValues(current.format), format: current.format || '' };
    });
  const added = (Array.isArray(drafts) ? drafts : []).map(entry => ({
    id: entry.key, label: entry.title, measure: INSTRUMENTS.find(item => item.version === entry.instrumentVersion)?.name || 'Draft',
    version: entry.instrumentVersion, questionId: entry.id, variable: entry.variable,
    values: dictionaryValues(entry.format), format: entry.format || '', draft: true,
  }));
  const deleted = new Set(saved(DICTIONARY_DELETED_KEY, []));
  return [...derived, ...added, ...rows].filter(row => !deleted.has(row.id));
}

export function notifyDictionaryChanged() { window.dispatchEvent(new Event(DICTIONARY_CHANGED)); }
