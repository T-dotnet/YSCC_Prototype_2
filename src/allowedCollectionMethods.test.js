import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedCollectionMethods, allowedCollectionMethodsError } from './allowedCollectionMethods.js';
import { clientProfileBundle, clientProfileBundleError } from './clientProfileMeasure.js';
import { createSeed, reducer } from './model.js';

test('Any allows available methods and a specific selection validates as a nonempty set', () => {
  const available = ['Clinic tablet', 'Clinician entry'];
  assert.deepEqual(allowedCollectionMethods({}, available), available);
  assert.deepEqual(allowedCollectionMethods({ allowedCollectionMethods: ['Clinician entry'] }, available), ['Clinician entry']);
  assert.equal(allowedCollectionMethodsError({ allowedCollectionMethods: [] }, available) !== null, true);
  assert.equal(allowedCollectionMethodsError({ allowedCollectionMethods: ['SMS link'] }, available) !== null, true);
});

test('Client profile method changes respect the saved allowed choices', () => {
  const state = createSeed();
  const profile = { ...clientProfileBundle(state.settings), allowedCollectionMethods: ['Clinic tablet'] };
  state.settings = { ...state.settings, advancedAssessmentOptions: false, clientProfileBundle: profile };
  const person = state.people[0];
  const episode = person.episodes[0];
  const bundleId = `MVP-CLIENT-PROFILE-${episode.id}`;
  episode.collections = [...(episode.collections || []), {
    id: 'TEST-PROFILE-METHOD', bundleId, clientProfileMeasure: true, bundleName: profile.name,
    channel: 'Clinic tablet', respondent: 'Person', response: 'Not started',
    assignment: 'Planned', link: 'Not sent', attempts: [], draftAnswers: ['Prefilled profile detail'],
  }];
  const action = { type: 'SET_MVP_BUNDLE_METHOD', personId: person.id, episodeId: episode.id,
    bundleId, channel: 'Clinician entry' };

  assert.equal(clientProfileBundleError(profile, state.settings), null);
  assert.equal(reducer(state, action), state);
  const both = { ...state, settings: { ...state.settings,
    clientProfileBundle: { ...profile, allowedCollectionMethods: ['Clinic tablet', 'Clinician entry'] } } };
  const changed = reducer(both, action);
  const record = changed.people.find(item => item.id === person.id).episodes
    .find(item => item.id === episode.id).collections.find(item => item.id === 'TEST-PROFILE-METHOD');
  assert.equal(record.channel, 'Clinician entry');

  const smsProfile = { ...profile, allowedCollectionMethods: ['Clinic tablet', 'SMS link'] };
  const smsState = { ...state, settings: { ...state.settings, clientProfileBundle: smsProfile } };
  const smsAction = { ...action, channel: 'SMS link' };
  assert.equal(clientProfileBundleError(smsProfile, smsState.settings), null);
  const smsChanged = reducer(smsState, smsAction);
  assert.equal(smsChanged.people.find(item => item.id === person.id).episodes
    .find(item => item.id === episode.id).collections.find(item => item.id === 'TEST-PROFILE-METHOD').channel, 'SMS link');
  const smsOff = { ...smsState, settings: { ...smsState.settings, assessmentSms: false } };
  assert.ok(clientProfileBundleError(smsProfile, smsOff.settings));
  assert.equal(reducer(smsOff, smsAction), smsOff);
});
