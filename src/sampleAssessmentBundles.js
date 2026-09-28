import { bundleContext } from './assessmentBundles.js';

const preferences = 'Your preferences and next steps v2.0';
const life = 'Life and care check-in v1.0';
const k10 = 'K10+ sample item capture v1.0';
const sdq = 'SDQ coded item sample v1.0';
const who5 = 'WHO-5 sample item capture v1.0';
const assessment = (id, version, requirement = 'Mandatory', recipient = 'Person', channel = 'Clinic tablet') =>
  ({ id, version, requirement, recipient, channel });

// Fictional workflow examples, using the prototype's existing sample instruments.
export const SAMPLE_ASSESSMENT_BUNDLES = [
  {
    id: 'sample-bundle-start', name: 'Getting started with care', enabled: true,
    trigger: 'event', eventType: 'episode-started', delayDays: 1,
    assessments: [assessment('start-life', life), assessment('start-preferences', preferences),
      assessment('start-k10', k10, 'Optional'), assessment('start-who5', who5, 'Optional')],
  },
  {
    id: 'sample-bundle-review', name: 'General care review', enabled: true,
    trigger: 'current', programStream: 'General', careLevel: 'Mid', days: 28, minAge: 12, maxAge: 25,
    assessments: [assessment('review-life', life), assessment('review-k10', k10),
      assessment('review-who5', who5, 'Optional')],
  },
  {
    id: 'sample-bundle-youth', name: 'Youth and family check-in', enabled: true,
    trigger: 'current', programStream: 'General', careLevel: 'All', days: 56, minAge: 12, maxAge: 17,
    assessments: [assessment('youth-preferences', preferences), assessment('youth-sdq', sdq, 'Optional'),
      assessment('youth-family', preferences, 'Optional', 'Family respondent', 'Clinician entry')],
  },
  {
    id: 'sample-bundle-support', name: 'Higher-support care review', enabled: true,
    trigger: 'current', programStream: 'General', careLevel: 'High', days: 28,
    assessments: [assessment('support-life', life), assessment('support-preferences', preferences)],
  },
  {
    id: 'sample-bundle-transition', name: 'Care transition follow-up', enabled: true,
    trigger: 'event', eventType: 'care-transition', delayDays: 7,
    assessments: [assessment('transition-life', life, 'Mandatory', 'Person', 'Clinician entry'),
      assessment('transition-preferences', preferences), assessment('transition-who5', who5, 'Optional')],
  },
];

function sampleBundleId(person, collection) {
  const id = collection.id;
  if (person.id === 'YS-1034') {
    if (['A-7-life-care-starting-point', 'A-7-everyday-life-starting-point',
      'A-7-measure-k10-plus-baseline', 'A-7-measure-who-5-baseline'].includes(id)) return 'sample-bundle-start';
    if (/^A-7-(life-care-(four|eight|twelve|sixteen)-weeks|measure-(k10-plus|who-5)-(review|latest)|due-example-(k10|who5)-)/.test(id))
      return 'sample-bundle-review';
    if (/^A-7-(everyday-life-(four|eight|twelve)-weeks|measure-sdq-(baseline|review|latest)|due-example-sdq-)/.test(id))
      return 'sample-bundle-youth';
  }
  if (person.id === 'YS-1029') {
    if (['A-5-life-care-starting-point', 'A-6-everyday-life-starting-point'].includes(id)) return 'sample-bundle-start';
    if (['A-5-current', ...['four-weeks', 'eight-weeks', 'twelve-weeks'].flatMap(phase =>
      [`A-5-life-care-${phase}`, `A-6-everyday-life-${phase}`])].includes(id)) return 'sample-bundle-support';
  }
  if (person.id === 'YS-1024' && ['A-0-baseline', 'A-0-current'].includes(id)) return 'sample-bundle-youth';
  return null;
}

function sampleBundleAssociation(person, collection, rules) {
  if (collection.bundleId || collection.scheduleRuleId) return null;
  const bundle = rules.find(rule => rule.id === sampleBundleId(person, collection));
  const item = bundle?.assessments?.find(item => item.version === collection.version &&
    item.recipient === (collection.respondent || 'Person'));
  return item ? { bundle, item } : null;
}

export function ensureSampleAssessmentBundles(state, isSamplePerson) {
  if (!state.settings?.groupAssessmentsByBundle) return state;
  const needsTemplates = state.sampleAssessmentBundlesRevision !== 2;
  const existingRules = state.settings.assessmentScheduleRules || [];
  const needsAssociation = state.people.some(person => isSamplePerson(person) &&
    person.episodes.some(episode => episode.collections.some(collection =>
      sampleBundleAssociation(person, collection, existingRules))));
  if (!needsTemplates && !needsAssociation) return state;
  const next = structuredClone(state);
  const rules = next.settings.assessmentScheduleRules ??= [];
  const eventIds = next.people.flatMap(person => person.episodes.flatMap(episode =>
    (episode.events || []).map(event => event.id)));
  for (const template of needsTemplates ? SAMPLE_ASSESSMENT_BUNDLES : []) {
    if (!rules.some(rule => rule.id === template.id || rule.name?.toLowerCase() === template.name.toLowerCase())) {
      rules.push({ ...structuredClone(template), activationEventIds: template.trigger === 'event' ? eventIds : [] });
    }
  }
  for (const person of next.people) {
    if (!isSamplePerson(person)) continue;
    for (const episode of person.episodes) {
      for (const collection of episode.collections) {
        // Preserve staff-created bundle associations and all response/delivery evidence.
        const association = sampleBundleAssociation(person, collection, rules);
        if (!association) continue;
        const { bundle, item } = association;
        const context = Object.fromEntries(Object.entries(bundleContext(bundle))
          .filter(([, value]) => value !== undefined && !Number.isNaN(value)));
        Object.assign(collection, {
          bundleId: bundle.id, bundleName: bundle.name, bundleContext: context,
          bundleAssessmentId: item.id, bundleRequirement: item.requirement, bundleSource: 'Sample',
          scheduleAnchor: episode.start,
        });
      }
    }
  }
  next.sampleAssessmentBundlesRevision = 2;
  return next;
}
