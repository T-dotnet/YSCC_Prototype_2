import { Checkbox, FieldInput, FieldSelect } from './UI';
import { measureSourceOptions, measureTriggerIds, measureTriggerStatuses } from '../measureTriggers.js';
import SpecificMeasureFields from './SpecificMeasureFields';
import EpisodeStatusFields from './EpisodeStatusFields';

const legacyLabels = {
  'new-profile': 'New profile', intake: 'Intake', 'care-period': 'Care episode starts',
};
const legacyAnchors = {
  'new-profile': 'the new profile is created', intake: 'intake is completed',
  'care-period': 'the care episode starts',
};

export default function MockAssessmentPackSchedule({ draft, settings, change, timeKey, repeat = false, sourceOptions }) {
  const days = draft[timeKey] ?? 0;
  const sources = sourceOptions || measureSourceOptions(settings, draft.id);
  const sourceName = sources.find(item => item.id === measureTriggerIds(draft)[0])?.name;
  const sourceStatus = measureTriggerStatuses(draft)[0];
  const anchor = draft.after === 'episode-status' ? draft.triggerEpisodeStatus && `the episode reaches ${draft.triggerEpisodeStatus}`
    : draft.after === 'specific-measure' ? sourceName && sourceStatus && `${sourceName} is ${sourceStatus.replace('not-required', 'not required')}`
      : legacyAnchors[draft.after];
  return <div className="bundle-name-field bundle-timing-fields assessment-pack-schedule">
    <h3 className="bundle-name-field bundle-timing-heading">Schedule</h3>
    {draft.timing === 'date' ? <FieldInput label="Due date (existing schedule)" type="date" required
      value={draft.dueDate || ''} onChange={event => change('dueDate', event.target.value)} /> : <>
      <FieldInput label="Time (days)" type="number" min={repeat ? '1' : '0'} max="728" step="1" required
        value={days} onChange={event => change(timeKey, Number(event.target.value))} />
      <FieldSelect label="After" required value={draft.after || ''} onChange={event => change('after', event.target.value)}>
        <option value="">Choose a trigger</option>
        {legacyLabels[draft.after] && <option value={draft.after}>{legacyLabels[draft.after]} (existing schedule)</option>}
        <option value="specific-measure">Specific Assessment Pack</option>
        <option value="episode-status">Specific episode status</option>
      </FieldSelect>
      <SpecificMeasureFields draft={draft} settings={settings} change={change} sourceOptions={sourceOptions} />
      <EpisodeStatusFields draft={draft} change={change} />
      {repeat && <Checkbox className="bundle-repeat-choice" label="Repeat" checked={!!draft.repeat}
        onChange={event => change('repeat', event.target.checked)} />}
      <p className="muted bundle-repeat-hint">{anchor
        ? `${days === 0 ? `Due when ${anchor}.` : repeat && draft.repeat ? `First due ${days} days after ${anchor}, then every ${days} days.` : `Due once ${days} days after ${anchor}.`}`
        : 'Choose what starts the schedule.'}</p>
    </>}
  </div>;
}
