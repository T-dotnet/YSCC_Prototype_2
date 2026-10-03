import { ATSI_OPTIONS, REFERRAL_SOURCES } from './batch1Registration.js';
import { dataDictionaryCatalog } from './dataDictionaryCatalog.js';

export const PROFILE_TRIGGER_FIELDS = [
  { id: 'consent', label: 'Assessment participation', values: ['Recorded', 'Not recorded', 'Withdrawn'] },
  { id: 'contact', label: 'Contact suitability', values: ['Suitable', 'Not confirmed', 'Unsuitable', 'Not yet assessed'] },
  { id: 'source', label: 'Referral source', values: REFERRAL_SOURCES },
  { id: 'clientAtsiStatus', label: 'Aboriginal and/or Torres Strait Islander', values: ATSI_OPTIONS },
];

export function profileValueTriggerError(rule) {
  if (!rule.triggerDataEnabled) return null;
  const field = [...PROFILE_TRIGGER_FIELDS, ...dataDictionaryCatalog()].find(item => item.id === rule.triggerDataField);
  if (!field) return 'Choose a data dictionary field.';
  if (field.draft) return 'This draft dictionary question has no recorded response to use as a parameter.';
  if (field.measure === 'Derived field' && !['episode_program_stream', 'discharge_date', 'age_at_episode_commencement'].includes(field.variable))
    return 'This derived field has no episode value available for an Assessment Pack parameter.';
  if (!rule.triggerDataValue || (field.values.length && !field.values.includes(rule.triggerDataValue)))
    return 'Choose a value for the selected data field.';
  return null;
}

export function profileValueMatches(rule, person, episode) {
  if (!rule.triggerDataEnabled) return true;
  if (profileValueTriggerError(rule)) return false;
  const intake = person.intakes?.find(item => item.episodeId === episode.id);
  const dictionaryField = dataDictionaryCatalog().find(item => item.id === rule.triggerDataField);
  if (dictionaryField) {
    let value;
    if (dictionaryField.profileKey === 'source') value = episode.profileDetails?.source || intake?.source;
    else if (dictionaryField.profileKey) value = person[dictionaryField.profileKey] ?? episode.profileDetails?.[dictionaryField.profileKey] ?? intake?.[dictionaryField.profileKey];
    else if (dictionaryField.variable === 'episode_program_stream') value = episode.programStream;
    else if (dictionaryField.variable === 'discharge_date') value = episode.end;
    else if (dictionaryField.variable === 'age_at_episode_commencement' && person.dob && episode.start) {
      const birth = new Date(`${person.dob}T00:00:00`);
      const start = new Date(`${episode.start}T00:00:00`);
      value = start.getFullYear() - birth.getFullYear() - Number(start.getMonth() < birth.getMonth() ||
        start.getMonth() === birth.getMonth() && start.getDate() < birth.getDate());
    }
    else if (dictionaryField.version && dictionaryField.questionIndex != null) {
      const records = (episode.collections || []).filter(item => item.version === dictionaryField.version && item.response === 'Submitted');
      value = records.at(-1)?.answers?.[dictionaryField.questionIndex];
    }
    value ??= episode.profileDetails?.[dictionaryField.variable] ?? episode[dictionaryField.variable] ?? person[dictionaryField.variable];
    const text = String(value ?? '');
    return text === rule.triggerDataValue || text.replace(/^\d+\s*[-–:]\s*/, '') === rule.triggerDataValue;
  }
  const value = rule.triggerDataField === 'source'
    ? episode.profileDetails?.source || intake?.source
    : rule.triggerDataField === 'clientAtsiStatus'
      ? person.clientAtsiStatus || intake?.clientAtsiStatus
      : person[rule.triggerDataField];
  return value === rule.triggerDataValue;
}
