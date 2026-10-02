import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultWorkspace, reducer } from './model.js';
import { PHASE_2_MVP_PRESET, phase2MvpPresetActive } from './featurePresets.js';

test('Phase 2 MVP preset saves the requested switches in one action', () => {
  const workspace = createDefaultWorkspace();
  const before = {
    ...workspace,
    settings: {
      ...workspace.settings,
      advancedAssessmentOptions: true,
      assessmentSms: false,
      mvpAssessmentPathway: false,
      showGeneralReport: false,
      scheduleAssessments: true,
      mvpProfileTab: true,
      uiColorSetup: 3,
    },
  };
  const after = reducer(before, { type: 'APPLY_PHASE_2_MVP_PRESET' });
  assert.equal(phase2MvpPresetActive(after.settings), true);
  for (const [key, value] of Object.entries(PHASE_2_MVP_PRESET))
    assert.equal(after.settings[key], value, key);
  assert.equal(after.settings.uiColorSetup, 3);
  assert.equal(reducer(after, { type: 'APPLY_PHASE_2_MVP_PRESET' }), after);
});
