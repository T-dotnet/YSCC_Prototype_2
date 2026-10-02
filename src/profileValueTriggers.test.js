import test from 'node:test';
import assert from 'node:assert/strict';
import { profileValueMatches, profileValueTriggerError, PROFILE_TRIGGER_FIELDS } from './profileValueTriggers.js';

const person = { consent: 'Recorded', contact: 'Suitable', clientAtsiStatus: 'Aboriginal',
  intakes: [{ episodeId: 'EP', source: 'Self-referred' }] };
const episode = { id: 'EP', profileDetails: { source: 'Family / Friend' } };

test('profile value triggers use the saved profile and episode fields', () => {
  assert.equal(PROFILE_TRIGGER_FIELDS.length, 4);
  for (const [field, value] of [['consent', 'Recorded'], ['contact', 'Suitable'],
    ['source', 'Family / Friend'], ['clientAtsiStatus', 'Aboriginal']]) {
    const rule = { triggerDataEnabled: true, triggerDataField: field, triggerDataValue: value };
    assert.equal(profileValueTriggerError(rule), null);
    assert.equal(profileValueMatches(rule, person, episode), true);
  }
  assert.equal(profileValueMatches({ triggerDataEnabled: true, triggerDataField: 'source',
    triggerDataValue: 'Self-referred' }, person, episode), false);
  assert.ok(profileValueTriggerError({ triggerDataEnabled: true, triggerDataField: 'contact', triggerDataValue: 'Other' }));
});
