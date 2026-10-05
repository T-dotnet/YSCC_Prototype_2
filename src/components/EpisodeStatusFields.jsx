import { EPISODE_TRIGGER_STATUSES } from '../episodeStatusTrigger.js';
import { FieldSelect } from './UI';

export default function EpisodeStatusFields({ draft, change }) {
  if (draft.after !== 'episode-status') return null;
  return <FieldSelect label="Episode status" required value={draft.triggerEpisodeStatus || ''}
    onChange={event => {
      change('triggerEpisodeStatus', event.target.value);
      if (event.target.value === 'Discharged') change('repeat', false);
    }}>
    <option value="">Choose an episode status</option>
    {EPISODE_TRIGGER_STATUSES.map(status =>
      <option key={status} value={status}>{status}</option>)}
  </FieldSelect>;
}
