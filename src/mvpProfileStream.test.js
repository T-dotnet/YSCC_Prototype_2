import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultWorkspace, TODAY } from './model.js';
import { intakeActionError } from './intake.js';
import { reconcileMvpAssessmentPathway } from './mvpAssessmentPathway.js';
import { carePeriodError } from './carePeriods.js';

test('a new profile requires the stream used to select its initial assessment pack', () => {
  const state = createDefaultWorkspace();
  const action = { type: 'ADD_PERSON', mvpProfile: true, requestId: 'stream-check',
    name: 'Fictional Stream Example', dob: '2008-04-12', owner: 'Jess Taylor',
    nextAction: 'Complete Client profile', reviewDate: TODAY, programStream: '' };
  assert.equal(intakeActionError(state, action, { name: 'Jess Taylor' }), 'Choose an episode stream.');
});

test('assigning a stream prepares the missing initial assessment for a completed profile', () => {
  const state = createDefaultWorkspace();
  const person = state.people.find(item => item.id === 'YS-1033');
  const episode = person.episodes.find(item => item.status === 'Active');
  const withoutInitial = { ...episode, programStream: 'General', carePeriods: [],
    collections: episode.collections.filter(record => !record.mvpInitialAssessment) };
  const legacy = { ...state, people: state.people.map(item => item.id === person.id
    ? { ...item, episodes: item.episodes.map(record => record.id === episode.id ? withoutInitial : record) }
    : item) };
  assert.equal(reconcileMvpAssessmentPathway(legacy, TODAY).people.find(item => item.id === person.id)
    .episodes.find(item => item.id === episode.id).collections.some(record => record.mvpInitialAssessment), false);
  assert.equal(carePeriodError(withoutInitial, { type: 'SET_INITIAL_CARE_LEVEL',
    programStream: 'Personality', careLevel: 'Mid', deliveringUnit: 'Northside Centre' },
  { role: 'Clinician' }, TODAY, []), null);
  const assigned = { ...legacy, people: legacy.people.map(item => item.id === person.id
    ? { ...item, episodes: item.episodes.map(record => record.id === episode.id
      ? { ...record, programStream: 'Personality' } : record) } : item) };
  assert.ok(reconcileMvpAssessmentPathway(assigned, TODAY).people.find(item => item.id === person.id)
    .episodes.find(item => item.id === episode.id).collections.some(record => record.mvpInitialAssessment));
});
