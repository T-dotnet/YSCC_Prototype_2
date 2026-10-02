import test from 'node:test';
import assert from 'node:assert/strict';
import { completedMeasureStatusChange, validMeasureStatusChange } from './measureStatusChange.js';

test('a measure changes status only after every instrument is submitted', () => {
  const episode = { collections: [
    { bundleId: 'one', response: 'Submitted', submittedAt: '2026-09-10', bundleContext: { statusChange: 'Assessment' } },
    { bundleId: 'one', response: 'Not started', bundleContext: { statusChange: 'Assessment' } },
  ] };
  assert.equal(completedMeasureStatusChange(episode), null);
  episode.collections[1].response = 'Submitted';
  assert.equal(completedMeasureStatusChange(episode), 'Assessment');
  episode.collections.push({ bundleId: 'two', response: 'Submitted', submittedAt: '2026-09-12',
    bundleContext: { statusChange: 'Ongoing review' } });
  assert.equal(completedMeasureStatusChange(episode), 'Ongoing review');
  episode.collections.push({ bundleId: 'two', due: '2026-12-12', response: 'Not started',
    bundleContext: { statusChange: 'Ongoing review' } });
  assert.equal(completedMeasureStatusChange(episode), 'Ongoing review');
});

test('only the three configured active statuses are accepted', () => {
  for (const status of ['Profiling', 'Assessment', 'Ongoing review', ''])
    assert.equal(validMeasureStatusChange(status), true);
  assert.equal(validMeasureStatusChange('Initial assessment complete'), false);
});
