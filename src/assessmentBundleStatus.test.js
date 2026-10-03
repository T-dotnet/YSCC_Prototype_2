import test from 'node:test';
import assert from 'node:assert/strict';
import { assessmentBundleStatus } from './assessmentBundleStatus.js';

const today = '2026-10-03';
const record = (overrides = {}) => ({ id: 'one', response: 'Not started', assignment: 'Planned', due: '2026-11-01', ...overrides });
const statusOf = (records, options) => assessmentBundleStatus(records, today, options).label;

test('collection occasion status uses the same priority across list and ledger', () => {
  assert.equal(statusOf([record({ response: 'Submitted' })], { awaitingOutcome: () => true }), 'Record outcome');
  assert.equal(statusOf([record({ notRequiredReason: 'No longer needed' })]), 'Not required');
  assert.equal(statusOf([record({ response: 'Submitted' })]), 'Completed');
  assert.equal(statusOf([record({ due: '2026-10-02' })]), 'Overdue');
  assert.equal(statusOf([record({ due: today })]), 'Due soon');
  assert.equal(statusOf([record({ response: 'Draft' })]), 'In progress');
  assert.equal(statusOf([record({ bundleSource: 'System' })]), 'New');
  assert.equal(statusOf([record()]), 'Not started');
});
