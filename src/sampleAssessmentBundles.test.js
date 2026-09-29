import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed, reducer, upgradeSampleData } from './model.js';
import { assessmentBundleGroups, bundleError, newBundleError } from './assessmentBundles.js';
import { SAMPLE_ASSESSMENT_BUNDLES } from './sampleAssessmentBundles.js';

const enable = state => reducer(state, { type: 'SET_ASSESSMENT_FEATURE', feature: 'groupAssessmentsByBundle', enabled: true });
const episode = state => state.people.find(person => person.id === 'YS-1034').episodes[0];
const withoutBundleMetadata = collection => Object.fromEntries(Object.entries(collection)
  .filter(([key]) => !key.startsWith('bundle') && key !== 'scheduleAnchor' && key !== 'sampleBundleHistory'));

test('turning bundles on adds usable templates and groups existing completed, draft and created examples', () => {
  const before = createSeed();
  const next = enable(before);
  assert.equal(before.settings.groupAssessmentsByBundle, false);
  assert.equal(before.settings.assessmentScheduleRules.length, 0);
  assert.equal(next.settings.automaticAssessmentDueDates, false);
  const person = next.people.find(person => person.id === 'YS-1034');
  for (const template of SAMPLE_ASSESSMENT_BUNDLES) {
    const bundle = next.settings.assessmentScheduleRules.find(rule => rule.id === template.id);
    assert.equal(bundleError(bundle), null);
    assert.equal(newBundleError(bundle, [], [], person, next.settings), null);
    assert.ok(bundle.assessments.length >= 2);
  }
  for (const person of before.people) {
    const updated = next.people.find(item => item.id === person.id);
    person.episodes.forEach((original, index) => {
      assert.deepEqual(updated.episodes[index].collections.map(withoutBundleMetadata), original.collections.map(withoutBundleMetadata));
      assert.deepEqual(updated.episodes[index].events, original.events);
    });
  }
  const groups = assessmentBundleGroups(episode(next), episode(next).collections, next.settings.assessmentScheduleRules);
  assert.deepEqual(new Set(groups.map(group => group.name)), new Set([
    'Getting started with care', 'General care review', 'Youth and family check-in', 'Individual assessments',
  ]));
  for (const group of groups.filter(group => group.key !== 'individual')) {
    assert.ok(new Set(group.records.map(record => record.version)).size >= 2);
  }
  assert.ok(groups.some(group => group.records.some(record => record.response === 'Draft')));
  assert.ok(groups.some(group => group.records.some(record => record.response === 'Not started')));
  assert.ok(groups.some(group => group.records.some(record => record.response === 'Submitted')));
  assert.ok(episode(next).collections.some(record => record.bundleRequirement === 'Optional'));
});

test('existing enabled workspaces upgrade once and retain edits, deletions and records through off/on and reload', () => {
  const legacy = createSeed();
  legacy.settings.groupAssessmentsByBundle = true;
  const upgraded = upgradeSampleData(legacy);
  const first = upgraded.settings.assessmentScheduleRules[0];
  first.name = 'Staff edited example';
  upgraded.settings.assessmentScheduleRules.pop();
  const off = reducer(upgraded, { type: 'SET_ASSESSMENT_FEATURE', feature: 'groupAssessmentsByBundle', enabled: false });
  const on = enable(off);
  const reloaded = upgradeSampleData(structuredClone(on));
  assert.deepEqual(reloaded.settings.assessmentScheduleRules, on.settings.assessmentScheduleRules);
  assert.deepEqual(episode(reloaded).collections, episode(on).collections);
  assert.deepEqual(episode(off).collections, episode(upgraded).collections);
  assert.equal(reloaded.settings.assessmentScheduleRules.length, SAMPLE_ASSESSMENT_BUNDLES.length - 1);
  assert.equal(reloaded.settings.assessmentScheduleRules[0].name, 'Staff edited example');
});

test('custom templates, existing associations and people outside the fictional fixtures are preserved', () => {
  const state = createSeed();
  const custom = { ...structuredClone(SAMPLE_ASSESSMENT_BUNDLES[1]), id: 'staff-bundle', name: 'Staff bundle' };
  state.settings.assessmentScheduleRules.push(custom);
  episode(state).collections[0].bundleId = custom.id;
  const customPerson = structuredClone(state.people.find(person => person.id === 'YS-1034'));
  customPerson.id = 'YS-CUSTOM';
  state.people.push(customPerson);
  const next = enable(state);
  assert.deepEqual(next.settings.assessmentScheduleRules[0], custom);
  assert.equal(episode(next).collections[0].bundleId, custom.id);
  assert.deepEqual(next.people.find(person => person.id === customPerson.id), customPerson);
});

test('sample bundle rows contain two or three unique instruments and at most two current bundles per episode', () => {
  const state = enable(createSeed());
  for (const rule of state.settings.assessmentScheduleRules) {
    assert.ok(rule.assessments.length >= 2 && rule.assessments.length <= 3);
    assert.equal(new Set(rule.assessments.map(item => item.version)).size, rule.assessments.length);
  }
  for (const person of state.people) for (const ep of person.episodes) {
    const groups = assessmentBundleGroups(ep, ep.collections, state.settings.assessmentScheduleRules)
      .filter(group => group.key !== 'individual');
    assert.ok(groups.filter(group => group.records.some(record => record.response !== 'Submitted')).length <= 2);
    for (const group of groups) {
      assert.ok(group.records.length >= 2 && group.records.length <= 3);
      assert.equal(new Set(group.records.map(record => record.version)).size, group.records.length);
    }
  }
  assert.deepEqual(upgradeSampleData(structuredClone(state)), state);
});
