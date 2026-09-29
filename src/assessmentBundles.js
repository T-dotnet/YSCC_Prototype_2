import { COLLECTION_METHOD_OPTIONS } from "./terminology.js";
import { INSTRUMENTS } from './instruments.js';
import { PROGRAM_STREAMS, CARE_LEVELS, carePeriodAt } from './carePeriods.js';
import { CARE_EVENT_TYPES, SYSTEM_EVENT_TYPES, REPORT_EVENT_TYPES } from './careEvents.js';
import { assessmentSmsEnabled } from './assessmentFeatures.js';
import { responseDate } from './progress.js';

export const BUNDLE_EVENT_TYPES = [
  { value: 'episode-started', label: 'Care episode started' },
  { value: 'level-change', label: 'Program or care level changed' },
  ...[...CARE_EVENT_TYPES, ...SYSTEM_EVENT_TYPES, ...REPORT_EVENT_TYPES].map(({value, label}) => ({value, label})),
];
export const bundleName = rule => rule.name || `${INSTRUMENTS.find(i => i.version === rule.version)?.name || 'Instrument'} assessment`;
export const bundleIntervalDays = bundle => bundle.days ?? (bundle.weeks * 7);
export const bundleTimingMode = bundle => bundle.timing ?? 'days';
export const bundleRepeats = bundle => bundleTimingMode(bundle) === 'days' && bundle.after !== 'referral' && (bundle.repeat ?? true);
export const bundleContext = bundle => ({trigger:bundle.trigger, programStream:bundle.programStream,
  careLevel:bundle.careLevel, channel:bundle.channel, recipient:bundle.recipient, days:bundleIntervalDays(bundle), dueDate:bundle.dueDate, after:bundle.after, referralStatus:bundle.referralStatus, minAge:bundle.minAge, maxAge:bundle.maxAge, eventType:bundle.eventType, delayDays:bundle.delayDays,
  ...(bundle.trigger === 'current' ? {timing:bundleTimingMode(bundle),repeat:bundleRepeats(bundle)} : {})});
export function bundleDescription(bundle) {
  if (!bundle) return 'Assessment configuration no longer available';
  if (bundle.trigger === 'event') return `Event trigger · ${BUNDLE_EVENT_TYPES.find(event => event.value === bundle.eventType)?.label || bundle.eventType} · ${bundle.delayDays === 0 ? 'Due on event date' : `Due ${bundle.delayDays} ${bundle.delayDays === 1 ? 'day' : 'days'} after event`}`;
  return `Program stream / care-level condition · ${bundle.programStream === 'All' ? 'All program streams' : bundle.programStream} · ${bundle.careLevel === 'All' ? 'All care levels' : `${bundle.careLevel} care level`}${bundle.minAge != null || bundle.maxAge != null ? ` · ${bundleAgeLabel(bundle)}` : ''} · ${bundleTiming(bundle)}`;
}
export function bundleTiming(bundle) {
  if (!bundle) return 'Timing not recorded';
  if (bundle.trigger === 'event') {
    if (!Number.isFinite(bundle.delayDays)) return 'Timing not recorded';
    return bundle.delayDays === 0 ? 'Due on event date' : `Due ${bundle.delayDays} ${bundle.delayDays === 1 ? 'day' : 'days'} after event`;
  }
  if (bundleTimingMode(bundle) === 'intake') return 'At intake';
  if (bundleTimingMode(bundle) === 'discharge') return 'At discharge';
  if (bundleTimingMode(bundle) === 'date') return bundle.dueDate ? `Due ${bundle.dueDate}` : 'Date not recorded';
  const days = bundleIntervalDays(bundle);
  const after = bundle.after === 'referral' ? `referral ${(bundle.referralStatus || 'Accepted').toLowerCase()}` : bundle.after === 'intake' ? 'intake' : bundle.after === 'discharge' ? 'discharge' : BUNDLE_EVENT_TYPES.find(event=>event.value===bundle.after)?.label;
  if (after) return bundleRepeats(bundle) ? `Every ${days} days after ${after}` : `Once, ${days} days after ${after}`;
  return Number.isFinite(days) ? bundleRepeats(bundle)
    ? `Every ${days} ${days === 1 ? 'day' : 'days'}`
    : `Once, ${days} ${days === 1 ? 'day' : 'days'} after care period starts` : 'Timing not recorded';
}
export function assessmentBundleGroups(episode, visibleCollections, rules = []) {
  const groups = new Map();
  for (const collection of visibleCollections) {
    const rule = rules.find(bundle => bundle.id === (collection.bundleId || collection.scheduleRuleId));
    const instance = episode.assessmentBundleInstances?.find(item => item.id === collection.bundleInstanceId && item.customName);
    const key = instance?.id || collection.bundleId || rule?.id || 'individual';
    const configuration = rule ? asBundle(rule) : collection.bundleContext;
    if (!groups.has(key)) groups.set(key, {key, bundleId: collection.bundleId || rule?.id, instanceId: instance?.id, name:instance?.name || (key === 'individual' ? 'Individual instruments' : rule ? bundleName(rule) : collection.bundleName || 'Assessment'),
      triggeringEvent:configuration?.trigger === 'event' ? BUNDLE_EVENT_TYPES.find(event => event.value === configuration.eventType)?.label || configuration.eventType || 'Event not recorded' : null,
      description:key === 'individual' ? 'Instruments created outside an assessment' : bundleDescription(rule ? asBundle(rule) : collection.bundleContext),
      timing:key === 'individual' ? null : bundleTiming(rule ? asBundle(rule) : collection.bundleContext), records:[]});
    groups.get(key).records.push(collection);
  }
  const pending = collection => collection.response !== 'Submitted';
  const date = collection => responseDate(collection) || collection.createdAt?.slice(0,10) || collection.due || '';
  return [...groups.values()].map(group => ({...group, records:group.records.sort((a,b) =>
    Number(pending(b)) - Number(pending(a)) || date(b).localeCompare(date(a)) || a.id.localeCompare(b.id))}))
    .sort((a,b) => Number(a.key === 'individual') - Number(b.key === 'individual') ||
      Number(b.records.some(pending)) - Number(a.records.some(pending)));
}
export const bundleAssessmentUnavailable = (item, person, settings) =>
  item.channel === 'SMS link' && !assessmentSmsEnabled(settings) ? 'Assessment SMS flow is off' :
    item.recipient === 'Family respondent' && !person.family ? 'No family respondent recorded' : '';
export const bundleDelivery = (bundle, overrides = []) => ({
  channel:overrides[0]?.channel ?? bundle.channel ?? bundle.assessments[0]?.channel ?? 'Clinic tablet',
  recipient:overrides[0]?.recipient ?? bundle.recipient ?? bundle.assessments[0]?.recipient ?? 'Person',
});
export const bundleAssessmentsForCreation = (bundle, overrides = []) =>
  bundle.assessments.map(item => ({...item,...bundleDelivery(bundle,overrides)}));
export const bundleAdditionalAssessments = (bundle, extras = [], overrides = []) =>
  extras.map(item => ({...item,...bundleDelivery(bundle,overrides)}));
export const collectionBelongsToBundle = (collection, bundleId) =>
  (collection.bundleId || collection.scheduleRuleId) === bundleId;
// Only untouched assignments can be removed or have their delivery settings changed.
export const bundleCollectionEditable = collection => collection.response === 'Not started' &&
  collection.assignment === 'Planned' && (!collection.link || collection.link === 'Not sent') &&
  !collection.attempts?.length && !collection.answers?.some(answer => answer != null) &&
  !collection.appointmentId && !collection.contactIds?.length && !collection.externalAppointment &&
  !collection.submittedAt && !collection.reviewNote && !collection.reviewDate;
export function bundleSelectionForEpisode(bundle, episode) {
  const saved = episode.assessmentBundleSelections?.[bundle.id];
  const records = (episode.collections || []).filter(collection => collectionBelongsToBundle(collection,bundle.id));
  const optionalIds = saved ? saved.optionalIds.filter(id => bundle.assessments.some(item => item.id === id && item.requirement === 'Optional'))
    : bundle.assessments.filter(item => item.requirement === 'Optional' && records.some(collection => collection.bundleAssessmentId === item.id)).map(item => item.id);
  const extras = saved ? saved.extraAssessments : [...new Map(records.filter(collection => collection.bundleRequirement === 'Additional' &&
    !bundle.assessments.some(item => item.version === collection.version)).map(collection => [collection.version,
      {id:collection.bundleAssessmentId,version:collection.version,channel:collection.channel,recipient:collection.respondent,requirement:'Optional'}])).values()];
  const assessmentOverrides = saved ? saved.assessmentOverrides.filter(override => bundle.assessments.some(item => item.id === override.id))
    : bundle.assessments.flatMap(item => {
      const record = records.filter(collection => collection.bundleAssessmentId === item.id && collection.response !== 'Submitted').at(-1);
      return record ? [{id:item.id,channel:record.channel,recipient:record.respondent}] : [];
    });
  return {optionalIds,extraAssessments:bundleAdditionalAssessments(bundle,extras,assessmentOverrides),assessmentOverrides:assessmentOverrides.length ? bundle.assessments.map(item=>({id:item.id,...bundleDelivery(bundle,assessmentOverrides)})) : []};
}
export function newBundleError(bundle, optionalIds, extras, person, settings, overrides = []) {
  if (!bundle?.enabled || bundleError(bundle)) return 'Choose an enabled assessment.';
  if (!Array.isArray(overrides) || new Set(overrides.map(value => value?.id)).size !== overrides.length ||
      overrides.some(value => !value || !bundle.assessments.some(item => item.id === value.id) ||
        Object.keys(value).some(key => !['id','channel','recipient'].includes(key))))
    return 'Check the collection method and respondent choices.';
  const delivery = bundleDelivery(bundle,overrides);
  if (overrides.some(value => value.channel != null && value.channel !== delivery.channel ||
      value.recipient != null && value.recipient !== delivery.recipient))
    return 'Collection method and respondent apply to the whole assessment.';
  if (!Array.isArray(optionalIds) || new Set(optionalIds).size !== optionalIds.length ||
      optionalIds.some(id => !bundle.assessments.some(item => item.id === id && item.requirement === 'Optional')))
    return 'Check the optional instrument selection.';
  if (!Array.isArray(extras) || extras.some(item => !item || bundle.assessments.some(configured => configured.version === item.version)))
    return 'Extra instruments must be instrument types outside this assessment.';
  const selected = [...bundleAssessmentsForCreation(bundle,overrides).filter(item => item.requirement === 'Mandatory' || optionalIds.includes(item.id)), ...bundleAdditionalAssessments(bundle,extras,overrides)];
  if (!selected.length) return 'Include at least one instrument.';
  const error = bundleError({...bundle,...delivery, assessments:selected});
  if (error) return error;
  if (new Set(extras.map(item => item.version)).size !== extras.length) return 'Add each extra instrument type only once.';
  return selected.map(item => bundleAssessmentUnavailable(item, person, settings)).find(Boolean) || null;
}
export function asBundle(rule) {
  if (Array.isArray(rule.assessments)) {
    const channel = rule.channel || rule.assessments[0]?.channel || 'Clinic tablet';
    const recipient = rule.recipient || rule.assessments[0]?.recipient || 'Person';
    return {...rule, channel, recipient, assessments:rule.assessments.map(item => ({...item,channel,recipient})), days:bundleIntervalDays(rule),
    ...(rule.trigger === 'current' ? {timing:bundleTimingMode(rule),repeat:bundleRepeats(rule)} : {})};
  }
  return {...rule, days:bundleIntervalDays(rule), timing:'days', repeat:true, channel:'Clinic tablet', recipient:'Person', name:bundleName(rule), trigger:'current', eventType:'', delayDays:0,
    assessments:[{id:`${rule.id}-assessment`, version:rule.version, channel:'Clinic tablet', recipient:'Person', requirement:'Mandatory'}]};
}
export const bundleAgeLabel = bundle => bundle.minAge != null && bundle.maxAge != null
  ? `Ages ${bundle.minAge}–${bundle.maxAge}` : bundle.minAge != null
    ? `Age ${bundle.minAge} and above` : bundle.maxAge != null ? `Age ${bundle.maxAge} and below` : 'All ages';
export function bundleAgeMatches(bundle, person, today) {
  if (bundle.trigger !== 'current' || (bundle.minAge == null && bundle.maxAge == null)) return true;
  const dob = person.dob;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob || '') || dob > today) return false;
  const birth = new Date(`${dob}T12:00:00Z`);
  if (!Number.isFinite(birth.getTime()) || birth.toISOString().slice(0,10) !== dob) return false;
  let age = Number(today.slice(0,4)) - Number(dob.slice(0,4));
  if (today.slice(5) < dob.slice(5)) age--;
  return (bundle.minAge == null || age >= bundle.minAge) && (bundle.maxAge == null || age <= bundle.maxAge);
}
export function bundleError(bundle, bundles=[]) {
  if (!bundle?.id || !bundle.name?.trim()) return 'Enter an assessment name.';
  if (bundle.name.trim().length > 80) return 'Use an assessment name of 80 characters or fewer.';
  if (bundles.some(b => b.id !== bundle.id && bundleName(b).toLowerCase() === bundle.name.trim().toLowerCase())) return 'An assessment with this name already exists.';
  if (!['current','event'].includes(bundle.trigger)) return 'Choose when the assessment applies.';
  if (bundle.trigger === 'current') {
    if ([bundle.minAge, bundle.maxAge].some(value=>value != null && (!Number.isInteger(value) || value < 0 || value > 120))) return 'Enter ages from 0 to 120 years, or leave them blank.';
    if (bundle.minAge != null && bundle.maxAge != null && bundle.minAge > bundle.maxAge) return 'Maximum age must be at least the minimum age.';
    if (bundle.programStream !== 'All'  && !PROGRAM_STREAMS.includes(bundle.programStream)) return 'Choose a program stream.';
    if (bundle.careLevel !== 'All' && !CARE_LEVELS.includes(bundle.careLevel)) return 'Choose a care level.';
    if (!['intake','discharge','days','date'].includes(bundleTimingMode(bundle))) return 'Choose Intake, Discharge, Event, or Date.';
    if (bundle.repeat != null && typeof bundle.repeat !== 'boolean') return 'Choose whether the assessment repeats.';
    if (bundleTimingMode(bundle) !== 'days' && bundle.repeat === true) return 'Repeat is only available for Time (days).';
    if (bundleTimingMode(bundle) === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(bundle.dueDate || '') || !Number.isFinite(Date.parse(bundle.dueDate)) || new Date(bundle.dueDate).toISOString().slice(0,10) !== bundle.dueDate)) return 'Enter a valid due date.';
    if (bundleTimingMode(bundle) === 'days') {
      if (bundle.after && !['care-period','intake','discharge','referral',...BUNDLE_EVENT_TYPES.map(event=>event.value)].includes(bundle.after)) return 'Choose an event to schedule after.';
      const days = bundleIntervalDays(bundle);
      if (!Number.isInteger(days) || days < 1 || days > 728) return 'Enter a time from 1 to 728 days.';
    }
  } else {
    if (!BUNDLE_EVENT_TYPES.some(e => e.value === bundle.eventType)) return 'Choose a triggering event.';
    if (!Number.isInteger(bundle.delayDays) || bundle.delayDays < 0 || bundle.delayDays > 730) return 'Enter a delay from 0 to 730 days.';
  }
  if (typeof bundle.enabled !== 'boolean') return 'Choose whether this assessment is enabled.';
  if (!bundle.assessments?.length) return 'Add at least one instrument.';
  const ids = new Set(), targets = new Set();
  for (const item of bundleAssessmentsForCreation(bundle)) {
    const instrument = INSTRUMENTS.find(i => i.version === item.version);
    if (!item.id || ids.has(item.id)) return 'Each instrument must have a unique identifier.';
    ids.add(item.id);
    if (!instrument) return 'Choose an instrument type for every instrument.';
    if (!COLLECTION_METHOD_OPTIONS.some(([value]) => value === item.channel)) return 'Choose a collection method for every instrument.';
    if (!instrument.respondents.includes(item.recipient)) return `${instrument.name} does not support the assessment respondent. Choose a compatible instrument or change the assessment respondent.`;
    if (!['Mandatory','Optional'].includes(item.requirement)) return 'Choose Mandatory or Optional for every instrument.';
    const target = `${item.version}|${item.channel}|${item.recipient}|${item.requirement}`;
    if (targets.has(target)) return 'This instrument, collection method and respondent are already in the assessment.';
    targets.add(target);
  }
  return null;
}
const addDays = (date, days) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isFinite(Date.parse(date))) return null;
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0,10);
};
export function bundleCollection(offer, today) {
  const item = offer.assessment;
  return {id:offer.id, label:`${INSTRUMENTS.find(i=>i.version===item.version)?.name} · ${offer.bundleName}`,
    version:item.version, due:offer.due, createdAt:`${today}T12:00:00.000Z`,
    assignment:'Planned', response:'Not started', review:'Pending', link:'Not sent', scheduleFree:true,
    attempts:[], answers:[], channel:item.channel, respondent:item.recipient, recorder:item.recipient,
    assistance:item.channel === 'Clinician entry' ? 'Transcribed' : 'Independent', appointmentId:null,
    scheduleRuleId:offer.bundleId, bundleId:offer.bundleId, bundleName:offer.bundleName,
    bundleContext:offer.bundleContext,
    bundleAssessmentId:item.id, bundleRequirement:item.requirement, scheduleAnchor:offer.anchor,
    bundleEventId:offer.eventId || null, bundleTimingSourceId:offer.timingSourceId || null,
    ...(offer.dischargeFollowUp ? {dischargeFollowUp:true} : {})};
}
function matchingEvents(bundle, episode, today) {
  return (episode.events || []).filter(event => {
    if (bundle.activationEventIds?.includes(event.id) || event.supersededBy || event.voidedAt) return false;
    const date = event.effectiveDate || event.eventDate || event.date;
    if (!date || date > today) return false;
    if (bundle.trigger === 'event' && bundle.eventType === 'episode-started')
      return event.actionType === 'START_ASSESSMENT' || event.title === 'Initial assessment added after intake' || event.title === 'Care episode started' || event.title === 'Care episode started after level change';
    if (bundle.eventType === 'referral') return (event.eventType === 'referral' || event.kind === 'referral') && (event.referralStatus || event.status || event.outcome) === (bundle.referralStatus || 'Accepted');
    if (bundle.eventType === 'level-change') return event.title === 'Care episode started after level change';
    return event.actionType === 'ADD_CARE_EVENT' && event.eventType === bundle.eventType;
  });
}
export function reconcileAssessmentBundles(state, today) {
  if (!state.settings?.automaticAssessmentDueDates) return state;
  const bundles = (state.settings.assessmentScheduleRules || []).map(asBundle).filter(b => b.assessments && b.enabled && !bundleError(b));
  if (!bundles.length) return state;
  let changed = false;
  const people = state.people.map(person => {
    if (person.archivedAt || person.readOnly) return person;
    let personChanged = false;
    const episodes = person.episodes.map(episode => {
      if (!['Active','Closed'].includes(episode.status) || episode.readOnly) return episode;
      let collections = episode.collections || [], offers = episode.assessmentBundleOffers || [];
      for (const savedTemplate of bundles) {
        const template = savedTemplate.channel != null ? asBundle(savedTemplate) : savedTemplate;
        const selection = episode.assessmentBundleSelections?.[template.id];
        const bundle = selection ? {...template, assessments:[
          ...bundleAssessmentsForCreation(template,selection.assessmentOverrides).filter(item => item.requirement === 'Mandatory' || selection.optionalIds.includes(item.id)),
          ...bundleAdditionalAssessments(template,selection.extraAssessments,selection.assessmentOverrides),
        ]} : template;
        const timing = bundle.trigger === 'current' ? bundleTimingMode(bundle) : 'event';
        const anchorTiming = timing === 'days' ? bundle.after || 'care-period' : timing;
        if (anchorTiming === 'discharge' ? episode.status !== 'Closed' : episode.status !== 'Active') continue;
        const intake = anchorTiming === 'intake' ? person.intakes?.find(record =>
          record.episodeId === episode.id && record.status === 'Completed' && record.outcome === 'Proceed') : null;
        if (anchorTiming === 'intake' && !intake) continue;
        const date = anchorTiming === 'discharge' ? episode.end : anchorTiming === 'intake'
          ? intake.decisionAt?.slice(0,10) || episode.start : today;
        if (!date || date > today || !bundleAgeMatches(bundle, person, date)) continue;
        const period = carePeriodAt(episode, date);
        if (bundle.trigger === 'current' && (!period ||
          (bundle.programStream !== 'All' && bundle.programStream !== period.programStream) ||
          (bundle.careLevel !== 'All' && bundle.careLevel !== period.careLevel))) continue;
        for (const item of bundle.assessments) {
          if (item.channel === 'SMS link' && !assessmentSmsEnabled(state.settings)) continue;
          if (selection && collections.some(collection => collectionBelongsToBundle(collection,bundle.id) &&
            collection.bundleSource === 'Manual' && collection.bundleAssessmentId === item.id && collection.response !== 'Submitted' &&
            !['Paused','Cancelled'].includes(collection.assignment) &&
            (!['Draft','In progress'].includes(collection.response) || !collection.due || collection.due > today))) continue;
          const sources = bundle.trigger === 'event' ? matchingEvents(bundle, episode, today).map(event => ({anchor:event.effectiveDate || event.eventDate || event.date, eventId:event.id}))
            : anchorTiming === 'intake' ? [{anchor:date,timingSourceId:intake.id}]
              : anchorTiming === 'discharge' ? [{anchor:date,timingSourceId:episode.id,dischargeFollowUp:true}]
                : timing === 'date' ? [{anchor:bundle.dueDate}] : timing === 'days' && (anchorTiming === 'referral' || BUNDLE_EVENT_TYPES.some(event=>event.value===anchorTiming)) ? matchingEvents({...bundle,trigger:'event',eventType:anchorTiming},episode,today).map(event=>({anchor:event.effectiveDate || event.eventDate || event.date,eventId:event.id})) : [{anchor:period.startDate}];
          for (const source of sources) {
            let due;
            if (bundle.trigger === 'current') {
              const records = collections.filter(c=>c.bundleSource !== 'Manual' && ((c.bundleId === bundle.id && c.bundleAssessmentId === item.id) || (!c.bundleId && c.scheduleRuleId === bundle.id && item.id === `${bundle.id}-assessment`)) && c.scheduleAnchor === source.anchor);
              if (timing !== 'days' || !bundleRepeats(bundle)) {
                if (records.length || offers.some(o=>o.bundleId===bundle.id && o.assessment.id===item.id && o.anchor===source.anchor)) continue;
                due = timing === 'days' ? addDays(source.anchor,bundleIntervalDays(bundle)) : source.anchor;
              } else {
                if (records.some(c=>c.response !== 'Submitted' && !['Paused','Cancelled'].includes(c.assignment) &&
                  ((!['Draft','In progress'].includes(c.response) && c.assignment !== 'Active') || !c.due || c.due > today))) continue;
                const history = [...records.map(c => [c.due, c.response === 'Submitted' ? responseDate(c) : null].filter(Boolean).sort().at(-1)),
                  ...offers.filter(o=>o.bundleId === bundle.id && o.assessment.id === item.id && o.anchor === source.anchor && o.status === 'Skipped').map(o=>o.due)].filter(Boolean).sort().at(-1);
                if (offers.some(o=>o.bundleId === bundle.id && o.assessment.id === item.id && o.anchor === source.anchor && o.status === 'Pending')) continue;
                if (item.requirement === 'Optional' && history > today) continue;
                const interval = bundleIntervalDays(bundle);
                const cycles = history ? Math.floor((Date.parse(history) - Date.parse(source.anchor)) / 86400000 / interval) + 1 : 1;
                due = addDays(source.anchor, cycles * interval);
              }
            } else {
              if (collections.some(c=>c.bundleId===bundle.id && c.bundleAssessmentId===item.id && c.bundleEventId===source.eventId) || offers.some(o=>o.bundleId===bundle.id && o.assessment.id===item.id && o.eventId===source.eventId)) continue;
              due = addDays(source.anchor, bundle.delayDays);
            }
            if (!due) continue;
            const id = `BUNDLE-${episode.id}-${bundle.id}-${item.id}-${source.timingSourceId || source.eventId || source.anchor}-${due}`;
            if (collections.some(c=>c.id===id) || offers.some(o=>o.id===id)) continue;
            const offer = {id, bundleId:bundle.id, bundleName:bundle.name, bundleContext:bundleContext(bundle), assessment:{...item}, due, ...source, status:'Pending'};
            if (item.requirement === 'Mandatory' || selection) collections = [...collections, {...bundleCollection(offer,today),
              ...(selection?.extraAssessments.some(extra => extra.id === item.id) ? {bundleRequirement:'Additional'} : {})}];
            else offers = [...offers, offer];
            changed = personChanged = true;
          }
        }
      }
      return collections === episode.collections && (offers === episode.assessmentBundleOffers || (!episode.assessmentBundleOffers && !offers.length)) ? episode : {...episode, collections, assessmentBundleOffers:offers};
    });
    return personChanged ? {...person, episodes} : person;
  });
  return changed ? {...state, people} : state;
}

export function uniqueBundleInstanceName(episode, base) {
  const names = new Set([...(episode.assessmentBundleInstances || []).map(item => item.name),
    ...episode.collections.map(item => item.bundleName)].filter(Boolean).map(name => name.trim().toLowerCase()));
  let name = base.trim(), suffix = 2;
  while (names.has(name.toLowerCase())) name = `${base.trim()} (${suffix++})`;
  return name;
}
