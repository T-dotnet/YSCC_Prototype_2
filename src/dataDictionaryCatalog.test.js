import test from 'node:test';
import assert from 'node:assert/strict';
import { dataDictionaryCatalog, DICTIONARY_DELETED_KEY, DICTIONARY_OVERRIDES_KEY } from './dataDictionaryCatalog.js';
import { profileValueTriggerError, profileValueMatches } from './profileValueTriggers.js';

test('Assessment Pack fields follow dictionary edits and deletion', () => {
  const originalStorage = globalThis.localStorage;
  const items = new Map();
  globalThis.localStorage = {
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
  };
  try {
    const gender = dataDictionaryCatalog().find(item => item.variable === 'client_gender');
    assert.ok(gender);
    assert.ok(gender.values.includes('Female'));
    const rule = { triggerDataEnabled: true, triggerDataField: gender.id, triggerDataValue: 'Female' };
    assert.equal(profileValueTriggerError(rule), null);
    assert.equal(profileValueMatches(rule, { clientGender: 'Female' }, { id: 'EP' }), true);
    const questionnaire = dataDictionaryCatalog().find(item => item.version && item.questionIndex != null &&
      !item.profileKey && item.values.length > 0);
    assert.ok(questionnaire);
    const answers = Array(questionnaire.questionIndex + 1).fill(null);
    answers[questionnaire.questionIndex] = questionnaire.values[0];
    assert.equal(profileValueMatches({ triggerDataEnabled: true, triggerDataField: questionnaire.id,
      triggerDataValue: questionnaire.values[0] }, { intakes: [] }, { id: 'EP', collections: [{
      version: questionnaire.version, response: 'Submitted', answers,
    }] }), true);
    items.set(DICTIONARY_OVERRIDES_KEY, JSON.stringify({ [gender.id]: { format: 'Another value = 1' } }));
    assert.deepEqual(dataDictionaryCatalog().find(item => item.id === gender.id).values, ['Another value']);
    assert.ok(profileValueTriggerError(rule));
    items.set(DICTIONARY_DELETED_KEY, JSON.stringify([gender.id]));
    assert.equal(dataDictionaryCatalog().some(item => item.id === gender.id), false);
  } finally { globalThis.localStorage = originalStorage; }
});
