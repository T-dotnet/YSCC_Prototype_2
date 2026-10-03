import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultWorkspace } from './model.js';
import { getWorkItems, workNeedsAttention } from './workQueue.js';
import { getNotifications } from './notifications.js';

test('current flow creates one work item and alert per open measure bundle', () => {
  const state = createDefaultWorkspace();
  const items = getWorkItems(state, 'team', '2026-10-03');
  const profile = items.find(item => item.person.id === 'YS-1026' && item.stage === 'Client profile');
  const review = items.find(item => item.person.id === 'YS-1024' && item.stage === '90-day review');
  const outcome = items.find(item => item.person.id === 'YS-1028' && item.status === 'Record outcome');
  assert.equal(profile?.total, 3);
  assert.equal(items.filter(item => item.person.id === 'YS-1026').length, 1);
  assert.equal(review?.total, 15);
  assert.equal(items.filter(item => item.person.id === 'YS-1024').length, 1);
  assert.equal(outcome?.stage, 'Initial assessment');
  assert.equal(workNeedsAttention(outcome), true);
  assert.equal(getNotifications(state, '2026-10-03').filter(item =>
    item.personId === 'YS-1024' && item.category === 'assessment_overdue').length, 1);
  assert.equal(getNotifications(state, '2026-10-03').filter(item =>
    item.personId === 'YS-1028' && item.category === 'assessment_outcome').length, 1);
});

test('completed flow steps leave work and outcome alert when resolved', () => {
  const state = createDefaultWorkspace();
  const profilePerson = state.people.find(person => person.id === 'YS-1026');
  for (const record of profilePerson.episodes[0].collections.filter(record => record.clientProfileMeasure)) {
    record.response = 'Submitted'; record.review = 'Reviewed';
  }
  const outcomePerson = state.people.find(person => person.id === 'YS-1028');
  outcomePerson.episodes[0].assessmentOutcome = { value: '1 · Continue care' };
  const items = getWorkItems(state, 'team', '2026-10-03');
  assert.equal(items.some(item => item.person.id === 'YS-1026' && item.stage === 'Client profile'), false);
  assert.equal(items.some(item => item.person.id === 'YS-1028' && item.status === 'Record outcome'), false);
  assert.equal(getNotifications(state, '2026-10-03').some(item => item.category === 'assessment_outcome' &&
    item.personId === 'YS-1028'), false);
});
