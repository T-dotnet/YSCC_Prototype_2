import { assessmentBundleGroups } from './assessmentBundles.js';
import { getInstrument, questionnaireState } from './instruments.js';

export function bundleCollectionGroup(episode, collection, rules = []) {
  const key = collection?.bundleId || collection?.scheduleRuleId;
  if (!key) return null;
  return assessmentBundleGroups(episode, episode.collections, rules)
    .find(group => group.key === key) || { key, name: collection.bundleName || 'Assessment bundle',
      records: episode.collections.filter(record => (record.bundleId || record.scheduleRuleId) === key) };
}

export function nextBundleCollection(records, currentId) {
  const index = records.findIndex(record => record.id === currentId);
  return [...records.slice(index + 1), ...records.slice(0, index)]
    .find(record => record.response !== 'Submitted');
}

export function bundleQuestionnaireProgress(collection, answers = collection.draftAnswers || []) {
  if (collection.response === 'Submitted') return { label: 'Completed', completed: true };
  const instrument = getInstrument(collection.version);
  if (!instrument) return { label: 'Unavailable', completed: false };
  const path = questionnaireState(instrument, answers);
  return { label: path.complete ? 'Ready to submit' : path.answered || collection.response === 'Draft'
    ? 'In progress' : 'Not started', completed: false, answered: path.answered, total: path.total };
}
