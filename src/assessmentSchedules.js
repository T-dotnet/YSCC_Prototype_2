import { INSTRUMENTS } from './instruments.js';
import { PROGRAM_STREAMS, CARE_LEVELS, carePeriodAt } from './carePeriods.js';
import { assessmentType } from './assessmentGroups.js';
import { responseDate } from './progress.js';

export function scheduleRuleError(rule, rules = []) {
  if (!rule?.id || !INSTRUMENTS.some(i => i.version === rule.version)) return 'Choose an assessment type.';
  if (rule.programStream !== 'All' && !PROGRAM_STREAMS.includes(rule.programStream)) return 'Choose a program stream.';
  if (rule.careLevel !== 'All' && !CARE_LEVELS.includes(rule.careLevel)) return 'Choose a care level.';
  if (!Number.isInteger(rule.weeks) || rule.weeks < 1 || rule.weeks > 104) return 'Enter a cadence from 1 to 104 weeks.';
  if (rules.some(r => r.id !== rule.id && r.version === rule.version && r.programStream === rule.programStream && r.careLevel === rule.careLevel)) return 'A rule already exists for this assessment, stream and care level. Edit that rule instead.';
  return null;
}

export function matchingScheduleRules(rules, episode, today) {
  const period = carePeriodAt(episode, today);
  if (!period) return [];
  const ranked = rules.filter(r => r.enabled && !scheduleRuleError(r) &&
    (r.programStream === 'All' || r.programStream === period.programStream) &&
    (r.careLevel === 'All' || r.careLevel === period.careLevel))
    .sort((a, b) => {
      const rank = r => (r.programStream !== 'All' ? 2 : 0) + (r.careLevel !== 'All' ? 1 : 0);
      return rank(b) - rank(a) || a.id.localeCompare(b.id);
    });
  const seen = new Set();
  return ranked.filter(r => {
    const key = assessmentType({version:r.version}).key;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

export function reconcileAssessmentSchedules(state, today) {
  if (!state.settings?.automaticAssessmentDueDates) return state;
  const rules = state.settings.assessmentScheduleRules || [];
  let changed = false;
  const people = state.people.map(person => {
    if (person.archivedAt || person.readOnly) return person;
    let personChanged = false;
    const episodes = person.episodes.map(episode => {
      if (episode.status !== 'Active' || episode.readOnly) return episode;
      const period = carePeriodAt(episode, today);
      let collections = episode.collections || [];
      for (const rule of matchingScheduleRules(rules, episode, today)) {
        const key = assessmentType({version:rule.version}).key;
        const records = collections.filter(c => assessmentType(c).key === key);
        const pending = records.filter(c => c.response !== 'Submitted' && !['Paused','Cancelled'].includes(c.assignment));
        // Keep existing assignments and drafts. A due/overdue draft allows its next cycle.
        if (pending.some(c => (!['Draft','In progress'].includes(c.response) && c.assignment !== 'Active') || !c.due || c.due > today)) continue;
        const interval = rule.weeks * 7;
        const anchor = period.startDate;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor || '')) continue;
        const elapsed = records.map(c => c.response === 'Submitted' ? [responseDate(c), c.due].filter(Boolean).sort().at(-1) : pending.includes(c) ? c.due : null)
          .filter(d => d && d >= anchor).sort().at(-1);
        const cycles = elapsed ? Math.floor((Date.parse(elapsed) - Date.parse(anchor)) / 86400000 / interval) + 1 : 1;
        const dueDate = new Date(`${anchor}T12:00:00Z`);
        dueDate.setUTCDate(dueDate.getUTCDate() + cycles * interval);
        const due = dueDate.toISOString().slice(0,10);
        const id = `AUTO-${episode.id}-${rule.id}-${anchor}-${due}`;
        if (collections.some(c => c.id === id)) continue;
        const instrument = INSTRUMENTS.find(i => i.version === rule.version);
        collections = [...collections, {
          id, label: `${instrument.name} · follow-up`, version: rule.version, due,
          createdAt: `${today}T12:00:00.000Z`, assignment:'Planned', response:'Not started',
          review:'Pending', link:'Not sent', scheduleFree:true, attempts:[], answers:[],
          respondent:'Person', recorder:'Person', assistance:'Independent', appointmentId:null,
          scheduleRuleId:rule.id, scheduleAnchor:anchor,
        }];
        changed = personChanged = true;
      }
      return collections === episode.collections ? episode : {...episode, collections};
    });
    return personChanged ? {...person, episodes} : person;
  });
  return changed ? {...state, people} : state;
}
