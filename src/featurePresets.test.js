import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultWorkspace, reducer } from './model.js';
import { MVP_PRESET, mvpPresetActive } from './featurePresets.js';

test('new workspaces start with the MVP preset', () => {
  const { settings } = createDefaultWorkspace();
  assert.equal(mvpPresetActive(settings), true);
  for (const [key, value] of Object.entries(MVP_PRESET))
    assert.equal(settings[key], value, key);
});

test('MVP preset saves the requested switches in one action', () => {
  const workspace = createDefaultWorkspace();
  const before = {
    ...workspace,
    settings: {
      ...workspace.settings,
      advancedAssessmentOptions: true,
      assessmentSms: false,
      phase2CareActivity: false,
      mvpAssessmentPathway: false,
      showGeneralReport: false,
      scheduleAssessments: true,
      mvpProfileTab: true,
      uiColorSetup: 3,
    },
  };
  const after = reducer(before, { type: 'APPLY_MVP_PRESET' });
  assert.equal(mvpPresetActive(after.settings), true);
  assert.equal(after.settings.phase2CareActivity, true);
  for (const [key, value] of Object.entries(MVP_PRESET))
    assert.equal(after.settings[key], value, key);
  assert.equal(after.settings.uiColorSetup, 3);
  assert.equal(reducer(after, { type: 'APPLY_MVP_PRESET' }), after);
});

test('MVP schedule presets can be switched off and restored by the preset', () => {
  const workspace = createDefaultWorkspace();
  const off = reducer(workspace, { type: 'SET_MVP_SCHEDULE_PRESETS', enabled: false });
  assert.equal(off.settings.mvpSchedulePresets, false);
  assert.equal(mvpPresetActive(off.settings), false);
  const restored = reducer(off, { type: 'APPLY_MVP_PRESET' });
  assert.equal(restored.settings.mvpSchedulePresets, true);
});

test('Care point heading starts on and the MVP preset restores it to on', () => {
  const workspace = createDefaultWorkspace();
  assert.equal(workspace.settings.mvpCarePointHeading, true);
  const off = reducer(workspace, { type: 'SET_MVP_CARE_POINT_HEADING', enabled: false });
  assert.equal(off.settings.mvpCarePointHeading, false);
  assert.equal(mvpPresetActive(off.settings), false);
  const restored = reducer(off, { type: 'APPLY_MVP_PRESET' });
  assert.equal(restored.settings.mvpCarePointHeading, true);
  assert.equal(mvpPresetActive(restored.settings), true);
});

test('MVP preset keeps Record outcome below the table', () => {
  const workspace = createDefaultWorkspace();
  assert.equal(workspace.settings.mvpOutcomeBelowTable, true);
  const inHeading = reducer(workspace, { type: 'SET_MVP_OUTCOME_BELOW_TABLE', enabled: false });
  assert.equal(inHeading.settings.mvpOutcomeBelowTable, false);
  assert.equal(mvpPresetActive(inHeading.settings), false);
  const restored = reducer(inHeading, { type: 'APPLY_MVP_PRESET' });
  assert.equal(restored.settings.mvpOutcomeBelowTable, true);
  assert.equal(mvpPresetActive(restored.settings), true);
});
