import test from 'node:test';
import assert from 'node:assert/strict';
import { MVP_SCHEDULE_PRESETS, presetForBundle } from './mvpSchedulePresets.js';

test('only the 90-day preset repeats and each preset is recognisable after selection', () => {
  assert.equal(MVP_SCHEDULE_PRESETS.filter(preset => preset.fields.repeat).map(preset => preset.id).join(','), 'review');
  for (const preset of MVP_SCHEDULE_PRESETS)
    assert.equal(presetForBundle({ ...preset.fields })?.id, preset.id);
});
