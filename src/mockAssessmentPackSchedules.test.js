import test from 'node:test';
import assert from 'node:assert/strict';
import { clientProfileBundle, clientProfileBundleError } from './clientProfileMeasure.js';
import { MVP_INITIAL_BUNDLES, MVP_REVIEW_BUNDLES, mvpInitialBundles, mvpReviewBundles,
  mvpInitialBundleError, mvpReviewBundleError } from './mvpAssessmentPathway.js';

test('mock Assessment Packs use the new trigger structure when schedule presets are off', () => {
  const settings = { advancedAssessmentOptions: false, mvpSchedulePresets: false, assessmentSms: true };
  const profile = clientProfileBundle(settings);
  assert.equal(profile.after, 'episode-status');
  assert.equal(profile.triggerEpisodeStatus, 'Assessment');
  assert.equal(clientProfileBundleError(profile, settings), null);

  const initial = mvpInitialBundles(settings);
  const reviews = mvpReviewBundles(settings);
  assert.equal(initial.length, MVP_INITIAL_BUNDLES.length);
  assert.equal(reviews.length, MVP_REVIEW_BUNDLES.length);
  for (const bundle of initial) {
    assert.equal(bundle.after, 'specific-measure');
    assert.equal(mvpInitialBundleError(bundle, settings), null);
  }
  for (const bundle of reviews) {
    assert.equal(bundle.after, 'specific-measure');
    assert.deepEqual(bundle.triggerMeasureIds, [initial.find(item =>
      item.programStream === bundle.programStream).id]);
    assert.deepEqual(bundle.triggerMeasureStatuses, ['completed']);
    assert.equal(mvpReviewBundleError(bundle, settings), null);
  }
});

test('saved legacy mock schedules render with new triggers only while presets are off', () => {
  const saved = { clientProfileBundle: { after: 'new-profile', delayDays: 3 },
    mvpReviewBundles: MVP_REVIEW_BUNDLES };
  const flexible = { ...saved, mvpSchedulePresets: false };
  assert.equal(clientProfileBundle(flexible).after, 'episode-status');
  assert.equal(clientProfileBundle(flexible).delayDays, 3);
  assert.ok(mvpReviewBundles(flexible).every(bundle => bundle.after === 'specific-measure'));
  const preset = { ...saved, mvpSchedulePresets: true };
  assert.equal(clientProfileBundle(preset).after, 'new-profile');
  assert.ok(mvpReviewBundles(preset).every(bundle => bundle.after === 'intake'));
});
